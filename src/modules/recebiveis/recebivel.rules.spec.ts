import { StatusRecebivel, TipoDesagio, TipoRecebivel } from '@prisma/client';
import {
  calcularDesagioComposto,
  calcularDesagioPorTipo,
  calcularDesagioSimples,
  calcularQuantidadeDias,
  calcularValorAbertoAposPagamento,
  calcularValorLiquido,
  estaQuitado,
  estaVencido,
} from './recebivel.rules';

describe('recebivel.rules', () => {
  describe('estaVencido', () => {
    it('retorna true quando a data de vencimento ja passou e o status nao e QUITADO', () => {
      const ontem = new Date();
      ontem.setDate(ontem.getDate() - 1);
      expect(
        estaVencido({ dataVencimento: ontem, status: StatusRecebivel.PENDENTE }),
      ).toBe(true);
    });

    it('retorna false quando o recebivel ja esta quitado, mesmo vencido', () => {
      const ontem = new Date();
      ontem.setDate(ontem.getDate() - 1);
      expect(
        estaVencido({ dataVencimento: ontem, status: StatusRecebivel.QUITADO }),
      ).toBe(false);
    });

    it('retorna false quando a data de vencimento ainda nao chegou', () => {
      const amanha = new Date();
      amanha.setDate(amanha.getDate() + 1);
      expect(
        estaVencido({ dataVencimento: amanha, status: StatusRecebivel.PENDENTE }),
      ).toBe(false);
    });
  });

  describe('estaQuitado', () => {
    it('retorna true quando valorAberto e zero', () => {
      expect(estaQuitado({ valorAberto: 0 as any })).toBe(true);
    });

    it('retorna false quando valorAberto e maior que zero', () => {
      expect(estaQuitado({ valorAberto: 10.5 as any })).toBe(false);
    });
  });

  describe('calcularQuantidadeDias', () => {
    it('CHEQUE usa dataBomPara - dataEmissao', () => {
      const dias = calcularQuantidadeDias(
        TipoRecebivel.CHEQUE,
        new Date('2026-07-01'),
        new Date('2026-10-01'), // dataBomPara
        new Date('2026-08-01'), // dataVencimento (ignorada para CHEQUE)
      );
      expect(dias).toBe(92);
    });

    it('DUPLICATA usa dataVencimento - dataEmissao (nao tem dataBomPara)', () => {
      const dias = calcularQuantidadeDias(
        TipoRecebivel.DUPLICATA,
        new Date('2026-06-01'),
        null,
        new Date('2026-08-01'),
      );
      expect(dias).toBe(61);
    });

    it('data relevante igual a dataEmissao -> quantidadeDias = 0', () => {
      const dias = calcularQuantidadeDias(
        TipoRecebivel.DUPLICATA,
        new Date('2026-06-01'),
        null,
        new Date('2026-06-01'),
      );
      expect(dias).toBe(0);
    });
  });

  describe('calcularValorAbertoAposPagamento', () => {
    it('abate o valor pago do valor em aberto', () => {
      const resultado = calcularValorAbertoAposPagamento(100, 30);
      expect(resultado.toNumber()).toBe(70);
    });

    it('permite quitar exatamente (resultado zero)', () => {
      const resultado = calcularValorAbertoAposPagamento(50, 50);
      expect(resultado.toNumber()).toBe(0);
    });

    it('lanca erro se o pagamento exceder o valor em aberto', () => {
      expect(() => calcularValorAbertoAposPagamento(50, 60)).toThrow(RangeError);
    });
  });

  describe('calcularDesagioSimples', () => {
    it('valorNominal * taxaDesagio * quantidadeDias / 30', () => {
      // 1000 * 0.03 * 30 / 30 = 30
      expect(calcularDesagioSimples(1000, 0.03, 30).toNumber()).toBeCloseTo(30, 2);
      // 1000 * 0.03 * 15 / 30 = 15
      expect(calcularDesagioSimples(1000, 0.03, 15).toNumber()).toBeCloseTo(15, 2);
    });

    it('quantidadeDias = 0 -> desagio zero', () => {
      expect(calcularDesagioSimples(1000, 0.03, 0).toNumber()).toBe(0);
    });
  });

  describe('calcularValorLiquido', () => {
    it('valorNominal - valorDesagio', () => {
      expect(calcularValorLiquido(1000, 30).toNumber()).toBe(970);
    });
  });

  describe('calcularDesagioComposto', () => {
    it('valorLiquido = valorNominal / (1 + taxaDesagio) ^ (quantidadeDias / 30)', () => {
      // 1000 / 1.03^1 = 970.87378640776699029...
      const resultado = calcularDesagioComposto(1000, 0.03, 30);
      expect(resultado.valorLiquido.toNumber()).toBeCloseTo(970.873786, 6);
      expect(resultado.valorDesagio.toNumber()).toBeCloseTo(29.126214, 6);
    });

    it('meio periodo (quantidadeDias = 15) usa expoente fracionario 0.5', () => {
      // 1000 / 1.03^0.5 = 985.32927816429315226...
      const resultado = calcularDesagioComposto(1000, 0.03, 15);
      expect(resultado.valorLiquido.toNumber()).toBeCloseTo(985.329278, 6);
    });

    it('quantidadeDias = 0 -> desagio zero (base^0 = 1)', () => {
      const resultado = calcularDesagioComposto(1000, 0.03, 0);
      expect(resultado.valorDesagio.toNumber()).toBe(0);
      expect(resultado.valorLiquido.toNumber()).toBe(1000);
    });

    it('valorDesagio + valorLiquido sempre soma o valorNominal', () => {
      const resultado = calcularDesagioComposto(2000, 0.05, 22);
      expect(resultado.valorDesagio.plus(resultado.valorLiquido).toNumber()).toBeCloseTo(2000, 6);
    });
  });

  describe('calcularDesagioPorTipo', () => {
    it('SIMPLES delega para calcularDesagioSimples + calcularValorLiquido', () => {
      const resultado = calcularDesagioPorTipo(TipoDesagio.SIMPLES, 1000, 0.03, 30);
      expect(resultado.valorDesagio.toNumber()).toBeCloseTo(30, 6);
      expect(resultado.valorLiquido.toNumber()).toBeCloseTo(970, 6);
    });

    it('COMPOSTO delega para calcularDesagioComposto', () => {
      const resultado = calcularDesagioPorTipo(TipoDesagio.COMPOSTO, 1000, 0.03, 30);
      expect(resultado.valorLiquido.toNumber()).toBeCloseTo(970.873786, 6);
    });

    it('quantidadeDias = 0 -> desagio zero nos dois tipos', () => {
      const simples = calcularDesagioPorTipo(TipoDesagio.SIMPLES, 1000, 0.03, 0);
      const composto = calcularDesagioPorTipo(TipoDesagio.COMPOSTO, 1000, 0.03, 0);
      expect(simples.valorDesagio.toNumber()).toBe(0);
      expect(composto.valorDesagio.toNumber()).toBe(0);
    });
  });
});
