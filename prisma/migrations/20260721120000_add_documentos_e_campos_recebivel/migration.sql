-- AlterTable
ALTER TABLE "Recebivel" ADD COLUMN     "emitente" TEXT,
ADD COLUMN     "sacado" TEXT,
ADD COLUMN     "documentoFrenteUrl" TEXT,
ADD COLUMN     "documentoVersoUrl" TEXT;

-- AlterTable
ALTER TABLE "Emprestimo" ADD COLUMN     "contratoUrl" TEXT;
