import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT /api/empresas/[id]/contas-bancarias/[contaId]
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; contaId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { banco, agencia, numeroConta, ativa, extratoAte, observacoes } = body;

  if (!banco)
    return NextResponse.json({ error: "Informe o banco" }, { status: 400 });

  try {
    const conta = await prisma.contaBancaria.update({
      where: { id: params.contaId },
      data: {
        banco,
        agencia: agencia || null,
        numeroConta: numeroConta || null,
        ativa: ativa ?? true,
        extratoAte: extratoAte ? new Date(extratoAte) : null,
        observacoes: observacoes || null,
      },
    });
    return NextResponse.json(conta);
  } catch (e: any) {
    console.error("Erro ao atualizar conta bancária:", e);
    return NextResponse.json({ error: "Erro ao salvar", detalhe: e?.message }, { status: 500 });
  }
}

// DELETE /api/empresas/[id]/contas-bancarias/[contaId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; contaId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    await prisma.contaBancaria.delete({ where: { id: params.contaId } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Erro ao excluir conta bancária:", e);
    return NextResponse.json({ error: "Erro ao excluir", detalhe: e?.message }, { status: 500 });
  }
}
