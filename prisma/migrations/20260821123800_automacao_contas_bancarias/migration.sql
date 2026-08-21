/*
  Warnings:

  - You are about to drop the column `alertaAtrasoEnviado` on the `obrigacao_instancias` table. All the data in the column will be lost.
  - You are about to drop the column `alertaVencimentoEnviado` on the `obrigacao_instancias` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "obrigacao_instancias" DROP COLUMN "alertaAtrasoEnviado",
DROP COLUMN "alertaVencimentoEnviado";

-- CreateTable
CREATE TABLE "contas_bancarias" (
    "id" TEXT NOT NULL,
    "contabilId" TEXT NOT NULL,
    "banco" TEXT NOT NULL,
    "agencia" TEXT,
    "numeroConta" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "extratoAte" TIMESTAMP(3),
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contas_bancarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracao_automacao" (
    "id" TEXT NOT NULL DEFAULT 'config',
    "diasAntecedenciaVencimento" INTEGER NOT NULL DEFAULT 7,
    "alertaObrigacoesAtivo" BOOLEAN NOT NULL DEFAULT true,
    "alertaCarteiraSemRespAtivo" BOOLEAN NOT NULL DEFAULT true,
    "relatorioIndividualAtivo" BOOLEAN NOT NULL DEFAULT true,
    "relatorioIndividualDiaSemana" INTEGER NOT NULL DEFAULT 1,
    "relatorioComparativoAtivo" BOOLEAN NOT NULL DEFAULT true,
    "relatorioComparativoDiaSemana" INTEGER NOT NULL DEFAULT 1,
    "copiaEmailsFixos" TEXT,
    "atualizadoPorId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracao_automacao_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "contas_bancarias" ADD CONSTRAINT "contas_bancarias_contabilId_fkey" FOREIGN KEY ("contabilId") REFERENCES "contabil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
