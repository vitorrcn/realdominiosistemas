-- CreateTable
CREATE TABLE "lembretes" (
    "id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lembretes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "lembretes" ADD CONSTRAINT "lembretes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
