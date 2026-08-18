import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/eventos/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const evento = await prisma.evento.findUnique({
    where: { id: params.id, deletedAt: null },
    include: {
      empresa: { select: { id: true, codigoInterno: true, razaoSocial: true } },
      tipoEvento: { select: { id: true, nome: true } },
      setorAtual: { select: { id: true, nome: true } },
      respAtual: { select: { id: true, nome: true } },
      historico: { orderBy: { dataHora: "desc" }, include: { usuario: { select: { nome: true } } } },
      tarefas: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!evento)
    return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });

  return NextResponse.json(evento);
}

// PUT /api/eventos/[id]
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
    const atual = await prisma.evento.findUnique({ where: { id: params.id } });
    if (!atual)
      return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });

    const evento = await prisma.evento.update({
      where: { id: params.id },
      data: {
        setorAtualId: body.setorAtualId !== undefined ? (body.setorAtualId || null) : undefined,
        respAtualId:  body.respAtualId  !== undefined ? (body.respAtualId  || null) : undefined,
        prazo:        body.prazo        !== undefined ? (body.prazo ? new Date(body.prazo) : null) : undefined,
        status:       body.status,
        observacoes:  body.observacoes,
      },
    });

    // Registrar no histórico qualquer mudança relevante
    const mudancas: string[] = [];
    if (body.status && body.status !== atual.status) mudancas.push(`Status: ${atual.status} → ${body.status}`);
    if (body.setorAtualId !== undefined && body.setorAtualId !== atual.setorAtualId) mudancas.push("Setor alterado");
    if (body.respAtualId !== undefined && body.respAtualId !== atual.respAtualId) mudancas.push("Responsável alterado");

    if (mudancas.length > 0 || body.comentario) {
      await prisma.eventoHistorico.create({
        data: {
          eventoId: params.id,
          usuarioId: user.id,
          descricao: body.comentario || mudancas.join(" | "),
          statusAnterior: atual.status,
          statusNovo: body.status || atual.status,
        },
      });
    }

    return NextResponse.json(evento);
  } catch (e: any) {
    console.error("Erro ao atualizar evento:", e);
    return NextResponse.json({ error: "Erro ao salvar evento", detalhe: e?.message }, { status: 500 });
  }
}

// DELETE /api/eventos/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (!["DIRETORIA", "COORDENADOR", "LIDER"].includes(user.perfilGlobal))
    return NextResponse.json({ error: "Sem permissão para excluir eventos" }, { status: 403 });

  await prisma.evento.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
