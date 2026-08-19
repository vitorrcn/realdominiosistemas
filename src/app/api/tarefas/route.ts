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

    // Operador só vê tarefas do(s) próprio(s) setor(es) — mesmo as que são
    // de outros colegas do mesmo setor. Diretoria, Coordenador e
    // Estagiário veem tudo (o Estagiário não tem carteira própria, ele
    // auxilia em todas). Mordomo(a) também só vê o próprio setor, EXCETO
    // nas empresas em que ele é o mordomo responsável, onde vê tudo,
    // inclusive tarefas de outros setores.
    const podeVerTudoSempre = ["DIRETORIA", "COORDENADOR", "CONSULTA"].includes(user.perfilGlobal);
    const ehMordomo = user.perfilGlobal === "LIDER";
    const restritoAoSetor = !podeVerTudoSempre;
    const meusSetoresIds = (user.setores ?? []).map((s: any) => s.setorId);
    const condicoesExtras: any[] = [];

    if (setorId) {
      // Se pediu um setor específico, só libera se for um dos dele
      // (ou se puder ver tudo, ou for mordomo de alguma empresa)
      if (restritoAoSetor && !meusSetoresIds.includes(setorId)) {
        if (!ehMordomo) {
          return NextResponse.json({ error: "Sem permissão para ver esse setor" }, { status: 403 });
        }
        // Mordomo(a): libera esse setor específico só pras empresas onde ele é o mordomo
        condicoesExtras.push({ empresa: { respLiderId: user.id } });
      }
      where.setorId = setorId;
    } else if (restritoAoSetor) {
      if (ehMordomo) {
        condicoesExtras.push({
          OR: [
            { setorId: { in: meusSetoresIds } },
            { empresa: { respLiderId: user.id } },
          ],
        });
      } else {
        where.setorId = { in: meusSetoresIds };
      }
    }

    if (minhaCarteira) {
      const restricao = filtroCarteira(user.id, user.perfilGlobal, user.setores ?? []);
      if (restricao.OR) condicoesExtras.push(restricao);
    }

    if (condicoesExtras.length > 0) where.AND = condicoesExtras;

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
