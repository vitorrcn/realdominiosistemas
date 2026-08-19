import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT /api/atividades/[id] — renomear, editar ou ativar/desativar (somente Diretoria)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal !== "DIRETORIA")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json();

  try {
    const atividade = await prisma.atividade.update({
      where: { id: params.id },
      data: {
        nome: body.nome !== undefined ? body.nome.trim() : undefined,
        descricao: body.descricao !== undefined ? (body.descricao || null) : undefined,
        exigeCliente: body.exigeCliente !== undefined ? !!body.exigeCliente : undefined,
        exigeQuantidade: body.exigeQuantidade !== undefined ? !!body.exigeQuantidade : undefined,
        unidadeQuantidade: body.unidadeQuantidade !== undefined ? (body.unidadeQuantidade?.trim() || null) : undefined,
        ativo: body.ativo !== undefined ? !!body.ativo : undefined,
      },
    });
    return NextResponse.json(atividade);
  } catch (e: any) {
    if (e?.code === "P2002")
      return NextResponse.json({ error: "Já existe uma atividade com esse nome" }, { status: 409 });
    console.error("Erro ao atualizar atividade:", e);
    return NextResponse.json({ error: "Erro ao atualizar atividade" }, { status: 500 });
  }
}
