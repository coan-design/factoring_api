/**
 * Script de reparo pontual, companion da migration
 * `20260801150000_recalcula_quantidade_dias_automatico`.
 *
 * Aquela migration recalcula Recebivel.quantidadeDias/valorDesagio/valorLiquido a partir das
 * datas do titulo (SQL puro). Para Recebivel ja vinculados a alguma Negociacao, isso pode mudar
 * o valorLiquido usado no calculo de Negociacao.valorBruto/valorTotalReceber/valorPago/
 * valorAReceber -- que sao cache persistido, nao recalculado pela migration em SQL.
 *
 * Rode este script uma vez, logo apos aplicar aquela migration, em qualquer ambiente com dados
 * existentes (dev/staging/producao). Recalcula TODAS as negociacoes, inclusive
 * FINALIZADA/CANCELADA -- decisao deliberada so para esta correcao pontual (o fluxo normal do
 * app, via NegociacoesService, nunca reescreve negociacoes em status terminal). Idempotente:
 * pode ser rodado mais de uma vez sem efeito colateral (so reflete o estado atual dos itens).
 */
import { PrismaClient } from '@prisma/client';
import { calcularTotaisNegociacao } from '../../src/modules/negociacoes/negociacao.rules';

const prisma = new PrismaClient();

async function main() {
  const negociacoes = await prisma.negociacao.findMany({
    select: { id: true, valorTarifas: true },
  });

  for (const negociacao of negociacoes) {
    const [itensRecebivel, itensEmprestimo, itensAjuste] = await Promise.all([
      prisma.itemNegociacaoRecebivel.findMany({
        where: { negociacaoId: negociacao.id },
        include: { recebivel: true },
      }),
      prisma.itemNegociacaoEmprestimo.findMany({
        where: { negociacaoId: negociacao.id },
        include: { emprestimo: { include: { parcelas: true } } },
      }),
      prisma.itemNegociacaoAjuste.findMany({ where: { negociacaoId: negociacao.id } }),
    ]);

    const totais = calcularTotaisNegociacao(
      itensRecebivel,
      itensEmprestimo,
      itensAjuste,
      negociacao.valorTarifas,
    );

    await prisma.negociacao.update({ where: { id: negociacao.id }, data: totais });
  }

  console.log(`Totais recalculados para ${negociacoes.length} negociacao(oes).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
