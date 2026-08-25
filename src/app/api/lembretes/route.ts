import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/lembretes — lembretes pessoais do usuário logado (mais recente primeiro)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  const lembretes = await prisma.lembrete.findMany({
    where: { usuarioId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(lembretes);
}

// POST /api/lembretes — criar lembrete
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  const body = await req.json();
  const texto = (body.texto ?? "").trim();
  if (!texto)
    return NextResponse.json({ error: "Texto do lembrete é obrigatório" }, { status: 400 });

  const lembrete = await prisma.lembrete.create({
    data: { texto, usuarioId: user.id },
  });
  return NextResponse.json(lembrete, { status: 201 });
}
