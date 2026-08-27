-- CreateTable
CREATE TABLE "alteracoes_contratuais" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "descricao" TEXT NOT NULL,
    "criadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alteracoes_contratuais_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "alteracoes_contratuais" ADD CONSTRAINT "alteracoes_contratuais_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alteracoes_contratuais" ADD CONSTRAINT "alteracoes_contratuais_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
