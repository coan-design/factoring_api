import { Prisma, TipoAjusteNegociacao } from '@prisma/client';

interface ItemRecebivelParaCalculo {
  recebivel: {
    valorNominal: Prisma.Decimal.Value;
    valorAberto: Prisma.Decimal.Value;
    valorLiquido: Prisma.Decimal.Value;
  };
}

interface ItemEmprestimoParaCalculo {
  emprestimo: {
    valorEmprestado: Prisma.Decimal.Value;
    parcelas: { valor: Prisma.Decimal.Value; valorPago: Prisma.Decimal.Value }[];
  };
}

interface ItemAjusteParaCalculo {
  tipo: TipoAjusteNegociacao;
  valor: Prisma.Decimal.Value;
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
 * - calcularValorBruto(): soma(Emprestimo.valorEmprestado) + soma(Recebivel.valorLiquido)
 *   -> quanto a factoring desembolsou na negociacao.
 * - calcularValorTotalReceber(): soma(Emprestimo.calcularValorTotal(), i.e. soma das parcelas)
 *   + soma(Recebivel.valorNominal) -> quanto se espera receber no total, ja com o lucro embutido.
 * - calcularValorPago(): soma(Recebivel.valorNominal - Recebivel.valorAberto)
 *   + soma(ParcelaEmprestimo.valorPago) -> o que ja entrou de fato, incluindo pagamentos
 *   anteriores a inclusao na negociacao.
 * - calcularValorAReceber(): valorTotalReceber - valorPago - valorTarifas
 *   - soma(ItemNegociacaoAjuste DESCONTO) + soma(ItemNegociacaoAjuste ACRESCIMO).
 *   Ajuste e mecanismo aditivo, independente de valorTarifas (que continua existindo,
 *   sem itemizacao): DESCONTO reduz o saldo do mesmo jeito que valorTarifas, ACRESCIMO
 *   aumenta -- multa por atraso, correcao monetaria, custo extra repassado ao cliente.
 */
export function calcularTotaisNegociacao(
  itensRecebivel: ItemRecebivelParaCalculo[],
  itensEmprestimo: ItemEmprestimoParaCalculo[],
  itensAjuste: ItemAjusteParaCalculo[],
  valorTarifas: Prisma.Decimal.Value,
): TotaisNegociacao {
  const zero = new Prisma.Decimal(0);

  const valorBrutoRecebiveis = itensRecebivel.reduce(
    (acumulado, item) => acumulado.plus(item.recebivel.valorLiquido),
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

  const valorAcrescimos = itensAjuste
    .filter((item) => item.tipo === TipoAjusteNegociacao.ACRESCIMO)
    .reduce((acumulado, item) => acumulado.plus(item.valor), zero);
  const valorDescontosAdicionais = itensAjuste
    .filter((item) => item.tipo === TipoAjusteNegociacao.DESCONTO)
    .reduce((acumulado, item) => acumulado.plus(item.valor), zero);

  const valorAReceber = valorTotalReceber
    .minus(valorPago)
    .minus(new Prisma.Decimal(valorTarifas))
    .minus(valorDescontosAdicionais)
    .plus(valorAcrescimos);

  return { valorBruto, valorTotalReceber, valorPago, valorAReceber };
}
