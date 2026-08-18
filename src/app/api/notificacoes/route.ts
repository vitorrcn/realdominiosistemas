import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/notificacoes — últimas notificações do usuário logado
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;

  const [notificacoes, naoLidas] = await Promise.all([
    prisma.notificacao.findMany({
      where: { usuarioId: user.id },
      orderBy: { dataHora: "desc" },
      take: 20,
    }),
    prisma.notificacao.count({ where: { usuarioId: user.id, lida: false } }),
  ]);

  return NextResponse.json({ notificacoes, naoLidas });
}

// PATCH /api/notificacoes — marcar todas como lidas
export async function PATCH() {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  await prisma.notificacao.updateMany({
    where: { usuarioId: user.id, lida: false },
    data: { lida: true },
  });

  return NextResponse.json({ ok: true });
}
