import { ReceitaMensalDto } from './dto/receita-mensal.dto';

/**
 * Arredonda quantidade/total para percentuais inteiros que somam exatamente 100.
 * Estrategia: arredonda cada grupo normalmente, soma, e credita/debita a diferenca
 * resultante (positiva ou negativa) inteiramente no maior grupo -- evita distribuir
 * o erro de arredondamento por varios grupos pequenos, que ficaria mais dificil de
 * explicar num grafico de rosca do que "a maior fatia absorveu 1 ponto".
 */
export function calcularPercentuaisComArredondamento(grupos: { quantidade: number }[]): number[] {
  const total = grupos.reduce((acumulado, grupo) => acumulado + grupo.quantidade, 0);
  if (total === 0) {
    return grupos.map(() => 0);
  }

  const percentuais = grupos.map((grupo) => Math.round((grupo.quantidade / total) * 100));
  const somaAtual = percentuais.reduce((acumulado, percentual) => acumulado + percentual, 0);
  const diferenca = 100 - somaAtual;

  if (diferenca !== 0) {
    const indiceMaiorGrupo = grupos.reduce(
      (maiorIndice, grupo, indiceAtual, todosOsGrupos) =>
        grupo.quantidade > todosOsGrupos[maiorIndice].quantidade ? indiceAtual : maiorIndice,
      0,
    );
    percentuais[indiceMaiorGrupo] += diferenca;
  }

  return percentuais;
}

/**
 * Gera as chaves "YYYY-MM" dos ultimos `quantidadeMeses`, do mais antigo ao mais
 * recente, terminando no mes de `referencia` (inclusive). Usada para preencher com
 * zero os meses sem nenhuma negociacao, mantendo a serie continua para o grafico.
 */
export function gerarChavesDeMeses(quantidadeMeses: number, referencia: Date = new Date()): string[] {
  const chaves: string[] = [];
  for (let indice = quantidadeMeses - 1; indice >= 0; indice--) {
    const data = new Date(referencia.getFullYear(), referencia.getMonth() - indice, 1);
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    chaves.push(`${ano}-${mes}`);
  }
  return chaves;
}

/** Primeiro dia do mes mais antigo da janela -- limite inferior para a query de agregacao. */
export function inicioDaJanela(quantidadeMeses: number, referencia: Date = new Date()): Date {
  return new Date(referencia.getFullYear(), referencia.getMonth() - (quantidadeMeses - 1), 1);
}

/** Combina as chaves de mes com os mapas de soma (desagio/tarifas), zerando meses sem dado. */
export function montarSerieReceitaMensal(
  chavesDeMeses: string[],
  desagioPorMes: Map<string, number>,
  tarifasPorMes: Map<string, number>,
): ReceitaMensalDto[] {
  return chavesDeMeses.map((mes) => ({
    mes,
    desagio: desagioPorMes.get(mes) ?? 0,
    tarifas: tarifasPorMes.get(mes) ?? 0,
  }));
}
