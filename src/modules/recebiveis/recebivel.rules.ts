import { Prisma, Recebivel, StatusRecebivel, TipoDesagio, TipoRecebivel } from '@prisma/client';

type RecebivelVencimento = Pick<Recebivel, 'dataVencimento' | 'status'>;
type RecebivelValorAberto = Pick<Recebivel, 'valorAberto'>;

export interface ResultadoDesagio {
  valorDesagio: Prisma.Decimal;
  valorLiquido: Prisma.Decimal;
}

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Recebivel.calcularQuantidadeDias(): prazo considerado no calculo do desagio, derivado da
 * data relevante de cada tipo -- nunca digitado pelo operador. CHEQUE usa dataBomPara (a data
 * que o cliente pediu pra depositar, o que importa pro desagio); DUPLICATA nao tem dataBomPara,
 * entao usa dataVencimento mesmo. Contagem = data relevante - dataEmissao.
 */
export function calcularQuantidadeDias(
  tipo: TipoRecebivel,
  dataEmissao: Date,
  dataBomPara: Date | null | undefined,
  dataVencimento: Date,
): number {
  const dataRelevante = tipo === TipoRecebivel.CHEQUE ? dataBomPara : dataVencimento;
  return Math.round(
    (new Date(dataRelevante as Date).getTime() - new Date(dataEmissao).getTime()) / MS_POR_DIA,
  );
}

/** Recebivel.calcularDesagioSimples(): valorNominal * taxaDesagio * quantidadeDias / 30. */
export function calcularDesagioSimples(
  valorNominal: Prisma.Decimal.Value,
  taxaDesagio: Prisma.Decimal.Value,
  quantidadeDias: number,
): Prisma.Decimal {
  return new Prisma.Decimal(valorNominal)
    .times(new Prisma.Decimal(taxaDesagio))
    .times(quantidadeDias)
    .dividedBy(30);
}

/** Recebivel.calcularValorLiquido(): valorNominal - valorDesagio. */
export function calcularValorLiquido(
  valorNominal: Prisma.Decimal.Value,
  valorDesagio: Prisma.Decimal.Value,
): Prisma.Decimal {
  return new Prisma.Decimal(valorNominal).minus(new Prisma.Decimal(valorDesagio));
}

/**
 * Caso COMPOSTO: desagio exponencial sobre o periodo.
 *   valorLiquido = valorNominal / (1 + taxaDesagio) ^ (quantidadeDias / 30)
 *   valorDesagio = valorNominal - valorLiquido
 *
 * Usa Prisma.Decimal.pow (decimal.js por baixo), que resolve expoente fracionario com
 * precisao decimal completa -- validado manualmente contra o calculo matematico exato
 * (ex.: 1000 / 1.03^0.5 bate casa a casa). Por isso nao ha necessidade de converter para
 * `number`/`Math.pow`, o que introduziria erro de ponto flutuante em valores financeiros.
 */
export function calcularDesagioComposto(
  valorNominal: Prisma.Decimal.Value,
  taxaDesagio: Prisma.Decimal.Value,
  quantidadeDias: number,
): ResultadoDesagio {
  const nominal = new Prisma.Decimal(valorNominal);
  const fatorPeriodo = new Prisma.Decimal(quantidadeDias).dividedBy(30);
  const base = new Prisma.Decimal(1).plus(new Prisma.Decimal(taxaDesagio));

  const valorLiquido = nominal.dividedBy(base.pow(fatorPeriodo));
  const valorDesagio = nominal.minus(valorLiquido);

  return { valorDesagio, valorLiquido };
}

/** Dispatcher usado pelo RecebiveisService ao criar/editar o Recebivel. */
export function calcularDesagioPorTipo(
  tipoDesagio: TipoDesagio,
  valorNominal: Prisma.Decimal.Value,
  taxaDesagio: Prisma.Decimal.Value,
  quantidadeDias: number,
): ResultadoDesagio {
  if (tipoDesagio === TipoDesagio.COMPOSTO) {
    return calcularDesagioComposto(valorNominal, taxaDesagio, quantidadeDias);
  }

  const valorDesagio = calcularDesagioSimples(valorNominal, taxaDesagio, quantidadeDias);
  return { valorDesagio, valorLiquido: calcularValorLiquido(valorNominal, valorDesagio) };
}

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
