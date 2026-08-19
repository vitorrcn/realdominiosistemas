import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { criptografar } from "@/lib/crypto";

// PUT /api/empresas/[id]/acessos/[acessoId]
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; acessoId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();

  try {
    const dados: any = {
      nomeSistema: body.nomeSistema,
      link: body.link || null,
      usuario: body.usuario || null,
      observacao: body.observacao || null,
    };
    // Só mexe na senha se uma nova foi digitada — string vazia mantém a atual
    if (body.senha) dados.senhaCifrada = criptografar(body.senha);

    await prisma.acessoSistema.update({
      where: { id: params.acessoId, empresaId: params.id },
      data: dados,
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Erro ao atualizar acesso:", e);
    return NextResponse.json({ error: "Erro ao salvar acesso", detalhe: e?.message }, { status: 500 });
  }
}

// DELETE /api/empresas/[id]/acessos/[acessoId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; acessoId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  await prisma.acessoSistema.delete({ where: { id: params.acessoId, empresaId: params.id } });
  return NextResponse.json({ ok: true });
}
