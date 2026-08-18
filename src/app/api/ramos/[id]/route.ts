import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT /api/ramos/[id] — renomear ou ativar/desativar (somente Diretoria)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal !== "DIRETORIA")
    return NextResponse.json({ error: "Somente a Diretoria pode gerenciar os ramos" }, { status: 403 });

  const body = await req.json();

  try {
    const ramo = await prisma.ramoEmpresa.update({
      where: { id: params.id },
      data: {
        nome: body.nome !== undefined ? body.nome.trim() : undefined,
        ativo: body.ativo !== undefined ? !!body.ativo : undefined,
        ordem: body.ordem !== undefined ? body.ordem : undefined,
      },
    });
    return NextResponse.json(ramo);
  } catch (e: any) {
    if (e?.code === "P2002")
      return NextResponse.json({ error: "Já existe um ramo com esse nome" }, { status: 409 });
    console.error("Erro ao atualizar ramo:", e);
    return NextResponse.json({ error: "Erro ao atualizar ramo" }, { status: 500 });
  }
}
