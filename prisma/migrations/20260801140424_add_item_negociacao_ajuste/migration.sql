-- CreateEnum
CREATE TYPE "TipoAjusteNegociacao" AS ENUM ('ACRESCIMO', 'DESCONTO');

-- CreateTable
CREATE TABLE "ItemNegociacaoAjuste" (
    "id" TEXT NOT NULL,
    "tipo" "TipoAjusteNegociacao" NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(15,2) NOT NULL,
    "negociacaoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemNegociacaoAjuste_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemNegociacaoAjuste_negociacaoId_idx" ON "ItemNegociacaoAjuste"("negociacaoId");

-- AddForeignKey
ALTER TABLE "ItemNegociacaoAjuste" ADD CONSTRAINT "ItemNegociacaoAjuste_negociacaoId_fkey" FOREIGN KEY ("negociacaoId") REFERENCES "Negociacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemNegociacaoAjuste" ADD CONSTRAINT "ItemNegociacaoAjuste_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
