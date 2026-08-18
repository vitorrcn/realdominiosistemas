import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT /api/tarefas/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal === "CONSULTA")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  try {
    const body = await req.json();
    const concluindo = body.status === "CONCLUIDO";

    const tarefa = await prisma.tarefa.update({
      where: { id: params.id },
      data: {
        titulo: body.titulo,
        descricao: body.descricao,
        setorId: body.setorId !== undefined ? (body.setorId || null) : undefined,
        responsavelId: body.responsavelId !== undefined ? (body.responsavelId || null) : undefined,
        dataInicio: body.dataInicio !== undefined ? (body.dataInicio ? new Date(body.dataInicio) : null) : undefined,
        prazo: body.prazo !== undefined ? (body.prazo ? new Date(body.prazo) : null) : undefined,
        status: body.status,
        dataConclusao: body.status !== undefined ? (concluindo ? new Date() : null) : undefined,
        motivoAtraso: body.motivoAtraso,
      },
    });

    return NextResponse.json(tarefa);
  } catch (e: any) {
    console.error("Erro ao atualizar tarefa:", e);
    return NextResponse.json({ error: "Erro ao salvar tarefa", detalhe: e?.message }, { status: 500 });
  }
}

// DELETE /api/tarefas/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal === "CONSULTA")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  await prisma.tarefa.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
