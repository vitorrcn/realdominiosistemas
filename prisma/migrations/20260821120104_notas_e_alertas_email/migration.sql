-- AlterTable
ALTER TABLE "obrigacao_instancias" ADD COLUMN     "alertaAtrasoEnviado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "alertaVencimentoEnviado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "notaPessoal" TEXT;
