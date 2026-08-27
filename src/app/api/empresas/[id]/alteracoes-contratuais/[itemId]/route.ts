import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/empresas/[id]/alteracoes-contratuais/[itemId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  await prisma.alteracaoContratual.delete({ where: { id: params.itemId, empresaId: params.id } });
  return NextResponse.json({ ok: true });
}
