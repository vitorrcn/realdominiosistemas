import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { filtroCarteira } from "@/lib/auth";
import { avisarEquipeDoSetor } from "@/lib/mail";

// GET /api/tarefas?status=&setorId=&empresaId=&minhaCarteira=true&minhas=true
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const user = session.user as any;
    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status") || undefined;
    const setorId = searchParams.get("setorId") || undefined;
    const empresaId = searchParams.get("empresaId") || undefined;
    const minhaCarteira = searchParams.get("minhaCarteira") === "true";
    const minhas = searchParams.get("minhas") === "true";

    const where: any = { deletedAt: null };
    if (status) where.status = status;
    if (empresaId) where.empresaId = empresaId;
    if (minhas) where.responsavelId = user.id;

    // Operador e Líder só veem tarefas do(s) próprio(s) setor(es) —
    // mesmo as que são de outros colegas do mesmo setor. Diretoria e
    // Coordenador veem tudo.
    const restritoAoSetor = !["DIRETORIA", "COORDENADOR"].includes(user.perfilGlobal);
    const meusSetoresIds = (user.setores ?? []).map((s: any) => s.setorId);

    if (setorId) {
      // Se pediu um setor específico, só libera se for um dos dele
      // (ou se puder ver tudo)
      if (restritoAoSetor && !meusSetoresIds.includes(setorId)) {
        return NextResponse.json({ error: "Sem permissão para ver esse setor" }, { status: 403 });
      }
      where.setorId = setorId;
    } else if (restritoAoSetor) {
      where.setorId = { in: meusSetoresIds };
    }

    if (minhaCarteira) {
      const restricao = filtroCarteira(user.id, user.perfilGlobal, user.setores ?? []);
      if (restricao.OR) where.empresa = restricao;
    }

    const tarefas = await prisma.tarefa.findMany({
      where,
      orderBy: [{ status: "asc" }, { prazo: "asc" }],
      include: {
        empresa: { select: { id: true, codigoInterno: true, razaoSocial: true } },
        setor: { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true } },
      },
    });

    return NextResponse.json(tarefas);
  } catch (e: any) {
    console.error("Erro ao listar tarefas:", e);
    return NextResponse.json({ error: "Erro ao carregar tarefas", detalhe: e?.message }, { status: 500 });
  }
}

// POST /api/tarefas
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal === "CONSULTA")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  try {
    const body = await req.json();
    const { empresaId, titulo, descricao, setorId, responsavelId, dataInicio, prazo } = body;

    if (!empresaId || !titulo)
      return NextResponse.json({ error: "Empresa e título são obrigatórios" }, { status: 400 });

    const tarefa = await prisma.tarefa.create({
      data: {
        empresaId,
        titulo,
        descricao: descricao || null,
        setorId: setorId || null,
        responsavelId: responsavelId || null,
        dataInicio: dataInicio ? new Date(dataInicio) : null,
        prazo: prazo ? new Date(prazo) : null,
        status: "NAO_INICIADO",
      },
    });

    if (responsavelId) {
      const prazoTxto = prazo ? new Date(prazo).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "sem prazo definido";
      await avisarEquipeDoSetor({
        setorId: setorId || null,
        responsavelId,
        criadorId: user.id,
        titulo: "Nova tarefa atribuída",
        mensagem: `${titulo} — prazo: ${prazoTxto}`,
        entidadeTipo: "tarefa",
        entidadeId: tarefa.id,
      });
    }

    return NextResponse.json(tarefa, { status: 201 });
  } catch (e: any) {
    console.error("Erro ao criar tarefa:", e);
    return NextResponse.json({ error: "Erro ao criar tarefa", detalhe: e?.message }, { status: 500 });
  }
}
