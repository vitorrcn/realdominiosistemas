import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/empresas/[id]/contas-bancarias
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const contabil = await prisma.contabil.findUnique({ where: { empresaId: params.id }, select: { id: true } });
  if (!contabil) return NextResponse.json([]);

  const contas = await prisma.contaBancaria.findMany({
    where: { contabilId: contabil.id },
    orderBy: [{ ativa: "desc" }, { banco: "asc" }],
  });
  return NextResponse.json(contas);
}

// POST /api/empresas/[id]/contas-bancarias
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { banco, agencia, numeroConta, ativa, extratoAte, observacoes } = body;

  if (!banco)
    return NextResponse.json({ error: "Informe o banco" }, { status: 400 });

  try {
    // O registro Contabil pode ainda não existir (aba Contábil nunca foi
    // salva pra essa empresa) — cria vazio na hora se precisar.
    const contabil = await prisma.contabil.upsert({
      where: { empresaId: params.id },
      update: {},
      create: { empresaId: params.id },
    });

    const conta = await prisma.contaBancaria.create({
      data: {
        contabilId: contabil.id,
        banco,
        agencia: agencia || null,
        numeroConta: numeroConta || null,
        ativa: ativa ?? true,
        extratoAte: extratoAte ? new Date(extratoAte) : null,
        observacoes: observacoes || null,
      },
    });
    return NextResponse.json(conta, { status: 201 });
  } catch (e: any) {
    console.error("Erro ao criar conta bancária:", e);
    return NextResponse.json({ error: "Erro ao salvar conta bancária", detalhe: e?.message }, { status: 500 });
  }
}
