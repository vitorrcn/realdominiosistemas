/*
  Warnings:

  - You are about to drop the `empresa_supervisores` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "empresa_supervisores" DROP CONSTRAINT "empresa_supervisores_empresaId_fkey";

-- DropForeignKey
ALTER TABLE "empresa_supervisores" DROP CONSTRAINT "empresa_supervisores_usuarioId_fkey";

-- DropTable
DROP TABLE "empresa_supervisores";
