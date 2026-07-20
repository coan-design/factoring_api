import { Prisma, Recebivel, StatusRecebivel } from '@prisma/client';

type RecebivelVencimento = Pick<Recebivel, 'dataVencimento' | 'status'>;
type RecebivelValorAberto = Pick<Recebivel, 'valorAberto'>;

/** Recebivel.estaVencido(): vencido e ainda nao quitado. */
export function estaVencido(recebivel: RecebivelVencimento): boolean {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencimento = new Date(recebivel.dataVencimento);
  vencimento.setHours(0, 0, 0, 0);
  return vencimento < hoje && recebivel.status !== StatusRecebivel.QUITADO;
}

/** Recebivel.estaQuitado(): valorAberto chegou a zero. */
export function estaQuitado(recebivel: RecebivelValorAberto): boolean {
  return new Prisma.Decimal(recebivel.valorAberto).equals(0);
}

/**
 * Calcula o novo valorAberto apos um pagamento. Nunca deixa o resultado negativo:
 * lanca erro se o valor pago exceder o valor em aberto.
 */
export function calcularValorAbertoAposPagamento(
  valorAberto: Prisma.Decimal.Value,
  valorPago: Prisma.Decimal.Value,
): Prisma.Decimal {
  const aberto = new Prisma.Decimal(valorAberto);
  const pago = new Prisma.Decimal(valorPago);
  const novoValorAberto = aberto.minus(pago);

  if (novoValorAberto.lessThan(0)) {
    throw new RangeError('Valor pago excede o valor em aberto do recebivel');
  }

  return novoValorAberto;
}
