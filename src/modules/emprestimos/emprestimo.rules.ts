import { Prisma, TipoJuros } from '@prisma/client';

/**
 * Calcula o valor de cada parcela mensal fixa do emprestimo.
 * - SIMPLES: juros lineares sobre o principal, distribuidos igualmente entre as parcelas
 *   (valorTotal = principal * (1 + taxa * n); parcela = valorTotal / n).
 * - COMPOSTO: tabela Price (parcelas fixas com juros compostos sobre o saldo devedor).
 */
export function calcularValorParcela(
  valorEmprestado: Prisma.Decimal.Value,
  taxaJuros: Prisma.Decimal.Value,
  quantidadeParcelas: number,
  tipoJuros: TipoJuros,
): Prisma.Decimal {
  const principal = new Prisma.Decimal(valorEmprestado);
  const taxa = new Prisma.Decimal(taxaJuros);

  if (taxa.equals(0)) {
    return principal.dividedBy(quantidadeParcelas);
  }

  if (tipoJuros === TipoJuros.SIMPLES) {
    const valorTotal = principal.times(taxa.times(quantidadeParcelas).plus(1));
    return valorTotal.dividedBy(quantidadeParcelas);
  }

  // COMPOSTO - tabela Price: PMT = P * [i * (1+i)^n] / [(1+i)^n - 1]
  const fatorPotencia = taxa.plus(1).pow(quantidadeParcelas);
  return principal.times(taxa.times(fatorPotencia)).dividedBy(fatorPotencia.minus(1));
}

type ParcelaValores = { valor: Prisma.Decimal.Value; valorPago: Prisma.Decimal.Value };

/** ParcelaEmprestimo.estaQuitada(): valorPago >= valor. */
export function parcelaEstaQuitada(parcela: ParcelaValores): boolean {
  return new Prisma.Decimal(parcela.valorPago).greaterThanOrEqualTo(
    new Prisma.Decimal(parcela.valor),
  );
}
