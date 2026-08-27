import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/empresas/[id]/alteracoes-contratuais
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const alteracoes = await prisma.alteracaoContratual.findMany({
    where: { empresaId: params.id },
    orderBy: { data: "desc" },
    include: { criadoPor: { select: { id: true, nome: true } } },
  });

  return NextResponse.json(
    alteracoes.map((a) => ({
      id: a.id,
      data: a.data,
      descricao: a.descricao,
      criadoPor: a.criadoPor.nome,
      createdAt: a.createdAt,
    }))
  );
}

// POST /api/empresas/[id]/alteracoes-contratuais
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  const body = await req.json();
  const { data, descricao } = body;

  if (!data || !descricao?.trim())
    return NextResponse.json({ error: "Data e descrição são obrigatórias" }, { status: 400 });

  try {
    const alteracao = await prisma.alteracaoContratual.create({
      data: {
        empresaId: params.id,
        data: new Date(data),
        descricao: descricao.trim(),
        criadoPorId: user.id,
      },
    });
    return NextResponse.json({ id: alteracao.id }, { status: 201 });
  } catch (e: any) {
    console.error("Erro ao criar alteração contratual:", e);
    return NextResponse.json({ error: "Erro ao salvar alteração contratual", detalhe: e?.message }, { status: 500 });
  }
}
