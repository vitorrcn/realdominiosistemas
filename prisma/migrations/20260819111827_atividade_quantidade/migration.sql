-- AlterTable
ALTER TABLE "atividades" ADD COLUMN     "exigeQuantidade" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unidadeQuantidade" TEXT;

-- AlterTable
ALTER TABLE "registros_atividade" ADD COLUMN     "quantidade" INTEGER;
