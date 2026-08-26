-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "podeVerRelacoesComerciais" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "relacoes_comerciais" (
    "id" TEXT NOT NULL,
    "prestadorId" TEXT NOT NULL,
    "tomadorId" TEXT NOT NULL,
    "ramoId" TEXT,
    "descricao" TEXT,
    "valor" DECIMAL(14,2),
    "data" TIMESTAMP(3),
    "observacoes" TEXT,
    "criadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "relacoes_comerciais_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "relacoes_comerciais" ADD CONSTRAINT "relacoes_comerciais_prestadorId_fkey" FOREIGN KEY ("prestadorId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relacoes_comerciais" ADD CONSTRAINT "relacoes_comerciais_tomadorId_fkey" FOREIGN KEY ("tomadorId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relacoes_comerciais" ADD CONSTRAINT "relacoes_comerciais_ramoId_fkey" FOREIGN KEY ("ramoId") REFERENCES "ramos_empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relacoes_comerciais" ADD CONSTRAINT "relacoes_comerciais_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
