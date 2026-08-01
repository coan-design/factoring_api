-- CreateEnum
CREATE TYPE "TipoDesagio" AS ENUM ('SIMPLES', 'COMPOSTO');

-- AlterTable
ALTER TABLE "ItemNegociacaoRecebivel" ADD COLUMN     "tipoDesagio" "TipoDesagio" NOT NULL DEFAULT 'SIMPLES';
