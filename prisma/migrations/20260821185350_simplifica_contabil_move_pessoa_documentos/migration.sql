/*
  Warnings:

  - You are about to drop the column `contaPrincipal` on the `contabil` table. All the data in the column will be lost.
  - You are about to drop the column `formaExtratos` on the `contabil` table. All the data in the column will be lost.
  - You are about to drop the column `pessoaExtratos` on the `contabil` table. All the data in the column will be lost.
  - You are about to drop the column `qtdContasBancarias` on the `contabil` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "relacionamento" ADD COLUMN     "emailDocumentos" TEXT,
ADD COLUMN     "pessoaDocumentos" TEXT,
ADD COLUMN     "telefoneDocumentos" TEXT;

-- Preserva o que já estava preenchido em "pessoa para solicitar extratos"
-- (contabil.pessoaExtratos), movendo pra relacionamento.pessoaDocumentos
-- antes de apagar a coluna antiga. Atualiza quem já tem linha em
-- relacionamento...
UPDATE "relacionamento" r
SET "pessoaDocumentos" = c."pessoaExtratos"
FROM "contabil" c
WHERE c."empresaId" = r."empresaId"
  AND c."pessoaExtratos" IS NOT NULL
  AND r."pessoaDocumentos" IS NULL;

-- ...e cria a linha em relacionamento pra quem tinha o dado em contabil mas
-- ainda não tinha nenhuma linha de relacionamento (ex.: clientes importados).
INSERT INTO "relacionamento" ("id", "empresaId", "pessoaDocumentos", "updatedAt")
SELECT gen_random_uuid()::text, c."empresaId", c."pessoaExtratos", CURRENT_TIMESTAMP
FROM "contabil" c
WHERE c."pessoaExtratos" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "relacionamento" r WHERE r."empresaId" = c."empresaId");

-- AlterTable
ALTER TABLE "contabil" DROP COLUMN "contaPrincipal",
DROP COLUMN "formaExtratos",
DROP COLUMN "pessoaExtratos",
DROP COLUMN "qtdContasBancarias";
