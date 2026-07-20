-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PerfilUsuario" AS ENUM ('ADMIN', 'OPERADOR', 'ANALISTA');

-- CreateEnum
CREATE TYPE "TipoCliente" AS ENUM ('PESSOA_FISICA', 'PESSOA_JURIDICA');

-- CreateEnum
CREATE TYPE "StatusCliente" AS ENUM ('ATIVO', 'INATIVO');

-- CreateEnum
CREATE TYPE "TipoRecebivel" AS ENUM ('CHEQUE', 'DUPLICATA');

-- CreateEnum
CREATE TYPE "StatusRecebivel" AS ENUM ('PENDENTE', 'NEGOCIADO', 'QUITADO', 'VENCIDO', 'INADIMPLENTE');

-- CreateEnum
CREATE TYPE "TipoJuros" AS ENUM ('SIMPLES', 'COMPOSTO');

-- CreateEnum
CREATE TYPE "StatusParcela" AS ENUM ('PENDENTE', 'PAGA', 'ATRASADA');

-- CreateEnum
CREATE TYPE "TipoNegociacao" AS ENUM ('RECEBIVEIS', 'EMPRESTIMO', 'MISTA');

-- CreateEnum
CREATE TYPE "StatusNegociacao" AS ENUM ('EM_ANALISE', 'APROVADA', 'FINALIZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('PIX', 'TED', 'BOLETO', 'DINHEIRO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "perfil" "PerfilUsuario" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpfCnpj" TEXT NOT NULL,
    "tipoCliente" "TipoCliente" NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "status" "StatusCliente" NOT NULL DEFAULT 'ATIVO',
    "dataCadastro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "enderecoId" TEXT,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Endereco" (
    "id" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "logradouro" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "bairro" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "estado" TEXT NOT NULL,

    CONSTRAINT "Endereco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recebivel" (
    "id" TEXT NOT NULL,
    "tipo" "TipoRecebivel" NOT NULL,
    "valorNominal" DECIMAL(15,2) NOT NULL,
    "valorAberto" DECIMAL(15,2) NOT NULL,
    "dataEmissao" DATE NOT NULL,
    "dataVencimento" DATE NOT NULL,
    "status" "StatusRecebivel" NOT NULL DEFAULT 'PENDENTE',
    "banco" TEXT,
    "agencia" TEXT,
    "conta" TEXT,
    "numeroCheque" TEXT,
    "dataBomPara" DATE,
    "numeroNotaFiscal" TEXT,
    "aceite" BOOLEAN,
    "clienteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recebivel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Emprestimo" (
    "id" TEXT NOT NULL,
    "valorEmprestado" DECIMAL(15,2) NOT NULL,
    "tipoJuros" "TipoJuros" NOT NULL,
    "taxaJuros" DECIMAL(9,6) NOT NULL,
    "quantidadeParcelas" INTEGER NOT NULL,
    "dataContratacao" DATE NOT NULL,
    "clienteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Emprestimo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcelaEmprestimo" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "valor" DECIMAL(15,2) NOT NULL,
    "valorPago" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "dataVencimento" DATE NOT NULL,
    "status" "StatusParcela" NOT NULL DEFAULT 'PENDENTE',
    "emprestimoId" TEXT NOT NULL,

    CONSTRAINT "ParcelaEmprestimo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Negociacao" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "dataNegociacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipoNegociacao" "TipoNegociacao" NOT NULL,
    "status" "StatusNegociacao" NOT NULL DEFAULT 'EM_ANALISE',
    "valorBruto" DECIMAL(15,2) NOT NULL,
    "valorTarifas" DECIMAL(15,2) NOT NULL,
    "valorTotalReceber" DECIMAL(15,2) NOT NULL,
    "valorPago" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "valorAReceber" DECIMAL(15,2) NOT NULL,
    "formaPagamento" "FormaPagamento" NOT NULL,
    "clienteId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Negociacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemNegociacaoRecebivel" (
    "id" TEXT NOT NULL,
    "valorConsiderado" DECIMAL(15,2) NOT NULL,
    "quantidadeDias" INTEGER NOT NULL,
    "taxaDesagio" DECIMAL(9,6) NOT NULL,
    "valorDesagio" DECIMAL(15,2) NOT NULL,
    "valorLiquido" DECIMAL(15,2) NOT NULL,
    "negociacaoId" TEXT NOT NULL,
    "recebivelId" TEXT NOT NULL,

    CONSTRAINT "ItemNegociacaoRecebivel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemNegociacaoEmprestimo" (
    "id" TEXT NOT NULL,
    "negociacaoId" TEXT NOT NULL,
    "emprestimoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemNegociacaoEmprestimo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_perfil_idx" ON "Usuario"("perfil");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_cpfCnpj_key" ON "Cliente"("cpfCnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_enderecoId_key" ON "Cliente"("enderecoId");

-- CreateIndex
CREATE INDEX "Cliente_status_idx" ON "Cliente"("status");

-- CreateIndex
CREATE INDEX "Recebivel_clienteId_idx" ON "Recebivel"("clienteId");

-- CreateIndex
CREATE INDEX "Recebivel_status_idx" ON "Recebivel"("status");

-- CreateIndex
CREATE INDEX "Recebivel_tipo_idx" ON "Recebivel"("tipo");

-- CreateIndex
CREATE INDEX "Emprestimo_clienteId_idx" ON "Emprestimo"("clienteId");

-- CreateIndex
CREATE INDEX "ParcelaEmprestimo_status_idx" ON "ParcelaEmprestimo"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ParcelaEmprestimo_emprestimoId_numero_key" ON "ParcelaEmprestimo"("emprestimoId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Negociacao_numero_key" ON "Negociacao"("numero");

-- CreateIndex
CREATE INDEX "Negociacao_clienteId_idx" ON "Negociacao"("clienteId");

-- CreateIndex
CREATE INDEX "Negociacao_status_idx" ON "Negociacao"("status");

-- CreateIndex
CREATE INDEX "ItemNegociacaoRecebivel_negociacaoId_idx" ON "ItemNegociacaoRecebivel"("negociacaoId");

-- CreateIndex
CREATE INDEX "ItemNegociacaoRecebivel_recebivelId_idx" ON "ItemNegociacaoRecebivel"("recebivelId");

-- CreateIndex
CREATE INDEX "ItemNegociacaoEmprestimo_negociacaoId_idx" ON "ItemNegociacaoEmprestimo"("negociacaoId");

-- CreateIndex
CREATE INDEX "ItemNegociacaoEmprestimo_emprestimoId_idx" ON "ItemNegociacaoEmprestimo"("emprestimoId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemNegociacaoEmprestimo_negociacaoId_emprestimoId_key" ON "ItemNegociacaoEmprestimo"("negociacaoId", "emprestimoId");

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_enderecoId_fkey" FOREIGN KEY ("enderecoId") REFERENCES "Endereco"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recebivel" ADD CONSTRAINT "Recebivel_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emprestimo" ADD CONSTRAINT "Emprestimo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelaEmprestimo" ADD CONSTRAINT "ParcelaEmprestimo_emprestimoId_fkey" FOREIGN KEY ("emprestimoId") REFERENCES "Emprestimo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Negociacao" ADD CONSTRAINT "Negociacao_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Negociacao" ADD CONSTRAINT "Negociacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemNegociacaoRecebivel" ADD CONSTRAINT "ItemNegociacaoRecebivel_negociacaoId_fkey" FOREIGN KEY ("negociacaoId") REFERENCES "Negociacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemNegociacaoRecebivel" ADD CONSTRAINT "ItemNegociacaoRecebivel_recebivelId_fkey" FOREIGN KEY ("recebivelId") REFERENCES "Recebivel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemNegociacaoEmprestimo" ADD CONSTRAINT "ItemNegociacaoEmprestimo_negociacaoId_fkey" FOREIGN KEY ("negociacaoId") REFERENCES "Negociacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemNegociacaoEmprestimo" ADD CONSTRAINT "ItemNegociacaoEmprestimo_emprestimoId_fkey" FOREIGN KEY ("emprestimoId") REFERENCES "Emprestimo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

