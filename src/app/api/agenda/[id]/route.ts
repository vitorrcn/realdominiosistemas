import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function checarPermissao(user: any, item: { setorId: string | null; usuarioId: string | null }) {
  if (user.perfilGlobal === "CONSULTA") return "Sem permissão para acessar a agenda";
  if (user.perfilGlobal === "DIRETORIA") return null;

  const meusSetores: string[] = (user.setores ?? []).map((s: any) => s.setorId);

  if (user.perfilGlobal === "OPERADOR") {
    if (item.setorId) return "Como operador, você não pode editar compromissos de setor";
    if (item.usuarioId && item.usuarioId !== user.id) return "Você só pode editar compromissos da sua própria agenda";
    return null;
  }

  if (user.perfilGlobal === "LIDER") {
    if (item.setorId && !meusSetores.includes(item.setorId)) return "Você só pode editar compromissos do seu próprio setor";
    if (item.usuarioId && item.usuarioId !== user.id) {
      const colaborador = await prisma.usuarioSetor.findFirst({
        where: { usuarioId: item.usuarioId, setorId: { in: meusSetores } },
      });
      if (!colaborador) return "Você só pode editar compromissos de colaboradores do seu setor";
    }
    return null;
  }

  return "Sem permissão";
}

// PUT /api/agenda/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  const existente = await prisma.agendaItem.findUnique({ where: { id: params.id } });
  if (!existente)
    return NextResponse.json({ error: "Compromisso não encontrado" }, { status: 404 });

  const erroPermissao = await checarPermissao(user, existente);
  if (erroPermissao)
    return NextResponse.json({ error: erroPermissao }, { status: 403 });

  const body = await req.json();

  try {
    const item = await prisma.agendaItem.update({
      where: { id: params.id },
      data: {
        titulo: body.titulo,
        descricao: body.descricao || null,
        data: body.data ? new Date(body.data) : undefined,
        horaInicio: body.diaTodo ? null : (body.horaInicio || null),
        horaFim: body.diaTodo ? null : (body.horaFim || null),
        diaTodo: !!body.diaTodo,
        tipo: body.tipo !== undefined ? (body.tipo === "REUNIAO" ? "REUNIAO" : "COMPROMISSO") : undefined,
        concluido: body.concluido !== undefined ? !!body.concluido : undefined,
      },
      include: {
        setor: { select: { id: true, nome: true } },
        usuario: { select: { id: true, nome: true } },
        criadoPor: { select: { id: true, nome: true } },
      },
    });
    return NextResponse.json(item);
  } catch (e: any) {
    console.error("Erro ao atualizar compromisso:", e);
    return NextResponse.json({ error: "Erro ao salvar compromisso", detalhe: e?.message }, { status: 500 });
  }
}

// DELETE /api/agenda/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  const existente = await prisma.agendaItem.findUnique({ where: { id: params.id } });
  if (!existente)
    return NextResponse.json({ error: "Compromisso não encontrado" }, { status: 404 });

  const erroPermissao = await checarPermissao(user, existente);
  if (erroPermissao)
    return NextResponse.json({ error: erroPermissao }, { status: 403 });

  await prisma.agendaItem.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
