-- CreateEnum
CREATE TYPE "TipoSocietario" AS ENUM ('MEI', 'ME', 'EI', 'EPP', 'EIRELI', 'SA', 'LTDA');

-- AlterTable
ALTER TABLE "societario" ADD COLUMN     "tipoSocietario" "TipoSocietario";
