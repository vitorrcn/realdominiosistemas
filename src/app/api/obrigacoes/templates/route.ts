import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/obrigacoes/templates?setorId=xxx (uma aba/setor)
// GET /api/obrigacoes/templates?todos=true (visão geral de gestão, todos os setores)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const setorId = req.nextUrl.searchParams.get("setorId");
  const todos = req.nextUrl.searchParams.get("todos") === "true";

  if (!setorId && !todos)
    return NextResponse.json({ error: "Parâmetro setorId obrigatório" }, { status: 400 });

  const templates = await prisma.obrigacaoTemplate.findMany({
    where: todos ? {} : { setorId: setorId!, ativo: true },
    orderBy: [{ setor: { ordem: "asc" } }, { ordem: "asc" }],
    include: {
      _count: { select: { empresas: { where: { ativa: true } } } },
      ...(todos && { setor: { select: { id: true, nome: true } } }),
    },
  });

  return NextResponse.json(
    templates.map((t: any) => ({
      id: t.id,
      nome: t.nome,
      descricao: t.descricao,
      ativo: t.ativo,
      qtdEmpresas: t._count.empresas,
      setor: t.setor ?? undefined,
      diaVencimento: t.diaVencimento,
      vencimentoMesSeguinte: t.vencimentoMesSeguinte,
    }))
  );
}

// POST /api/obrigacoes/templates — criar nova obrigação dentro de um setor
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal === "CONSULTA" || user.perfilGlobal === "OPERADOR")
    return NextResponse.json({ error: "Sem permissão para criar obrigações" }, { status: 403 });

  const body = await req.json();
  const { setorId, nome, descricao, diaVencimento, vencimentoMesSeguinte } = body;

  if (!setorId || !nome)
    return NextResponse.json({ error: "Setor e nome são obrigatórios" }, { status: 400 });

  try {
    const ultimo = await prisma.obrigacaoTemplate.findFirst({
      where: { setorId },
      orderBy: { ordem: "desc" },
    });

    const template = await prisma.obrigacaoTemplate.create({
      data: {
        setorId,
        nome,
        descricao: descricao || null,
        ordem: (ultimo?.ordem ?? 0) + 1,
        diaVencimento: diaVencimento ? Number(diaVencimento) : null,
        vencimentoMesSeguinte: !!vencimentoMesSeguinte,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (e: any) {
    console.error("Erro ao criar obrigação:", e);
    return NextResponse.json({ error: "Erro ao criar obrigação", detalhe: e?.message }, { status: 500 });
  }
}
