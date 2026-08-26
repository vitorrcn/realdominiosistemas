import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, podeVerRelacoesComerciais } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/relacoes-comerciais?empresaId=&ramoId=
// Área restrita: só Diretoria + quem foi autorizado individualmente
// (Usuario.podeVerRelacoesComerciais) alimenta e consulta.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (!podeVerRelacoesComerciais(user.perfilGlobal, user.podeVerRelacoesComerciais))
    return NextResponse.json({ error: "Sem permissão para ver relações comerciais" }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const empresaId = searchParams.get("empresaId") || undefined;
  const ramoId = searchParams.get("ramoId") || undefined;

  const where: any = { deletedAt: null };
  if (empresaId) where.OR = [{ prestadorId: empresaId }, { tomadorId: empresaId }];
  if (ramoId) where.ramoId = ramoId;

  const relacoes = await prisma.relacaoComercial.findMany({
    where,
    orderBy: [{ data: "desc" }, { createdAt: "desc" }],
    include: {
      prestador: { select: { id: true, codigoInterno: true, razaoSocial: true } },
      tomador: { select: { id: true, codigoInterno: true, razaoSocial: true } },
      ramo: { select: { id: true, nome: true } },
      criadoPor: { select: { id: true, nome: true } },
    },
  });

  return NextResponse.json(relacoes);
}

// POST /api/relacoes-comerciais — criar
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (!podeVerRelacoesComerciais(user.perfilGlobal, user.podeVerRelacoesComerciais))
    return NextResponse.json({ error: "Sem permissão para cadastrar relações comerciais" }, { status: 403 });

  const body = await req.json();
  const { prestadorId, tomadorId, ramoId, descricao, valor, data, observacoes } = body;

  if (!prestadorId || !tomadorId)
    return NextResponse.json({ error: "Selecione o prestador e o tomador" }, { status: 400 });

  if (prestadorId === tomadorId)
    return NextResponse.json({ error: "Prestador e tomador não podem ser o mesmo cliente" }, { status: 400 });

  try {
    const relacao = await prisma.relacaoComercial.create({
      data: {
        prestadorId,
        tomadorId,
        ramoId: ramoId || null,
        descricao: descricao || null,
        valor: valor || null,
        data: data ? new Date(data) : null,
        observacoes: observacoes || null,
        criadoPorId: user.id,
      },
      include: {
        prestador: { select: { id: true, codigoInterno: true, razaoSocial: true } },
        tomador: { select: { id: true, codigoInterno: true, razaoSocial: true } },
        ramo: { select: { id: true, nome: true } },
        criadoPor: { select: { id: true, nome: true } },
      },
    });

    await prisma.auditoria.create({
      data: {
        usuarioId: user.id,
        entidadeTipo: "relacao_comercial",
        entidadeId: relacao.id,
        acao: "create",
        valorNovo: JSON.stringify({ prestadorId, tomadorId, ramoId, valor, descricao }),
      },
    });

    return NextResponse.json(relacao, { status: 201 });
  } catch (e: any) {
    console.error("Erro ao criar relação comercial:", e);
    return NextResponse.json({ error: "Erro ao criar relação comercial", detalhe: e?.message }, { status: 500 });
  }
}
