import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StatusNegociacao, StatusRecebivel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { STATUS_NEGOCIACAO_BLOQUEIA_REUSO } from '../../common/constants/negociacao.constants';
import { CreateNegociacaoDto } from './dto/create-negociacao.dto';
import { UpdateNegociacaoDto } from './dto/update-negociacao.dto';
import { AdicionarItemRecebivelDto } from './dto/adicionar-item-recebivel.dto';
import { AdicionarItemEmprestimoDto } from './dto/adicionar-item-emprestimo.dto';
import {
  calcularDesagio,
  calcularJurosItemEmprestimo,
  calcularTotaisNegociacao,
  calcularValorLiquidoItemRecebivel,
  calcularValorTotalItemEmprestimo,
} from './negociacao.rules';

const INCLUDE_ITENS = {
  itensRecebivel: { include: { recebivel: true } },
  itensEmprestimo: { include: { emprestimo: true } },
} satisfies Prisma.NegociacaoInclude;

@Injectable()
export class NegociacoesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateNegociacaoDto, usuarioId: string) {
    const cliente = await this.prisma.cliente.findUnique({ where: { id: dto.clienteId } });
    if (!cliente) {
      throw new NotFoundException('Cliente nao encontrado');
    }

    const numeroExistente = await this.prisma.negociacao.findUnique({
      where: { numero: dto.numero },
    });
    if (numeroExistente) {
      throw new ConflictException('Ja existe uma negociacao com este numero');
    }

    const negociacao = await this.prisma.negociacao.create({
      data: {
        numero: dto.numero,
        clienteId: dto.clienteId,
        tipoNegociacao: dto.tipoNegociacao,
        formaPagamento: dto.formaPagamento,
        usuarioId,
        valorTarifas: dto.valorTarifas ?? 0,
        valorBruto: 0,
        valorDesagio: 0,
        valorJuros: 0,
        valorLiquido: 0,
        valorPago: 0,
        saldoNegociacao: 0,
      },
    });

