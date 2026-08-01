import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StatusRecebivel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { STATUS_NEGOCIACAO_ABERTOS } from '../../common/constants/negociacao.constants';
import { NegociacoesService } from '../negociacoes/negociacoes.service';
import { montarRespostaPaginada } from '../../common/utils/pagination.util';
import { CreateRecebivelDto } from './dto/create-recebivel.dto';
import { UpdateRecebivelDto } from './dto/update-recebivel.dto';
import { FindAllRecebiveisQueryDto } from './dto/find-all-recebiveis-query.dto';
import { LadoDocumentoRecebivel } from './dto/upload-documento-recebivel.dto';
import {
  calcularDesagioPorTipo,
  calcularQuantidadeDias,
  calcularValorAbertoAposPagamento,
  estaQuitado,
  estaVencido,
} from './recebivel.rules';

@Injectable()
export class RecebiveisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly negociacoesService: NegociacoesService,
    private readonly storageService: StorageService,
  ) {}

  async create(dto: CreateRecebivelDto) {
    const cliente = await this.prisma.cliente.findUnique({ where: { id: dto.clienteId } });
    if (!cliente) {
      throw new NotFoundException('Cliente nao encontrado');
    }

    const quantidadeDias = calcularQuantidadeDias(
      dto.tipo,
      dto.dataEmissao,
      dto.dataBomPara,
      dto.dataVencimento,
    );
    const { valorDesagio, valorLiquido } = calcularDesagioPorTipo(
      dto.tipoDesagio,
      dto.valorNominal,
      dto.taxaDesagio,
      quantidadeDias,
    );

    return this.prisma.recebivel.create({
      data: {
        ...dto,
        quantidadeDias,
        valorAberto: dto.valorNominal,
        status: StatusRecebivel.PENDENTE,
        valorDesagio,
        valorLiquido,
      },
    });
  }

  async findAll(query: FindAllRecebiveisQueryDto) {
    const where: Prisma.RecebivelWhereInput = {
      ...(query.clienteId ? { clienteId: query.clienteId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.tipo ? { tipo: query.tipo } : {}),
      ...(query.dataVencimentoInicio || query.dataVencimentoFim
        ? {
            dataVencimento: {
              ...(query.dataVencimentoInicio ? { gte: new Date(query.dataVencimentoInicio) } : {}),
              ...(query.dataVencimentoFim ? { lte: new Date(query.dataVencimentoFim) } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.recebivel.findMany({
        where,
        orderBy: { dataVencimento: 'asc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.recebivel.count({ where }),
    ]);

    return montarRespostaPaginada(data, total, query);
  }

  async findOne(id: string) {
    const recebivel = await this.prisma.recebivel.findUnique({ where: { id } });
    if (!recebivel) {
      throw new NotFoundException('Recebivel nao encontrado');
    }
    return recebivel;
  }

  async update(id: string, dto: UpdateRecebivelDto) {
    const recebivel = await this.findOne(id);

    const alteraDesagio =
      dto.valorNominal !== undefined ||
      dto.taxaDesagio !== undefined ||
      dto.tipoDesagio !== undefined ||
      dto.dataEmissao !== undefined ||
      dto.dataBomPara !== undefined ||
      dto.dataVencimento !== undefined;

    const data: Prisma.RecebivelUpdateInput = { ...dto };

    if (alteraDesagio) {
      await this.garantirDesagioEditavel(id);

      const quantidadeDias = calcularQuantidadeDias(
        recebivel.tipo,
        dto.dataEmissao ?? recebivel.dataEmissao,
        dto.dataBomPara ?? recebivel.dataBomPara,
        dto.dataVencimento ?? recebivel.dataVencimento,
      );
      const { valorDesagio, valorLiquido } = calcularDesagioPorTipo(
        dto.tipoDesagio ?? recebivel.tipoDesagio,
        dto.valorNominal ?? recebivel.valorNominal,
        dto.taxaDesagio ?? recebivel.taxaDesagio,
        quantidadeDias,
      );
      data.quantidadeDias = quantidadeDias;
      data.valorDesagio = valorDesagio;
      data.valorLiquido = valorLiquido;
    }

    return this.prisma.recebivel.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.recebivel.delete({ where: { id } });
  }

  /** Recebivel.estaVencido() exposto como consulta. */
  async verificarVencido(id: string): Promise<boolean> {
    const recebivel = await this.findOne(id);
    return estaVencido(recebivel);
  }

  /** Recebivel.estaQuitado() exposto como consulta. */
  async verificarQuitado(id: string): Promise<boolean> {
    const recebivel = await this.findOne(id);
    return estaQuitado(recebivel);
  }

  /**
   * Recebivel.registrarPagamento(valor): abate valorAberto, nunca deixa negativo,
   * e recalcula o status (QUITADO se zerou, VENCIDO se passou do vencimento, ou mantem).
   */
  async registrarPagamento(id: string, valor: number) {
    const recebivel = await this.findOne(id);

    if (recebivel.status === StatusRecebivel.QUITADO) {
      throw new BadRequestException('Recebivel ja esta quitado');
    }

    let novoValorAberto;
    try {
      novoValorAberto = calcularValorAbertoAposPagamento(recebivel.valorAberto, valor);
    } catch (error) {
      if (error instanceof RangeError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    const quitado = novoValorAberto.equals(0);
    const novoStatus = quitado
      ? StatusRecebivel.QUITADO
      : estaVencido({ dataVencimento: recebivel.dataVencimento, status: recebivel.status })
        ? StatusRecebivel.VENCIDO
        : recebivel.status;

    const atualizado = await this.prisma.recebivel.update({
      where: { id },
      data: { valorAberto: novoValorAberto, status: novoStatus },
    });

    // Se este recebivel estiver vinculado a uma negociacao aberta, seus totais
    // (valorPago/valorAReceber) dependem de Recebivel.valorAberto e precisam ser recalculados.
    await this.negociacoesService.recalcularPorRecebivel(id);

    return atualizado;
  }

  /** Sobe a imagem de frente/verso do recebivel e grava a URL retornada pelo storage. */
  async salvarDocumento(id: string, lado: LadoDocumentoRecebivel, arquivo: Express.Multer.File) {
    await this.findOne(id);

    const url = await this.storageService.upload(`recebiveis/${id}`, arquivo);
    const campo = lado === LadoDocumentoRecebivel.FRENTE ? 'documentoFrenteUrl' : 'documentoVersoUrl';

    await this.prisma.recebivel.update({ where: { id }, data: { [campo]: url } });

    return { url };
  }

  /**
   * Bloqueia alteracao de deságio (valorNominal/taxaDesagio/tipoDesagio/dataEmissao/
   * dataBomPara/dataVencimento -- as tres ultimas alimentam o quantidadeDias calculado)
   * enquanto o recebivel estiver vinculado a uma negociacao EM_ANALISE/APROVADA -- mudar
   * esses valores silenciosamente alteraria o valorBruto de uma negociacao em andamento.
   */
  private async garantirDesagioEditavel(recebivelId: string) {
    const vinculado = await this.prisma.itemNegociacaoRecebivel.findFirst({
      where: {
        recebivelId,
        negociacao: { status: { in: STATUS_NEGOCIACAO_ABERTOS } },
      },
    });
    if (vinculado) {
      throw new ConflictException(
        'Nao e possivel alterar o desagio de um recebivel vinculado a uma negociacao em andamento',
      );
    }
  }
}
