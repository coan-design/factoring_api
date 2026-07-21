import { Injectable } from '@nestjs/common';
import { Prisma, StatusParcela, StatusRecebivel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { STATUS_NEGOCIACAO_ABERTOS } from '../../common/constants/negociacao.constants';
import { IndicadoresDashboardDto } from './dto/indicadores-dashboard.dto';
import { RecebivelPorStatusDto } from './dto/recebivel-por-status.dto';
import { ReceitaMensalDto } from './dto/receita-mensal.dto';
import {
  calcularPercentuaisComArredondamento,
  gerarChavesDeMeses,
  inicioDaJanela,
  montarSerieReceitaMensal,
} from './dashboard.rules';

interface LinhaSomaMensal {
  mes: string;
  total: string | null;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getIndicadores(): Promise<IndicadoresDashboardDto> {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const [recebiveisVencidos, negociacoesAbertas, emprestimosAtivosCount, saldoDevedorAgregado] =
      await Promise.all([
        // Regra viva (mesma semantica de Recebivel.estaVencido()), nao o status
        // armazenado: um recebivel pode estar vencido sem que ninguem ainda tenha
        // chamado registrarPagamento pra recalcular o status persistido.
        this.prisma.recebivel.aggregate({
          where: { dataVencimento: { lt: hoje }, status: { not: StatusRecebivel.QUITADO } },
          _sum: { valorAberto: true },
          _count: { _all: true },
        }),
        // Uma unica query serve tanto saldoTotalAReceber quanto negociacoesEmAberto
        // (mesmo filtro de status, mesmo significado de "valor").
        this.prisma.negociacao.aggregate({
          where: { status: { in: STATUS_NEGOCIACAO_ABERTOS } },
          _sum: { valorAReceber: true },
          _count: { _all: true },
        }),
        // Mesmo filtro usado em EmprestimosService.findAll({ comSaldoDevedor: true }).
        this.prisma.emprestimo.count({
          where: { parcelas: { some: { status: { not: StatusParcela.PAGA } } } },
        }),
        // Saldo devedor total = soma de (valor - valorPago) das parcelas nao pagas.
        // Uma parcela PAGA nunca contribui (mesmo se valorPago > valor por excedente),
        // entao basta agregar sobre as nao pagas -- sem precisar percorrer emprestimo a emprestimo.
        this.prisma.parcelaEmprestimo.aggregate({
          where: { status: { not: StatusParcela.PAGA } },
          _sum: { valor: true, valorPago: true },
        }),
      ]);

    const saldoDevedorTotal = new Prisma.Decimal(saldoDevedorAgregado._sum.valor ?? 0).minus(
      saldoDevedorAgregado._sum.valorPago ?? 0,
    );
    const valorAReceberAberto = negociacoesAbertas._sum.valorAReceber ?? new Prisma.Decimal(0);

    return {
      recebiveisVencidos: {
        valor: (recebiveisVencidos._sum.valorAberto ?? new Prisma.Decimal(0)).toNumber(),
        quantidade: recebiveisVencidos._count._all,
      },
      saldoTotalAReceber: {
        valor: valorAReceberAberto.toNumber(),
      },
      emprestimosAtivos: {
        quantidade: emprestimosAtivosCount,
        valor: saldoDevedorTotal.toNumber(),
      },
      negociacoesEmAberto: {
        quantidade: negociacoesAbertas._count._all,
        valor: valorAReceberAberto.toNumber(),
      },
    };
  }

  async getRecebiveisPorStatus(): Promise<RecebivelPorStatusDto[]> {
    const grupos = await this.prisma.recebivel.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    if (grupos.length === 0) {
      return [];
    }

    const percentuais = calcularPercentuaisComArredondamento(
      grupos.map((grupo) => ({ quantidade: grupo._count._all })),
    );

    return grupos.map((grupo, indice) => ({
      status: grupo.status,
      quantidade: grupo._count._all,
      percentual: percentuais[indice],
    }));
  }

  async getReceitaMensal(meses: number, referencia: Date = new Date()): Promise<ReceitaMensalDto[]> {
    const chavesDeMeses = gerarChavesDeMeses(meses, referencia);
    const dataMinima = inicioDaJanela(meses, referencia);

    const [desagioPorMes, tarifasPorMes] = await Promise.all([
      this.somarDesagioPorMes(dataMinima),
      this.somarTarifasPorMes(dataMinima),
    ]);

    return montarSerieReceitaMensal(chavesDeMeses, desagioPorMes, tarifasPorMes);
  }

  /**
   * Soma ItemNegociacaoRecebivel.valorDesagio por mes de Negociacao.dataNegociacao.
   * Query separada da de tarifas: um join direto com Negociacao multiplicaria
   * valorTarifas por item quando a negociacao tem mais de um ItemNegociacaoRecebivel.
   */
  private async somarDesagioPorMes(dataMinima: Date): Promise<Map<string, number>> {
    const linhas = await this.prisma.$queryRaw<LinhaSomaMensal[]>`
      SELECT to_char(date_trunc('month', n."dataNegociacao"), 'YYYY-MM') AS mes,
             SUM(i."valorDesagio")::text AS total
      FROM "ItemNegociacaoRecebivel" i
      JOIN "Negociacao" n ON n.id = i."negociacaoId"
      WHERE n.status != 'CANCELADA'::"StatusNegociacao"
        AND n."dataNegociacao" >= ${dataMinima}
      GROUP BY 1
    `;
    return new Map(linhas.map((linha) => [linha.mes, Number(linha.total ?? 0)]));
  }

  /** Soma Negociacao.valorTarifas por mes de dataNegociacao (uma linha por negociacao). */
  private async somarTarifasPorMes(dataMinima: Date): Promise<Map<string, number>> {
    const linhas = await this.prisma.$queryRaw<LinhaSomaMensal[]>`
      SELECT to_char(date_trunc('month', n."dataNegociacao"), 'YYYY-MM') AS mes,
             SUM(n."valorTarifas")::text AS total
      FROM "Negociacao" n
      WHERE n.status != 'CANCELADA'::"StatusNegociacao"
        AND n."dataNegociacao" >= ${dataMinima}
      GROUP BY 1
    `;
    return new Map(linhas.map((linha) => [linha.mes, Number(linha.total ?? 0)]));
  }
}
