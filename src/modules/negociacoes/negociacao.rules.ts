import { Prisma } from '@prisma/client';

/** ItemNegociacaoRecebivel.calcularDesagio(): valorConsiderado * taxaDesagio * quantidadeDias / 30. */
export function calcularDesagio(
  valorConsiderado: Prisma.Decimal.Value,
  taxaDesagio: Prisma.Decimal.Value,
  quantidadeDias: number,
): Prisma.Decimal {
  return new Prisma.Decimal(valorConsiderado)
    .times(new Prisma.Decimal(taxaDesagio))
    .times(quantidadeDias)
    .dividedBy(30);
}

/** ItemNegociacaoRecebivel.calcularValorLiquido(): valorConsiderado - valorDesagio. */
export function calcularValorLiquidoItemRecebivel(
  valorConsiderado: Prisma.Decimal.Value,
  valorDesagio: Prisma.Decimal.Value,
): Prisma.Decimal {
  return new Prisma.Decimal(valorConsiderado).minus(new Prisma.Decimal(valorDesagio));
}

/** ItemNegociacaoEmprestimo.calcularJuros(): valorPrincipal * taxaJuros. */
export function calcularJurosItemEmprestimo(
  valorPrincipal: Prisma.Decimal.Value,
  taxaJuros: Prisma.Decimal.Value,
): Prisma.Decimal {
  return new Prisma.Decimal(valorPrincipal).times(new Prisma.Decimal(taxaJuros));
}

/** ItemNegociacaoEmprestimo.calcularValorTotal(): valorPrincipal + valorJuros. */
export function calcularValorTotalItemEmprestimo(
  valorPrincipal: Prisma.Decimal.Value,
  valorJuros: Prisma.Decimal.Value,
): Prisma.Decimal {
  return new Prisma.Decimal(valorPrincipal).plus(new Prisma.Decimal(valorJuros));
}

export interface TotaisNegociacao {
  valorBruto: Prisma.Decimal;
  valorDesagio: Prisma.Decimal;
  valorJuros: Prisma.Decimal;
  valorLiquido: Prisma.Decimal;
  saldoNegociacao: Prisma.Decimal;
}

type ItemRecebivelValores = { valorConsiderado: Prisma.Decimal.Value; valorDesagio: Prisma.Decimal.Value };
type ItemEmprestimoValores = { valorPrincipal: Prisma.Decimal.Value; valorJuros: Prisma.Decimal.Value };

/**
 * Negociacao.calcularValorLiquido() + calcularSaldoNegociacao():
 * valorBruto = soma(valorConsiderado dos itens de recebivel) + soma(valorPrincipal dos itens de emprestimo)
 * valorLiquido = soma dos valores liquidos dos itens (valorConsiderado - valorDesagio; valorPrincipal + valorJuros), menos tarifas
 * saldoNegociacao = valorLiquido - valorPago
 */
export function calcularTotaisNegociacao(
  itensRecebivel: ItemRecebivelValores[],
  itensEmprestimo: ItemEmprestimoValores[],
  valorTarifas: Prisma.Decimal.Value,
  valorPago: Prisma.Decimal.Value,
): TotaisNegociacao {
  const zero = new Prisma.Decimal(0);

  const valorBrutoRecebiveis = itensRecebivel.reduce(
    (acc, item) => acc.plus(item.valorConsiderado),
    zero,
  );
  const valorBrutoEmprestimos = itensEmprestimo.reduce(
    (acc, item) => acc.plus(item.valorPrincipal),
    zero,
  );
  const valorDesagio = itensRecebivel.reduce((acc, item) => acc.plus(item.valorDesagio), zero);
  const valorJuros = itensEmprestimo.reduce((acc, item) => acc.plus(item.valorJuros), zero);

  const valorBruto = valorBrutoRecebiveis.plus(valorBrutoEmprestimos);
  const tarifas = new Prisma.Decimal(valorTarifas);
  const valorLiquido = valorBruto.minus(valorDesagio).minus(valorJuros).minus(tarifas);
  const saldoNegociacao = valorLiquido.minus(new Prisma.Decimal(valorPago));

  return { valorBruto, valorDesagio, valorJuros, valorLiquido, saldoNegociacao };
}