    return this.recalcularTotais(this.prisma, negociacao.id);
  }

  findAll(clienteId?: string, status?: StatusNegociacao) {
    return this.prisma.negociacao.findMany({
      where: {
        ...(clienteId ? { clienteId } : {}),
        ...(status ? { status } : {}),
      },
      include: INCLUDE_ITENS,
      orderBy: { dataNegociacao: 'desc' },
    });
  }

  async findOne(id: string) {
    const negociacao = await this.prisma.negociacao.findUnique({
      where: { id },
      include: INCLUDE_ITENS,
    });
    if (!negociacao) {
      throw new NotFoundException('Negociacao nao encontrada');
    }
    return negociacao;
  }

  async update(id: string, dto: UpdateNegociacaoDto) {
    const negociacao = await this.findOne(id);
    this.garantirEmAnalise(negociacao.status);

    await this.prisma.negociacao.update({ where: { id }, data: dto });
    return this.recalcularTotais(this.prisma, id);
  }

  async remove(id: string) {
    const negociacao = await this.findOne(id);
    if (negociacao.status === StatusNegociacao.FINALIZADA) {
      throw new ConflictException('Nao e possivel excluir uma negociacao finalizada');
    }
    await this.prisma.negociacao.delete({ where: { id } });
  }

  /**
   * Negociacao.adicionarRecebivel(item): valida que o recebivel pertence ao mesmo cliente
   * da negociacao e que ainda nao esta preso a outra negociacao ativa, calcula o desagio
   * e o valor liquido do item, e recalcula os totais da negociacao.
   */
  async adicionarRecebivel(negociacaoId: string, dto: AdicionarItemRecebivelDto) {
    return this.prisma.$transaction(async (tx) => {
      const negociacao = await tx.negociacao.findUnique({ where: { id: negociacaoId } });
      if (!negociacao) {
        throw new NotFoundException('Negociacao nao encontrada');
      }
      this.garantirEmAnalise(negociacao.status);

      const recebivel = await tx.recebivel.findUnique({ where: { id: dto.recebivelId } });
      if (!recebivel) {
        throw new NotFoundException('Recebivel nao encontrado');
      }
      if (recebivel.clienteId !== negociacao.clienteId) {
        throw new ConflictException(
          'O recebivel informado nao pertence ao cliente desta negociacao',
        );
      }

      const emUso = await tx.itemNegociacaoRecebivel.findFirst({
        where: {
          recebivelId: dto.recebivelId,
          negociacao: { status: { in: STATUS_NEGOCIACAO_BLOQUEIA_REUSO } },
        },
      });
      if (emUso) {
        throw new ConflictException('Este recebivel ja esta vinculado a outra negociacao ativa');
      }

      const valorConsiderado = recebivel.valorAberto;
      const valorDesagio = calcularDesagio(valorConsiderado, dto.taxaDesagio, dto.quantidadeDias);
      const valorLiquido = calcularValorLiquidoItemRecebivel(valorConsiderado, valorDesagio);

      await tx.itemNegociacaoRecebivel.create({
        data: {
          negociacaoId,
          recebivelId: dto.recebivelId,
          valorConsiderado,
          quantidadeDias: dto.quantidadeDias,
          taxaDesagio: dto.taxaDesagio,
          valorDesagio,
          valorLiquido,
        },
      });

      await tx.recebivel.update({
        where: { id: dto.recebivelId },
        data: { status: StatusRecebivel.NEGOCIADO },
      });

      return this.recalcularTotais(tx, negociacaoId);
    });
  }

  /**
   * Negociacao.adicionarEmprestimo(item): mesma validacao de pertencimento ao cliente e
   * de nao reuso em negociacao ativa, agora para Emprestimo.
   */
  async adicionarEmprestimo(negociacaoId: string, dto: AdicionarItemEmprestimoDto) {
    return this.prisma.$transaction(async (tx) => {
      const negociacao = await tx.negociacao.findUnique({ where: { id: negociacaoId } });
      if (!negociacao) {
        throw new NotFoundException('Negociacao nao encontrada');
      }
      this.garantirEmAnalise(negociacao.status);

      const emprestimo = await tx.emprestimo.findUnique({ where: { id: dto.emprestimoId } });
      if (!emprestimo) {
        throw new NotFoundException('Emprestimo nao encontrado');
      }
      if (emprestimo.clienteId !== negociacao.clienteId) {
        throw new ConflictException(
          'O emprestimo informado nao pertence ao cliente desta negociacao',
        );
      }

      const emUso = await tx.itemNegociacaoEmprestimo.findFirst({
        where: {
          emprestimoId: dto.emprestimoId,
          negociacao: { status: { in: STATUS_NEGOCIACAO_BLOQUEIA_REUSO } },
        },
      });
      if (emUso) {
        throw new ConflictException('Este emprestimo ja esta vinculado a outra negociacao ativa');
      }

      const valorPrincipal = emprestimo.valorEmprestado;
      const valorJuros = calcularJurosItemEmprestimo(valorPrincipal, dto.taxaJuros);
      const valorTotal = calcularValorTotalItemEmprestimo(valorPrincipal, valorJuros);

      await tx.itemNegociacaoEmprestimo.create({
        data: {
          negociacaoId,
          emprestimoId: dto.emprestimoId,
          valorPrincipal,
          taxaJuros: dto.taxaJuros,
          valorJuros,
          valorTotal,
        },
      });

      return this.recalcularTotais(tx, negociacaoId);
    });
  }

  async aprovar(id: string) {
    const negociacao = await this.findOne(id);
    if (negociacao.status !== StatusNegociacao.EM_ANALISE) {
      throw new ConflictException('Somente negociacoes EM_ANALISE podem ser aprovadas');
    }
    return this.prisma.negociacao.update({
      where: { id },
      data: { status: StatusNegociacao.APROVADA },
    });
  }

  async cancelar(id: string) {
    const negociacao = await this.findOne(id);
    if (
      negociacao.status === StatusNegociacao.FINALIZADA ||
      negociacao.status === StatusNegociacao.CANCELADA
    ) {
      throw new ConflictException('Negociacao ja esta em um status terminal');
    }
    return this.prisma.negociacao.update({
      where: { id },
      data: { status: StatusNegociacao.CANCELADA },
    });
  }

  /** Registra pagamento e recalcula o saldo, sem deixa-lo negativo. */
  async registrarPagamento(id: string, valor: number) {
    const negociacao = await this.findOne(id);
    this.garantirNaoTerminal(negociacao.status);

    const novoValorPago = new Prisma.Decimal(negociacao.valorPago).plus(valor);
    const novoSaldo = new Prisma.Decimal(negociacao.valorLiquido).minus(novoValorPago);
    if (novoSaldo.lessThan(0)) {
      throw new BadRequestException('Valor pago excede o saldo da negociacao');
    }

    return this.prisma.negociacao.update({
      where: { id },
      data: { valorPago: novoValorPago, saldoNegociacao: novoSaldo },
    });
  }

  /** Negociacao.finalizar(): so permite finalizar quando o saldo esta zerado. */
  async finalizar(id: string) {
    const negociacao = await this.findOne(id);
    this.garantirNaoTerminal(negociacao.status);

    if (!new Prisma.Decimal(negociacao.saldoNegociacao).equals(0)) {
      throw new ConflictException('So e possivel finalizar a negociacao com saldo zerado');
    }

    return this.prisma.negociacao.update({
      where: { id },
      data: { status: StatusNegociacao.FINALIZADA },
    });
  }

  private garantirEmAnalise(status: StatusNegociacao) {
    if (status !== StatusNegociacao.EM_ANALISE) {
      throw new ConflictException(
        'Esta operacao so e permitida enquanto a negociacao esta EM_ANALISE',
      );
    }
  }

  private garantirNaoTerminal(status: StatusNegociacao) {
    if (status === StatusNegociacao.FINALIZADA || status === StatusNegociacao.CANCELADA) {
      throw new ConflictException('Negociacao ja esta em um status terminal');
    }
  }

  private async recalcularTotais(
    tx: Prisma.TransactionClient | PrismaService,
    negociacaoId: string,
  ) {
    const negociacao = await tx.negociacao.findUniqueOrThrow({
      where: { id: negociacaoId },
      include: INCLUDE_ITENS,
    });

    const totais = calcularTotaisNegociacao(
      negociacao.itensRecebivel,
      negociacao.itensEmprestimo,
      negociacao.valorTarifas,
      negociacao.valorPago,
    );

    return tx.negociacao.update({
      where: { id: negociacaoId },
      data: totais,
      include: INCLUDE_ITENS,
    });
  }
}
