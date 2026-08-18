import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT /api/setores/[id] — renomear ou ativar/desativar (só Diretoria)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal !== "DIRETORIA")
    return NextResponse.json({ error: "Somente a Diretoria pode gerenciar setores" }, { status: 403 });

  const body = await req.json();

  try {
    const setor = await prisma.setor.update({
      where: { id: params.id },
      data: {
        nome: body.nome !== undefined ? body.nome.trim() : undefined,
        descricao: body.descricao !== undefined ? (body.descricao || null) : undefined,
        ativo: body.ativo !== undefined ? !!body.ativo : undefined,
      },
    });
    return NextResponse.json(setor);
  } catch (e: any) {
    if (e?.code === "P2002")
      return NextResponse.json({ error: "Já existe um setor com esse nome" }, { status: 409 });
    console.error("Erro ao atualizar setor:", e);
    return NextResponse.json({ error: "Erro ao atualizar setor" }, { status: 500 });
  }
}
