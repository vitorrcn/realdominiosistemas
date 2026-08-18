-- AlterTable
ALTER TABLE "empresas" ADD COLUMN     "respLiderId" TEXT,
ADD COLUMN     "respSupervisorId" TEXT;

-- AddForeignKey
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_respLiderId_fkey" FOREIGN KEY ("respLiderId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_respSupervisorId_fkey" FOREIGN KEY ("respSupervisorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
