-- Migration de dados (sem alteracao de schema): quantidadeDias deixa de ser digitado pelo
-- operador e passa a ser derivado automaticamente da data relevante de cada Recebivel --
-- dataBomPara - dataEmissao para CHEQUE, dataVencimento - dataEmissao para DUPLICATA.
--
-- Recalcula quantidadeDias/valorDesagio/valorLiquido para TODOS os Recebivel, inclusive os
-- ja vinculados a alguma negociacao (mesmo historico/FINALIZADA) -- o valor antigo de
-- quantidadeDias podia ter sido digitado manualmente na negociacao e divergir da data real
-- do titulo, entao nao ha valor confiavel para preservar. taxaDesagio NAO e tocado aqui
-- (ja foi corretamente herdado do historico de ItemNegociacaoRecebivel na migration anterior,
-- 20260801140000_recebivel_absorve_desagio_de_item_negociacao).
--
-- Como Negociacao.valorBruto/valorTotalReceber/valorPago/valorAReceber sao cache persistido
-- (nao recalculado por esta migration em SQL puro), rode o script
-- `prisma/scripts/recalcular-totais-negociacao.ts` logo em seguida em qualquer ambiente com
-- dados existentes, para realinhar os totais das negociacoes cujo Recebivel mudou de valor
-- (inclusive negociacoes ja FINALIZADAS).

-- Passo 1: quantidadeDias = data relevante - dataEmissao.
UPDATE "Recebivel"
SET "quantidadeDias" = CASE
  WHEN "tipo" = 'CHEQUE' THEN ("dataBomPara" - "dataEmissao")
  ELSE ("dataVencimento" - "dataEmissao")
END;

-- Passo 2: valorDesagio/valorLiquido a partir do quantidadeDias recem-calculado (taxaDesagio
-- inalterado). Formula linear (SIMPLES): valorNominal * taxaDesagio * quantidadeDias / 30.
-- Recebiveis com tipoDesagio = COMPOSTO nao existem ainda neste banco (feature adicionada
-- junto com esta mesma leva de mudancas), entao a formula linear cobre 100% das linhas atuais;
-- se algum dia houver COMPOSTO persistido antes desta migration rodar, ajuste manualmente --
-- a formula exponencial nao e representavel em SQL puro sem reimplementar Decimal.pow.
UPDATE "Recebivel"
SET
  "valorDesagio" = "valorNominal" * "taxaDesagio" * "quantidadeDias" / 30,
  "valorLiquido" = "valorNominal" - ("valorNominal" * "taxaDesagio" * "quantidadeDias" / 30);
