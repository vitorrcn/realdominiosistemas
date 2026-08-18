import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/setores — lista aberta (só ativos)
// GET /api/setores?todos=true — lista completa (com inativos), só Diretoria
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  const todos = req.nextUrl.searchParams.get("todos") === "true";

  if (todos && user.perfilGlobal !== "DIRETORIA")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const setores = await prisma.setor.findMany({
    where: todos ? {} : { ativo: true },
    orderBy: { ordem: "asc" },
    select: todos
      ? { id: true, nome: true, descricao: true, ativo: true, ordem: true, _count: { select: { usuarios: true, obrigacaoTemplates: true } } }
      : { id: true, nome: true, descricao: true },
  });

  return NextResponse.json(setores);
}

// POST /api/setores — criar novo setor (só Diretoria)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal !== "DIRETORIA")
    return NextResponse.json({ error: "Somente a Diretoria pode gerenciar setores" }, { status: 403 });

  const body = await req.json();
  if (!body.nome)
    return NextResponse.json({ error: "Nome do setor é obrigatório" }, { status: 400 });

  try {
    const ultimo = await prisma.setor.findFirst({ orderBy: { ordem: "desc" } });
    const setor = await prisma.setor.create({
      data: { nome: body.nome.trim(), descricao: body.descricao || null, ordem: (ultimo?.ordem ?? 0) + 1 },
    });
    return NextResponse.json(setor, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002")
      return NextResponse.json({ error: "Já existe um setor com esse nome" }, { status: 409 });
    console.error("Erro ao criar setor:", e);
    return NextResponse.json({ error: "Erro ao criar setor" }, { status: 500 });
  }
}
