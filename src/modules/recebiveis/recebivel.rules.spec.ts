import { StatusRecebivel } from '@prisma/client';
import { calcularValorAbertoAposPagamento, estaQuitado, estaVencido } from './recebivel.rules';

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
});
