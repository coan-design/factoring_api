-- Migration estrutural: desagio migra de ItemNegociacaoRecebivel para Recebivel.
-- ItemNegociacaoRecebivel vira tabela de juncao pura (mesmo padrao de
-- ItemNegociacaoEmprestimo). Feita em passos (expand -> backfill -> contract) para
-- nao quebrar linhas ja existentes: as novas colunas em Recebivel entram opcionais,
-- sao preenchidas a partir do historico, e so entao viram NOT NULL.

-- Passo 1: adiciona as novas colunas em Recebivel (opcionais por enquanto, exceto
-- tipoDesagio, que ja tem DEFAULT 'SIMPLES' e por isso pode ser NOT NULL desde ja --
-- o Postgres preenche esse default nas linhas existentes automaticamente).
ALTER TABLE "Recebivel"
  ADD COLUMN     "quantidadeDias" INTEGER,
  ADD COLUMN     "tipoDesagio" "TipoDesagio" NOT NULL DEFAULT 'SIMPLES',
  ADD COLUMN     "taxaDesagio" DECIMAL(9,6),
  ADD COLUMN     "valorDesagio" DECIMAL(15,2),
  ADD COLUMN     "valorLiquido" DECIMAL(15,2);

-- Passo 2: backfill a partir do item de negociacao mais recente de cada recebivel,
-- para os recebiveis que ja foram vinculados a alguma negociacao alguma vez.
-- Regra de negocio: um recebivel so pode estar em uma negociacao ativa por vez, entao
-- na pratica ha no maximo um item "relevante" -- mas o codigo trata defensivamente o
-- caso de existir mais de um historico. Como ItemNegociacaoRecebivel nunca teve coluna
-- de createdAt (ela so é criada nesta mesma migration, no passo 5), nao ha timestamp
-- proprio do item para desempatar; o proxy usado e Negociacao.dataNegociacao (existe
-- desde o inicio do sistema), com negociacaoId como desempate final deterministico.
WITH ultimo_item AS (
  SELECT DISTINCT ON (inr."recebivelId")
    inr."recebivelId",
    inr."quantidadeDias",
    inr."tipoDesagio",
    inr."taxaDesagio",
    inr."valorDesagio",
    inr."valorLiquido"
  FROM "ItemNegociacaoRecebivel" inr
  JOIN "Negociacao" n ON n."id" = inr."negociacaoId"
  ORDER BY inr."recebivelId", n."dataNegociacao" DESC, inr."negociacaoId" DESC
)
UPDATE "Recebivel" r
SET
  "quantidadeDias" = ui."quantidadeDias",
  "tipoDesagio" = ui."tipoDesagio",
  "taxaDesagio" = ui."taxaDesagio",
  "valorDesagio" = ui."valorDesagio",
  "valorLiquido" = ui."valorLiquido"
FROM ultimo_item ui
WHERE r."id" = ui."recebivelId";

-- Passo 3: recebiveis que NUNCA foram vinculados a nenhuma negociacao nao tem de onde
-- herdar valor -- ficam com desagio zerado (valorLiquido = valorNominal, ou seja,
-- nenhum desconto ate serem configurados manualmente). Ver na mensagem de review quais
-- ids cairam neste caso.
UPDATE "Recebivel"
SET
  "quantidadeDias" = 0,
  "taxaDesagio" = 0,
  "valorDesagio" = 0,
  "valorLiquido" = "valorNominal"
WHERE "quantidadeDias" IS NULL;

-- Passo 4: agora que toda linha tem valor, torna as colunas obrigatorias.
ALTER TABLE "Recebivel"
  ALTER COLUMN "quantidadeDias" SET NOT NULL,
  ALTER COLUMN "taxaDesagio" SET NOT NULL,
  ALTER COLUMN "valorDesagio" SET NOT NULL,
  ALTER COLUMN "valorLiquido" SET NOT NULL;

-- Passo 5: ItemNegociacaoRecebivel vira tabela de juncao pura -- remove as colunas de
-- valor (ja copiadas para Recebivel no passo 2) e ganha createdAt, no mesmo padrao de
-- ItemNegociacaoEmprestimo.
ALTER TABLE "ItemNegociacaoRecebivel"
  DROP COLUMN "valorConsiderado",
  DROP COLUMN "quantidadeDias",
  DROP COLUMN "tipoDesagio",
  DROP COLUMN "taxaDesagio",
  DROP COLUMN "valorDesagio",
  DROP COLUMN "valorLiquido",
  ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Passo 6: um recebivel so pode aparecer uma vez na mesma negociacao.
CREATE UNIQUE INDEX "ItemNegociacaoRecebivel_negociacaoId_recebivelId_key" ON "ItemNegociacaoRecebivel"("negociacaoId", "recebivelId");
