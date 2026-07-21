import {
  calcularPercentuaisComArredondamento,
  gerarChavesDeMeses,
  inicioDaJanela,
  montarSerieReceitaMensal,
} from './dashboard.rules';

describe('dashboard.rules', () => {
  describe('calcularPercentuaisComArredondamento', () => {
    it('reproduz o exemplo do contrato (145/30/60/15 de 250 -> 58/12/24/6)', () => {
      const percentuais = calcularPercentuaisComArredondamento([
        { quantidade: 145 },
        { quantidade: 30 },
        { quantidade: 60 },
        { quantidade: 15 },
      ]);

      expect(percentuais).toEqual([58, 12, 24, 6]);
      expect(percentuais.reduce((a, b) => a + b, 0)).toBe(100);
    });

    it('retorna zero para todos os grupos quando o total e zero', () => {
      expect(
        calcularPercentuaisComArredondamento([{ quantidade: 0 }, { quantidade: 0 }]),
      ).toEqual([0, 0]);
    });

    it('retorna array vazio para lista vazia', () => {
      expect(calcularPercentuaisComArredondamento([])).toEqual([]);
    });

    it('um unico grupo sempre fecha em 100', () => {
      expect(calcularPercentuaisComArredondamento([{ quantidade: 7 }])).toEqual([100]);
    });

    it('credita o resto positivo de arredondamento no maior grupo', () => {
      // 1/3, 1/3, 1/3 de 3 -> arredonda pra 33,33,33 (soma 99) -> falta +1, vai pro primeiro maior (empate -> primeiro)
      const percentuais = calcularPercentuaisComArredondamento([
        { quantidade: 1 },
        { quantidade: 1 },
        { quantidade: 1 },
      ]);
      expect(percentuais.reduce((a, b) => a + b, 0)).toBe(100);
      expect(Math.max(...percentuais)).toBe(34);
    });

    it('debita o resto negativo de arredondamento do maior grupo quando o arredondamento passa de 100', () => {
      // 67/200=33.5% -> arredonda p/ 34 ; 67/200=33.5% -> 34 ; 66/200=33% -> 33. Soma bruta = 101.
      const grupos = [{ quantidade: 67 }, { quantidade: 67 }, { quantidade: 66 }];
      const percentuais = calcularPercentuaisComArredondamento(grupos);
      expect(percentuais.reduce((a, b) => a + b, 0)).toBe(100);
      expect(percentuais).toEqual([33, 34, 33]);
    });
  });

  describe('gerarChavesDeMeses', () => {
    it('gera as chaves do mais antigo ao mais recente, incluindo o mes de referencia', () => {
      const chaves = gerarChavesDeMeses(6, new Date(2026, 6, 21)); // julho/2026 (mes 0-indexed)
      expect(chaves).toEqual(['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07']);
    });

    it('atravessa virada de ano corretamente', () => {
      const chaves = gerarChavesDeMeses(3, new Date(2026, 0, 15)); // janeiro/2026
      expect(chaves).toEqual(['2025-11', '2025-12', '2026-01']);
    });

    it('com quantidadeMeses = 1, retorna so o mes de referencia', () => {
      expect(gerarChavesDeMeses(1, new Date(2026, 3, 1))).toEqual(['2026-04']);
    });
  });

  describe('inicioDaJanela', () => {
    it('retorna o primeiro dia do mes mais antigo da janela', () => {
      const inicio = inicioDaJanela(6, new Date(2026, 6, 21));
      expect(inicio.getFullYear()).toBe(2026);
      expect(inicio.getMonth()).toBe(1); // fevereiro (0-indexed)
      expect(inicio.getDate()).toBe(1);
    });
  });

  describe('montarSerieReceitaMensal', () => {
    it('zera meses ausentes dos mapas de soma, mantendo a serie continua', () => {
      const chaves = ['2026-02', '2026-03', '2026-04'];
      const desagio = new Map([['2026-02', 100], ['2026-04', 300]]);
      const tarifas = new Map([['2026-03', 20]]);

      expect(montarSerieReceitaMensal(chaves, desagio, tarifas)).toEqual([
        { mes: '2026-02', desagio: 100, tarifas: 0 },
        { mes: '2026-03', desagio: 0, tarifas: 20 },
        { mes: '2026-04', desagio: 300, tarifas: 0 },
      ]);
    });

    it('retorna array vazio para lista de chaves vazia', () => {
      expect(montarSerieReceitaMensal([], new Map(), new Map())).toEqual([]);
    });
  });
});
