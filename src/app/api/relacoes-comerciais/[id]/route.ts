import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, podeVerRelacoesComerciais } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT /api/relacoes-comerciais/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (!podeVerRelacoesComerciais(user.perfilGlobal, user.podeVerRelacoesComerciais))
    return NextResponse.json({ error: "Sem permissão para editar relações comerciais" }, { status: 403 });

  const body = await req.json();
  const { prestadorId, tomadorId, ramoId, descricao, valor, data, observacoes } = body;

  if (prestadorId && tomadorId && prestadorId === tomadorId)
    return NextResponse.json({ error: "Prestador e tomador não podem ser o mesmo cliente" }, { status: 400 });

  try {
    const relacao = await prisma.relacaoComercial.update({
      where: { id: params.id },
      data: {
        prestadorId: prestadorId || undefined,
        tomadorId: tomadorId || undefined,
        ramoId: ramoId !== undefined ? (ramoId || null) : undefined,
        descricao: descricao !== undefined ? (descricao || null) : undefined,
        valor: valor !== undefined ? (valor || null) : undefined,
        data: data !== undefined ? (data ? new Date(data) : null) : undefined,
        observacoes: observacoes !== undefined ? (observacoes || null) : undefined,
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
        acao: "update",
        valorNovo: JSON.stringify(body),
      },
    });

    return NextResponse.json(relacao);
  } catch (e: any) {
    console.error("Erro ao atualizar relação comercial:", e);
    return NextResponse.json({ error: "Erro ao salvar relação comercial", detalhe: e?.message }, { status: 500 });
  }
}

// DELETE /api/relacoes-comerciais/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (!podeVerRelacoesComerciais(user.perfilGlobal, user.podeVerRelacoesComerciais))
    return NextResponse.json({ error: "Sem permissão para excluir relações comerciais" }, { status: 403 });

  await prisma.relacaoComercial.update({
    where: { id: params.id },
    data: { deletedAt: new Date() },
  });

  await prisma.auditoria.create({
    data: {
      usuarioId: user.id,
      entidadeTipo: "relacao_comercial",
      entidadeId: params.id,
      acao: "delete",
    },
  });

  return NextResponse.json({ ok: true });
}
