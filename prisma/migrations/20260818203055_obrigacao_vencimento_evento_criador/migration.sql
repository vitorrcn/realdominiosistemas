-- AlterTable
ALTER TABLE "eventos" ADD COLUMN     "criadoPorId" TEXT;

-- AlterTable
ALTER TABLE "obrigacao_templates" ADD COLUMN     "diaVencimento" INTEGER,
ADD COLUMN     "vencimentoMesSeguinte" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
