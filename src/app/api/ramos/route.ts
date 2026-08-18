import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/ramos — lista aberta a qualquer usuário logado (usada no select do Contábil)
// GET /api/ramos?todos=true — lista completa (inclui inativos), somente Diretoria (tela de gestão)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  const todos = req.nextUrl.searchParams.get("todos") === "true";

  if (todos && user.perfilGlobal !== "DIRETORIA")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const ramos = await prisma.ramoEmpresa.findMany({
    where: todos ? {} : { ativo: true },
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    select: todos
      ? { id: true, nome: true, ativo: true, ordem: true, _count: { select: { empresas: true } } }
      : { id: true, nome: true },
  });

  return NextResponse.json(ramos);
}

// POST /api/ramos — criar novo ramo (somente Diretoria)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal !== "DIRETORIA")
    return NextResponse.json({ error: "Somente a Diretoria pode gerenciar os ramos" }, { status: 403 });

  const body = await req.json();
  if (!body.nome)
    return NextResponse.json({ error: "Nome do ramo é obrigatório" }, { status: 400 });

  try {
    const ramo = await prisma.ramoEmpresa.create({
      data: { nome: body.nome.trim(), ordem: body.ordem ?? 0 },
    });
    return NextResponse.json(ramo, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002")
      return NextResponse.json({ error: "Já existe um ramo com esse nome" }, { status: 409 });
    console.error("Erro ao criar ramo:", e);
    return NextResponse.json({ error: "Erro ao criar ramo" }, { status: 500 });
  }
}
