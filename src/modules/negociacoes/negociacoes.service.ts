import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StatusNegociacao, StatusRecebivel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  STATUS_NEGOCIACAO_ABERTOS,
  STATUS_NEGOCIACAO_BLOQUEIA_REUSO,
} from '../../common/constants/negociacao.constants';
import { CreateNegociacaoDto } from './dto/create-negociacao.dto';
import { UpdateNegociacaoDto } from './dto/update-negociacao.dto';
import { AdicionarItemRecebivelDto } from './dto/adicionar-item-recebivel.dto';
import { AdicionarItemEmprestimoDto } from './dto/adicionar-item-emprestimo.dto';
import { calcularDesagio, calcularTotaisNegociacao, calcularValorLiquidoItemRecebivel } from './negociacao.rules';

const INCLUDE_ITENS = {
  itensRecebivel: { include: { recebivel: true } },
  itensEmprestimo: { include: { emprestimo: { include: { parcelas: true } } } },
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
        titulo: dto.titulo,
        descricao: dto.descricao,
        clienteId: dto.clienteId,
        tipoNegociacao: dto.tipoNegociacao,
        formaPagamento: dto.formaPagamento,
        usuarioId,
        valorTarifas: dto.valorTarifas ?? 0,
        valorBruto: 0,
        valorTotalReceber: 0,
        valorPago: 0,
        valorAReceber: 0,
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
   * da negociacao e que ainda nao esta preso a outra negociacao ativa. valorConsiderado e
   * o valorNominal do recebivel no momento da inclusao. Recalcula os totais da negociacao.
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

      const valorConsiderado = recebivel.valorNominal;
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
   * Negociacao.adicionarEmprestimo(item): cria um vinculo puro (sem valores proprios) entre
   * a negociacao e o emprestimo, validando pertencimento ao cliente e nao-reuso em outra
   * negociacao ativa. O emprestimo entra inteiro -- todas as suas parcelas (pagas ou nao)
   * continuam vinculadas ao Emprestimo original e alimentam os totais da negociacao.
   */
  async adicionarEmprestimo(negociacaoId: string, dto: AdicionarItemEmprestimoDto) {
    return this.prisma.$transaction(async (tx) => {
      const negociacao = await tx.negociacao.findUnique({ where: { id: negociacaoId } });
      if (!negociacao) {
        throw new NotFoundException('Negociacao nao encontrada');
      }
      this.garantirEmAnalise(negociacao.status);

      const emprestimo = await tx.emprestimo.findUnique({
        where: { id: dto.emprestimoId },
        include: { parcelas: true },
      });
      if (!emprestimo) {
        throw new NotFoundException('Emprestimo nao encontrado');
      }
      if (emprestimo.clienteId !== negociacao.clienteId) {
        throw new ConflictException(
          'O emprestimo informado nao pertence ao cliente desta negociacao',
        );
      }
      if (emprestimo.parcelas.length === 0) {
        throw new ConflictException(
          'As parcelas do emprestimo ainda nao foram geradas (gerarParcelas)',
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

      await tx.itemNegociacaoEmprestimo.create({
        data: { negociacaoId, emprestimoId: dto.emprestimoId },
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

  /** Negociacao.finalizar(): so permite finalizar quando valorAReceber esta zerado. */
  async finalizar(id: string) {
    const negociacao = await this.findOne(id);
    this.garantirNaoTerminal(negociacao.status);

    if (!new Prisma.Decimal(negociacao.valorAReceber).equals(0)) {
      throw new ConflictException('So e possivel finalizar a negociacao com valorAReceber zerado');
    }

    return this.prisma.negociacao.update({
      where: { id },
      data: { status: StatusNegociacao.FINALIZADA },
    });
  }

  /**
   * Gatilho de recalculo: chamado pelo RecebiveisService sempre que um pagamento e
   * registrado num recebivel. So recalcula negociacoes ainda abertas (EM_ANALISE/APROVADA) --
   * negociacoes finalizadas/canceladas sao historico e nao devem ser reescritas.
   */
  async recalcularPorRecebivel(recebivelId: string) {
    const itens = await this.prisma.itemNegociacaoRecebivel.findMany({
      where: { recebivelId, negociacao: { status: { in: STATUS_NEGOCIACAO_ABERTOS } } },
      select: { negociacaoId: true },
    });
    for (const item of itens) {
      await this.recalcularTotais(this.prisma, item.negociacaoId);
    }
  }

  /** Gatilho de recalculo: chamado pelo ParcelasEmprestimoService apos registrar pagamento. */
  async recalcularPorEmprestimo(emprestimoId: string) {
    const itens = await this.prisma.itemNegociacaoEmprestimo.findMany({
      where: { emprestimoId, negociacao: { status: { in: STATUS_NEGOCIACAO_ABERTOS } } },
      select: { negociacaoId: true },
    });
    for (const item of itens) {
      await this.recalcularTotais(this.prisma, item.negociacaoId);
    }
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
    );

    return tx.negociacao.update({
      where: { id: negociacaoId },
      data: totais,
      include: INCLUDE_ITENS,
    });
  }
}
