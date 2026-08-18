import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { garantirInstanciaCompetenciaAtual } from "@/lib/obrigacoes";

// POST /api/obrigacoes/templates/[templateId]/vincular-todos
// Vincula TODOS os clientes ativos de uma vez a essa obrigação.
export async function POST(
  req: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (["CONSULTA", "OPERADOR"].includes(user.perfilGlobal))
    return NextResponse.json({ error: "Sem permissão para vincular clientes em massa" }, { status: 403 });

  try {
    const template = await prisma.obrigacaoTemplate.findUnique({ where: { id: params.templateId } });
    if (!template)
      return NextResponse.json({ error: "Obrigação não encontrada" }, { status: 404 });

    const empresas = await prisma.empresa.findMany({
      where: { deletedAt: null, ativo: true },
      select: { id: true },
    });

    let vinculadas = 0;
    for (const empresa of empresas) {
      const vinculo = await prisma.obrigacaoEmpresa.upsert({
        where: { empresaId_templateId: { empresaId: empresa.id, templateId: params.templateId } },
        update: { ativa: true },
        create: {
          empresaId: empresa.id,
          templateId: params.templateId,
          setorId: template.setorId,
          ativa: true,
        },
      });
      // Já gera a pendência do mês atual pra cada empresa vinculada, sem
      // depender de alguém clicar em "Gerar competência do mês" depois.
      await garantirInstanciaCompetenciaAtual(vinculo.id);
      vinculadas++;
    }

    return NextResponse.json({ ok: true, vinculadas });
  } catch (e: any) {
    console.error("Erro ao vincular todos os clientes:", e);
    return NextResponse.json({ error: "Erro ao vincular clientes", detalhe: e?.message }, { status: 500 });
  }
}
