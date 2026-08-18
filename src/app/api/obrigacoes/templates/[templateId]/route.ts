import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT /api/obrigacoes/templates/[templateId] — renomear ou ativar/desativar
export async function PUT(
  req: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (["CONSULTA", "OPERADOR"].includes(user.perfilGlobal))
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json();

  try {
    const template = await prisma.obrigacaoTemplate.update({
      where: { id: params.templateId },
      data: {
        nome: body.nome !== undefined ? body.nome.trim() : undefined,
        descricao: body.descricao !== undefined ? (body.descricao || null) : undefined,
        ativo: body.ativo !== undefined ? !!body.ativo : undefined,
      },
    });
    return NextResponse.json(template);
  } catch (e: any) {
    console.error("Erro ao atualizar template de obrigação:", e);
    return NextResponse.json({ error: "Erro ao atualizar obrigação" }, { status: 500 });
  }
}
