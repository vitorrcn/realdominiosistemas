import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { filtroCarteira } from "@/lib/auth";
import { avisarEquipeDoSetor, resolverDestinatariosGrupo, emailNovoEventoHtml, enviarEmail, GrupoEmail } from "@/lib/mail";

// GET /api/eventos?status=&setorId=&empresaId=&minhaCarteira=true
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

    const where: any = { deletedAt: null };
    if (status) where.status = status;
    if (empresaId) where.empresaId = empresaId;

    // Operador só vê eventos do(s) próprio(s) setor(es) — mesmo os que são
    // de outros colegas do mesmo setor. Diretoria e Estagiário veem tudo.
    // Mordomo(a) também só vê o próprio setor, EXCETO nas empresas em que
    // ele é o mordomo responsável, onde vê eventos de qualquer setor.
    const podeVerTudoSempre = ["DIRETORIA", "CONSULTA"].includes(user.perfilGlobal);
    const ehMordomo = user.perfilGlobal === "LIDER";
    const restritoAoSetor = !podeVerTudoSempre;
    const meusSetoresIds = (user.setores ?? []).map((s: any) => s.setorId);
    const condicoesExtras: any[] = [];

    if (setorId) {
      if (restritoAoSetor && !meusSetoresIds.includes(setorId)) {
        if (!ehMordomo) {
          return NextResponse.json({ error: "Sem permissão para ver esse setor" }, { status: 403 });
        }
        condicoesExtras.push({ empresa: { respLiderId: user.id } });
      }
      where.setorAtualId = setorId;
    } else if (restritoAoSetor) {
      if (ehMordomo) {
        condicoesExtras.push({
          OR: [
            { setorAtualId: { in: meusSetoresIds } },
            { empresa: { respLiderId: user.id } },
          ],
        });
      } else {
        where.setorAtualId = { in: meusSetoresIds };
      }
    }

    if (minhaCarteira) {
      const restricao = filtroCarteira(user.id, user.perfilGlobal, user.setores ?? []);
      if (restricao.OR) condicoesExtras.push(restricao);
    }

    if (condicoesExtras.length > 0) where.AND = condicoesExtras;

    const eventos = await prisma.evento.findMany({
      where,
      orderBy: [{ status: "asc" }, { prazo: "asc" }],
      include: {
        empresa: { select: { id: true, codigoInterno: true, razaoSocial: true } },
        tipoEvento: { select: { id: true, nome: true } },
        setorAtual: { select: { id: true, nome: true } },
        respAtual: { select: { id: true, nome: true } },
      },
    });

    return NextResponse.json(eventos);
  } catch (e: any) {
    console.error("Erro ao listar eventos:", e);
    return NextResponse.json({ error: "Erro ao carregar eventos", detalhe: e?.message }, { status: 500 });
  }
}

// POST /api/eventos
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;

  try {
    const body = await req.json();
    const { empresaId, tipoEventoNome, setorAtualId, respAtualId, respGeralId, prazo, observacoes, enviarEmail: querEmail, gruposEmail } = body;

    if (!empresaId || !tipoEventoNome)
      return NextResponse.json({ error: "Empresa e tipo de evento são obrigatórios" }, { status: 400 });

    // Acha ou cria o tipo de evento (por nome, dentro do setor informado)
    let tipoEvento = await prisma.tipoEvento.findFirst({
      where: { nome: tipoEventoNome, setorId: setorAtualId || null },
    });
    if (!tipoEvento) {
      tipoEvento = await prisma.tipoEvento.create({
        data: { nome: tipoEventoNome, setorId: setorAtualId || null },
      });
    }

    const evento = await prisma.evento.create({
      data: {
        empresaId,
        tipoEventoId: tipoEvento.id,
        setorAtualId: setorAtualId || null,
        respAtualId: respAtualId || null,
        respGeralId: respGeralId || user.id,
        criadoPorId: user.id,
        prazo: prazo ? new Date(prazo) : null,
        observacoes: observacoes || null,
        status: "NAO_INICIADO",
      },
    });

    await prisma.eventoHistorico.create({
      data: {
        eventoId: evento.id,
        usuarioId: user.id,
        descricao: "Evento criado",
        statusNovo: "NAO_INICIADO",
      },
    });

    if (respAtualId) {
      const prazoTxto = evento.prazo ? new Date(evento.prazo).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "sem prazo definido";
      await avisarEquipeDoSetor({
        setorId: setorAtualId || null,
        responsavelId: respAtualId,
        criadorId: user.id,
        titulo: "Novo evento atribuído",
        mensagem: `${tipoEventoNome} — prazo: ${prazoTxto}`,
        entidadeTipo: "evento",
        entidadeId: evento.id,
      });
    }

    // Envio de e-mail opcional pra grupos escolhidos na criação (além do
    // aviso automático ao responsável/líderes/coordenadores acima).
    if (querEmail && Array.isArray(gruposEmail) && gruposEmail.length > 0) {
      try {
        const [empresa, setor, responsavel] = await Promise.all([
          prisma.empresa.findUnique({ where: { id: empresaId }, select: { codigoInterno: true, razaoSocial: true } }),
          setorAtualId ? prisma.setor.findUnique({ where: { id: setorAtualId }, select: { nome: true } }) : null,
          respAtualId ? prisma.usuario.findUnique({ where: { id: respAtualId }, select: { nome: true } }) : null,
        ]);
        const destinatarios = await resolverDestinatariosGrupo({
          grupos: gruposEmail as GrupoEmail[],
          setorId: setorAtualId || null,
          empresaId,
          excluirUsuarioId: user.id,
        });
        const html = emailNovoEventoHtml({
          tipo: tipoEventoNome,
          empresa: empresa ? `${empresa.codigoInterno} - ${empresa.razaoSocial}` : "-",
          setor: setor?.nome ?? null,
          responsavel: responsavel?.nome ?? null,
          prazo: evento.prazo ? new Date(evento.prazo).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : null,
          observacoes: observacoes || null,
          criadoPor: user.name ?? "Sistema",
          url: `${process.env.NEXTAUTH_URL || ""}/eventos/${evento.id}`,
        });
        for (const d of destinatarios) {
          await enviarEmail({ para: d.email, assunto: `Novo evento: ${tipoEventoNome}`, html });
        }
      } catch (e) {
        console.error("Erro ao enviar e-mail de novo evento:", e);
      }
    }

    return NextResponse.json(evento, { status: 201 });
  } catch (e: any) {
    console.error("Erro ao criar evento:", e);
    return NextResponse.json({ error: "Erro ao criar evento", detalhe: e?.message }, { status: 500 });
  }
}
