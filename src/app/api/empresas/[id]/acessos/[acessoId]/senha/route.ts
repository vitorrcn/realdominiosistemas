import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { descriptografar } from "@/lib/crypto";

// GET /api/empresas/[id]/acessos/[acessoId]/senha — revela a senha real
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; acessoId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal === "CONSULTA")
    return NextResponse.json({ error: "Sem permissão para ver senhas" }, { status: 403 });

  const acesso = await prisma.acessoSistema.findUnique({
    where: { id: params.acessoId, empresaId: params.id },
  });

  if (!acesso || !acesso.senhaCifrada)
    return NextResponse.json({ senha: null });

  try {
    const senha = descriptografar(acesso.senhaCifrada);
    return NextResponse.json({ senha });
  } catch (e) {
    console.error("Erro ao descriptografar senha:", e);
    return NextResponse.json({ error: "Erro ao ler a senha" }, { status: 500 });
  }
}
