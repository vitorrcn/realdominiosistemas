import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT /api/lembretes/[id] — editar o texto (só o dono do lembrete)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  const existente = await prisma.lembrete.findUnique({ where: { id: params.id } });
  if (!existente || existente.usuarioId !== user.id)
    return NextResponse.json({ error: "Lembrete não encontrado" }, { status: 404 });

  const body = await req.json();
  const texto = (body.texto ?? "").trim();
  if (!texto)
    return NextResponse.json({ error: "Texto do lembrete é obrigatório" }, { status: 400 });

  const lembrete = await prisma.lembrete.update({
    where: { id: params.id },
    data: { texto },
  });
  return NextResponse.json(lembrete);
}

// DELETE /api/lembretes/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  const existente = await prisma.lembrete.findUnique({ where: { id: params.id } });
  if (!existente || existente.usuarioId !== user.id)
    return NextResponse.json({ error: "Lembrete não encontrado" }, { status: 404 });

  await prisma.lembrete.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
