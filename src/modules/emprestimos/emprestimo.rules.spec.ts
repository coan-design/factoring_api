import { TipoJuros } from '@prisma/client';
import { calcularValorParcela, parcelaEstaQuitada } from './emprestimo.rules';

describe('emprestimo.rules', () => {
  describe('calcularValorParcela', () => {
    it('juros SIMPLES: distribui principal + juros lineares igualmente entre as parcelas', () => {
      // principal 1000, taxa 1% a.m., 10 parcelas => total = 1000 * (1 + 0.01*10) = 1100
      const parcela = calcularValorParcela(1000, 0.01, 10, TipoJuros.SIMPLES);
      expect(parcela.toNumber()).toBeCloseTo(110, 2);
    });

    it('juros COMPOSTO: aplica a formula de tabela Price', () => {
      // PMT = P * [i*(1+i)^n] / [(1+i)^n - 1], P=1000, i=0.01, n=10 => ~105.58
      const parcela = calcularValorParcela(1000, 0.01, 10, TipoJuros.COMPOSTO);
      expect(parcela.toNumber()).toBeCloseTo(105.58, 1);
    });

    it('com taxa zero, a parcela e simplesmente o principal dividido pelo numero de parcelas', () => {
      const parcela = calcularValorParcela(1000, 0, 4, TipoJuros.COMPOSTO);
      expect(parcela.toNumber()).toBe(250);
    });
  });

  describe('parcelaEstaQuitada', () => {
    it('retorna true quando valorPago e igual ao valor da parcela', () => {
      expect(parcelaEstaQuitada({ valor: 100, valorPago: 100 })).toBe(true);
    });

    it('retorna true quando valorPago excede o valor da parcela', () => {
      expect(parcelaEstaQuitada({ valor: 100, valorPago: 120 })).toBe(true);
    });

    it('retorna false quando valorPago e menor que o valor da parcela', () => {
      expect(parcelaEstaQuitada({ valor: 100, valorPago: 50 })).toBe(false);
    });
  });
});
