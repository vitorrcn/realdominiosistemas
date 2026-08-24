import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// GET /api/agenda?inicio=YYYY-MM-DD&fim=YYYY-MM-DD&setorId=&usuarioId=
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  const perfil = user.perfilGlobal;

  // Estagiário não tem acesso à tela de Agenda de jeito nenhum (só
  // Tarefas, do jeito como já está pra ele).
  if (perfil === "CONSULTA") {
    return NextResponse.json({ error: "Sem permissão para ver a agenda" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const inicio = searchParams.get("inicio");
  const fim = searchParams.get("fim");
  const setorId = searchParams.get("setorId") || undefined;
  const usuarioId = searchParams.get("usuarioId") || undefined;

  const where: Prisma.AgendaItemWhereInput = {};
  if (inicio && fim) {
    where.data = { gte: new Date(inicio), lte: new Date(fim + "T23:59:59") };
  }

  const meusSetoresIds = (user.setores ?? []).map((s: any) => s.setorId);

  if (perfil === "OPERADOR") {
    // Agenda é individual — só a própria, sem exceção.
    where.usuarioId = user.id;
  } else if (perfil === "LIDER") {
    // Só pessoas/compromissos do(s) próprio(s) setor(es).
    if (usuarioId) {
      const pertenceAoMeuSetor = await prisma.usuarioSetor.findFirst({
        where: { usuarioId, setorId: { in: meusSetoresIds } },
      });
      if (!pertenceAoMeuSetor) {
        return NextResponse.json({ error: "Sem permissão para ver a agenda dessa pessoa" }, { status: 403 });
      }
      where.usuarioId = usuarioId;
    } else if (setorId) {
      if (!meusSetoresIds.includes(setorId)) {
        return NextResponse.json({ error: "Sem permissão para ver esse setor" }, { status: 403 });
      }
      where.setorId = setorId;
    } else {
      const equipe = await prisma.usuarioSetor.findMany({
        where: { setorId: { in: meusSetoresIds } },
        select: { usuarioId: true },
      });
      where.OR = [
        { setorId: { in: meusSetoresIds } },
        { usuarioId: { in: equipe.map((u) => u.usuarioId) } },
      ];
    }
  } else {
    // Diretoria: vê tudo, respeitando os filtros normais se informados.
    if (setorId) where.setorId = setorId;
    if (usuarioId) where.usuarioId = usuarioId;
  }

  const itens = await prisma.agendaItem.findMany({
    where,
    orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
    include: {
      setor: { select: { id: true, nome: true } },
      usuario: { select: { id: true, nome: true } },
      criadoPor: { select: { id: true, nome: true } },
    },
  });

  return NextResponse.json(itens);
}

// POST /api/agenda — criar compromisso
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal === "CONSULTA")
    return NextResponse.json({ error: "Sem permissão para acessar a agenda" }, { status: 403 });

  const body = await req.json();
  const { titulo, descricao, data, horaInicio, horaFim, diaTodo, setorId, usuarioId, tipo } = body;

  if (!titulo || !data)
    return NextResponse.json({ error: "Título e data são obrigatórios" }, { status: 400 });

  if (!setorId && !usuarioId)
    return NextResponse.json({ error: "Escolha um setor ou um colaborador para o compromisso" }, { status: 400 });

  // ── Regras de permissão ──────────────────────────────────────
  const meusSetores: string[] = (user.setores ?? []).map((s: any) => s.setorId);
  const podeTudo = user.perfilGlobal === "DIRETORIA";

  if (!podeTudo) {
    if (user.perfilGlobal === "OPERADOR") {
      // Operador só cria/edita compromissos pessoais, dele mesmo
      if (setorId || (usuarioId && usuarioId !== user.id)) {
        return NextResponse.json(
          { error: "Como operador, você só pode criar compromissos na sua própria agenda pessoal" },
          { status: 403 }
        );
      }
    } else if (user.perfilGlobal === "LIDER") {
      // Líder só mexe no(s) setor(es) dele, ou em colaboradores desses setores
      if (setorId && !meusSetores.includes(setorId)) {
        return NextResponse.json({ error: "Você só pode criar compromissos para o seu próprio setor" }, { status: 403 });
      }
      if (usuarioId) {
        const colaborador = await prisma.usuarioSetor.findFirst({
          where: { usuarioId, setorId: { in: meusSetores } },
        });
        if (!colaborador && usuarioId !== user.id) {
          return NextResponse.json({ error: "Você só pode criar compromissos para colaboradores do seu setor" }, { status: 403 });
        }
      }
    }
  }

  try {
    const item = await prisma.agendaItem.create({
      data: {
        titulo,
        descricao: descricao || null,
        data: new Date(data),
        horaInicio: diaTodo ? null : (horaInicio || null),
        horaFim: diaTodo ? null : (horaFim || null),
        diaTodo: !!diaTodo,
        tipo: tipo === "REUNIAO" ? "REUNIAO" : "COMPROMISSO",
        setorId: setorId || null,
        usuarioId: usuarioId || null,
        criadoPorId: user.id,
      },
      include: {
        setor: { select: { id: true, nome: true } },
        usuario: { select: { id: true, nome: true } },
        criadoPor: { select: { id: true, nome: true } },
      },
    });

    // Reunião marcada para uma pessoa específica: avisa ela no painel de notificações
    if (item.tipo === "REUNIAO" && item.usuarioId && item.usuarioId !== user.id) {
      const dataFormatada = new Date(item.data).toLocaleDateString("pt-BR", { timeZone: "UTC" });
      await prisma.notificacao.create({
        data: {
          usuarioId: item.usuarioId,
          titulo: "Nova reunião agendada",
          mensagem: `${item.titulo} — ${dataFormatada}${item.horaInicio ? " às " + item.horaInicio : ""}`,
          entidadeTipo: "agenda",
          entidadeId: item.id,
        },
      });
    }

    return NextResponse.json(item, { status: 201 });
  } catch (e: any) {
    console.error("Erro ao criar compromisso:", e);
    return NextResponse.json({ error: "Erro ao criar compromisso", detalhe: e?.message }, { status: 500 });
  }
}
