-- Converte quem porventura ainda seja Coordenador pra Operador antes de
-- remover o valor do enum - a função de Coordenador deixou de existir no
-- sistema (agora só Diretoria, Mordomo(a), Operador e Estagiário; quem
-- supervisiona um setor já é marcado via UsuarioSetor.papel = 'supervisor',
-- não é mais um perfil global à parte).
UPDATE "usuarios" SET "perfilGlobal" = 'OPERADOR' WHERE "perfilGlobal" = 'COORDENADOR';

-- AlterEnum
BEGIN;
CREATE TYPE "PerfilGlobal_new" AS ENUM ('DIRETORIA', 'LIDER', 'OPERADOR', 'CONSULTA');
ALTER TABLE "usuarios" ALTER COLUMN "perfilGlobal" DROP DEFAULT;
ALTER TABLE "usuarios" ALTER COLUMN "perfilGlobal" TYPE "PerfilGlobal_new" USING ("perfilGlobal"::text::"PerfilGlobal_new");
ALTER TYPE "PerfilGlobal" RENAME TO "PerfilGlobal_old";
ALTER TYPE "PerfilGlobal_new" RENAME TO "PerfilGlobal";
DROP TYPE "PerfilGlobal_old";
ALTER TABLE "usuarios" ALTER COLUMN "perfilGlobal" SET DEFAULT 'OPERADOR';
COMMIT;
