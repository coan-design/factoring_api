import {
  calcularDesagio,
  calcularJurosItemEmprestimo,
  calcularTotaisNegociacao,
  calcularValorLiquidoItemRecebivel,
  calcularValorTotalItemEmprestimo,
} from './negociacao.rules';

describe('negociacao.rules', () => {
  it('calcularDesagio: valorConsiderado * taxaDesagio * quantidadeDias / 30', () => {
    // 1000 * 0.03 * 30 / 30 = 30
    expect(calcularDesagio(1000, 0.03, 30).toNumber()).toBeCloseTo(30, 2);
    // 1000 * 0.03 * 15 / 30 = 15
    expect(calcularDesagio(1000, 0.03, 15).toNumber()).toBeCloseTo(15, 2);
  });

  it('calcularValorLiquidoItemRecebivel: valorConsiderado - valorDesagio', () => {
    expect(calcularValorLiquidoItemRecebivel(1000, 30).toNumber()).toBe(970);
  });

  it('calcularJurosItemEmprestimo: valorPrincipal * taxaJuros', () => {
    expect(calcularJurosItemEmprestimo(1000, 0.05).toNumber()).toBe(50);
  });

  it('calcularValorTotalItemEmprestimo: valorPrincipal + valorJuros', () => {
    expect(calcularValorTotalItemEmprestimo(1000, 50).toNumber()).toBe(1050);
  });

  describe('calcularTotaisNegociacao', () => {
    it('soma os itens de recebivel e emprestimo e desconta as tarifas', () => {
      const totais = calcularTotaisNegociacao(
        [{ valorConsiderado: 1000, valorDesagio: 30 }],
        [{ valorPrincipal: 500, valorJuros: 25 }],
        10,
        0,
      );

      expect(totais.valorBruto.toNumber()).toBe(1500);
      expect(totais.valorDesagio.toNumber()).toBe(30);
      expect(totais.valorJuros.toNumber()).toBe(25);
      // liquido = 1500 - 30 - 25 - 10 = 1435
      expect(totais.valorLiquido.toNumber()).toBe(1435);
      expect(totais.saldoNegociacao.toNumber()).toBe(1435);
    });

    it('abate valorPago do saldo', () => {
      const totais = calcularTotaisNegociacao(
        [{ valorConsiderado: 1000, valorDesagio: 30 }],
        [],
        0,
        400,
      );

      expect(totais.valorLiquido.toNumber()).toBe(970);
      expect(totais.saldoNegociacao.toNumber()).toBe(570);
    });

    it('retorna zeros quando nao ha itens', () => {
      const totais = calcularTotaisNegociacao([], [], 0, 0);
      expect(totais.valorBruto.toNumber()).toBe(0);
      expect(totais.valorLiquido.toNumber()).toBe(0);
      expect(totais.saldoNegociacao.toNumber()).toBe(0);
    });
  });
});
