import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StatusParcela } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NegociacoesService } from '../negociacoes/negociacoes.service';
import { parcelaEstaQuitada } from '../emprestimos/emprestimo.rules';

@Injectable()
export class ParcelasEmprestimoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly negociacoesService: NegociacoesService,
  ) {}

  findAllByEmprestimo(emprestimoId: string) {
    return this.prisma.parcelaEmprestimo.findMany({
      where: { emprestimoId },
      orderBy: { numero: 'asc' },
    });
  }

  async findOne(id: string) {
    const parcela = await this.prisma.parcelaEmprestimo.findUnique({ where: { id } });
    if (!parcela) {
      throw new NotFoundException('Parcela nao encontrada');
    }
    return parcela;
  }

  /** ParcelaEmprestimo.estaQuitada() exposto como consulta. */
  async verificarQuitada(id: string): Promise<boolean> {
    const parcela = await this.findOne(id);
    return parcelaEstaQuitada(parcela);
  }

  /** Registra pagamento (total ou parcial) e recalcula o status da parcela. */
  async registrarPagamento(id: string, valor: number) {
    const parcela = await this.findOne(id);

    const novoValorPago = new Prisma.Decimal(parcela.valorPago).plus(valor);
    const quitada = parcelaEstaQuitada({ valor: parcela.valor, valorPago: novoValorPago });

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const vencimento = new Date(parcela.dataVencimento);
    vencimento.setHours(0, 0, 0, 0);

    const novoStatus = quitada
      ? StatusParcela.PAGA
      : vencimento < hoje
        ? StatusParcela.ATRASADA
        : StatusParcela.PENDENTE;

    const atualizada = await this.prisma.parcelaEmprestimo.update({
      where: { id },
      data: { valorPago: novoValorPago, status: novoStatus },
    });

    // Se o emprestimo desta parcela estiver vinculado a uma negociacao aberta, os totais
    // da negociacao (valorPago/valorAReceber) dependem de ParcelaEmprestimo.valorPago.
    await this.negociacoesService.recalcularPorEmprestimo(parcela.emprestimoId);

    return atualizada;
  }
}
