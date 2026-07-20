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

interface ItemRecebivelParaCalculo {
  valorLiquido: Prisma.Decimal.Value;
  recebivel: {
    valorNominal: Prisma.Decimal.Value;
    valorAberto: Prisma.Decimal.Value;
  };
}

interface ItemEmprestimoParaCalculo {
  emprestimo: {
    valorEmprestado: Prisma.Decimal.Value;
    parcelas: { valor: Prisma.Decimal.Value; valorPago: Prisma.Decimal.Value }[];
  };
}

export interface TotaisNegociacao {
  valorBruto: Prisma.Decimal;
  valorTotalReceber: Prisma.Decimal;
  valorPago: Prisma.Decimal;
  valorAReceber: Prisma.Decimal;
}

/**
 * Agrega os quatro campos calculados de Negociacao a partir dos itens vinculados.
 * O emprestimo entra "inteiro": nao ha valores proprios em ItemNegociacaoEmprestimo, os
 * totais leem diretamente de Emprestimo.valorEmprestado e das ParcelaEmprestimo geradas
 * (pagas ou nao), independente de quando essas parcelas foram pagas.
 *
 * - calcularValorBruto(): soma(Emprestimo.valorEmprestado) + soma(ItemNegociacaoRecebivel.valorLiquido)
 *   -> quanto a factoring desembolsou na negociacao.
 * - calcularValorTotalReceber(): soma(Emprestimo.calcularValorTotal(), i.e. soma das parcelas)
 *   + soma(Recebivel.valorNominal) -> quanto se espera receber no total, ja com o lucro embutido.
 * - calcularValorPago(): soma(Recebivel.valorNominal - Recebivel.valorAberto)
 *   + soma(ParcelaEmprestimo.valorPago) -> o que ja entrou de fato, incluindo pagamentos
 *   anteriores a inclusao na negociacao.
 * - calcularValorAReceber(): valorTotalReceber - valorPago - valorTarifas.
 */
export function calcularTotaisNegociacao(
  itensRecebivel: ItemRecebivelParaCalculo[],
  itensEmprestimo: ItemEmprestimoParaCalculo[],
  valorTarifas: Prisma.Decimal.Value,
): TotaisNegociacao {
  const zero = new Prisma.Decimal(0);

  const valorBrutoRecebiveis = itensRecebivel.reduce(
    (acumulado, item) => acumulado.plus(item.valorLiquido),
    zero,
  );
  const valorBrutoEmprestimos = itensEmprestimo.reduce(
    (acumulado, item) => acumulado.plus(item.emprestimo.valorEmprestado),
    zero,
  );
  const valorBruto = valorBrutoRecebiveis.plus(valorBrutoEmprestimos);

  const valorTotalReceberRecebiveis = itensRecebivel.reduce(
    (acumulado, item) => acumulado.plus(item.recebivel.valorNominal),
    zero,
  );
  const valorTotalReceberEmprestimos = itensEmprestimo.reduce((acumulado, item) => {
    const totalParcelas = item.emprestimo.parcelas.reduce(
      (somaParcelas, parcela) => somaParcelas.plus(parcela.valor),
      zero,
    );
    return acumulado.plus(totalParcelas);
  }, zero);
  const valorTotalReceber = valorTotalReceberRecebiveis.plus(valorTotalReceberEmprestimos);

  const valorPagoRecebiveis = itensRecebivel.reduce(
    (acumulado, item) =>
      acumulado.plus(
        new Prisma.Decimal(item.recebivel.valorNominal).minus(item.recebivel.valorAberto),
      ),
    zero,
  );
  const valorPagoEmprestimos = itensEmprestimo.reduce((acumulado, item) => {
    const totalPago = item.emprestimo.parcelas.reduce(
      (somaParcelas, parcela) => somaParcelas.plus(parcela.valorPago),
      zero,
    );
    return acumulado.plus(totalPago);
  }, zero);
  const valorPago = valorPagoRecebiveis.plus(valorPagoEmprestimos);

  const valorAReceber = valorTotalReceber.minus(valorPago).minus(new Prisma.Decimal(valorTarifas));

  return { valorBruto, valorTotalReceber, valorPago, valorAReceber };
}
