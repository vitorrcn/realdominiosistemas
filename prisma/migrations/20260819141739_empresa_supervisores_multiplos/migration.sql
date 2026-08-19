-- CreateTable
CREATE TABLE "empresa_supervisores" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "empresa_supervisores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empresa_supervisores_empresaId_usuarioId_key" ON "empresa_supervisores"("empresaId", "usuarioId");

-- AddForeignKey
ALTER TABLE "empresa_supervisores" ADD CONSTRAINT "empresa_supervisores_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresa_supervisores" ADD CONSTRAINT "empresa_supervisores_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preservar dados: cada empresa que já tinha um supervisor único vira uma
-- linha na nova tabela N:N, antes de apagar a coluna antiga.
INSERT INTO "empresa_supervisores" ("id", "empresaId", "usuarioId", "createdAt")
SELECT gen_random_uuid()::text, "id", "respSupervisorId", CURRENT_TIMESTAMP
FROM "empresas"
WHERE "respSupervisorId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "empresas" DROP CONSTRAINT "empresas_respSupervisorId_fkey";

-- AlterTable
ALTER TABLE "empresas" DROP COLUMN "respSupervisorId";
