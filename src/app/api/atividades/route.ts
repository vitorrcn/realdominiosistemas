import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/atividades — lista aberta a qualquer usuário logado (usada no
// select do apontamento de horas).
// GET /api/atividades?todos=true — lista completa (inclui inativas),
// somente Diretoria (tela de gestão).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  const todos = req.nextUrl.searchParams.get("todos") === "true";

  if (todos && user.perfilGlobal !== "DIRETORIA")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const atividades = await prisma.atividade.findMany({
    where: todos ? {} : { ativo: true },
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    select: todos
      ? { id: true, nome: true, descricao: true, exigeCliente: true, ativo: true, ordem: true, _count: { select: { registros: true } } }
      : { id: true, nome: true, descricao: true, exigeCliente: true },
  });

  return NextResponse.json(atividades);
}

// POST /api/atividades — criar nova atividade (somente Diretoria)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal !== "DIRETORIA")
    return NextResponse.json({ error: "Somente a Diretoria pode gerenciar as atividades" }, { status: 403 });

  const body = await req.json();
  if (!body.nome?.trim())
    return NextResponse.json({ error: "Nome da atividade é obrigatório" }, { status: 400 });

  try {
    const ultima = await prisma.atividade.findFirst({ orderBy: { ordem: "desc" } });
    const atividade = await prisma.atividade.create({
      data: {
        nome: body.nome.trim(),
        descricao: body.descricao || null,
        exigeCliente: !!body.exigeCliente,
        ordem: (ultima?.ordem ?? 0) + 1,
      },
    });
    return NextResponse.json(atividade, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002")
      return NextResponse.json({ error: "Já existe uma atividade com esse nome" }, { status: 409 });
    console.error("Erro ao criar atividade:", e);
    return NextResponse.json({ error: "Erro ao criar atividade" }, { status: 500 });
  }
}
