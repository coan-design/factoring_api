import {
  calcularDesagio,
  calcularTotaisNegociacao,
  calcularValorLiquidoItemRecebivel,
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

  describe('calcularTotaisNegociacao', () => {
    it('retorna zeros (menos as tarifas) quando nao ha itens', () => {
      const totais = calcularTotaisNegociacao([], [], 50);
      expect(totais.valorBruto.toNumber()).toBe(0);
      expect(totais.valorTotalReceber.toNumber()).toBe(0);
      expect(totais.valorPago.toNumber()).toBe(0);
      expect(totais.valorAReceber.toNumber()).toBe(-50);
    });

    it('apenas recebivel, sem pagamento anterior: bruto = liquido do item, total a receber = nominal', () => {
      const totais = calcularTotaisNegociacao(
        [
          {
            valorLiquido: 970, // 1000 nominal - 30 desagio
            recebivel: { valorNominal: 1000, valorAberto: 1000 },
          },
        ],
        [],
        0,
      );

      expect(totais.valorBruto.toNumber()).toBe(970);
      expect(totais.valorTotalReceber.toNumber()).toBe(1000);
      expect(totais.valorPago.toNumber()).toBe(0);
      expect(totais.valorAReceber.toNumber()).toBe(1000);
    });

    it('recebivel com pagamento parcial anterior a negociacao entra no valorPago', () => {
      // recebivel de 1000, ja recebeu 400 antes de entrar na negociacao (valorAberto = 600)
      const totais = calcularTotaisNegociacao(
        [
          {
            valorLiquido: 970,
            recebivel: { valorNominal: 1000, valorAberto: 600 },
          },
        ],
        [],
        0,
      );

      expect(totais.valorPago.toNumber()).toBe(400);
      expect(totais.valorAReceber.toNumber()).toBe(600);
    });

    it('apenas emprestimo: bruto = valorEmprestado, total a receber = soma das parcelas geradas', () => {
      const totais = calcularTotaisNegociacao(
        [],
        [
          {
            emprestimo: {
              valorEmprestado: 1000,
              parcelas: [
                { valor: 110, valorPago: 0 },
                { valor: 110, valorPago: 0 },
              ],
            },
          },
        ],
        0,
      );

      expect(totais.valorBruto.toNumber()).toBe(1000);
      expect(totais.valorTotalReceber.toNumber()).toBe(220);
      expect(totais.valorPago.toNumber()).toBe(0);
      expect(totais.valorAReceber.toNumber()).toBe(220);
    });

    it('emprestimo com parcelas ja parcialmente pagas antes da negociacao', () => {
      // emprestimo entra inteiro: parcela ja paga continua contando no total a receber,
      // mas o que ja foi pago tambem conta em valorPago.
      const totais = calcularTotaisNegociacao(
        [],
        [
          {
            emprestimo: {
              valorEmprestado: 1000,
              parcelas: [
                { valor: 110, valorPago: 110 }, // ja quitada antes da negociacao
                { valor: 110, valorPago: 40 }, // parcialmente paga
                { valor: 110, valorPago: 0 },
              ],
            },
          },
        ],
        0,
      );

      expect(totais.valorTotalReceber.toNumber()).toBe(330);
      expect(totais.valorPago.toNumber()).toBe(150); // 110 + 40
      expect(totais.valorAReceber.toNumber()).toBe(180);
    });

    it('combina recebiveis e emprestimos, com pagamentos parciais anteriores em ambos, e desconta tarifas', () => {
      const totais = calcularTotaisNegociacao(
        [
          {
            valorLiquido: 970, // 1000 nominal, desagio 30
            recebivel: { valorNominal: 1000, valorAberto: 600 }, // ja recebeu 400
          },
          {
            valorLiquido: 485, // 500 nominal, desagio 15
            recebivel: { valorNominal: 500, valorAberto: 500 }, // nada recebido ainda
          },
        ],
        [
          {
            emprestimo: {
              valorEmprestado: 1000,
              parcelas: [
                { valor: 110, valorPago: 110 },
                { valor: 110, valorPago: 40 },
                { valor: 110, valorPago: 0 },
              ],
            },
          },
        ],
        20, // tarifas
      );

      // bruto = (970 + 485) recebiveis + 1000 emprestimo
      expect(totais.valorBruto.toNumber()).toBe(2455);
      // totalReceber = (1000 + 500) recebiveis + 330 emprestimo
      expect(totais.valorTotalReceber.toNumber()).toBe(1830);
      // pago = (400 + 0) recebiveis + 150 emprestimo
      expect(totais.valorPago.toNumber()).toBe(550);
      // aReceber = 1830 - 550 - 20
      expect(totais.valorAReceber.toNumber()).toBe(1260);
    });
  });
});
