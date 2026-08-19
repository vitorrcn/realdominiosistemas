import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/empresas/[id]/obrigacoes-config?setorId=xxx
// Lista os templates daquele setor com um flag indicando se já estão
// vinculados (ativos) a esta empresa. Funciona pra empresa em qualquer
// status, inclusive Cadastro Incompleto.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const setorId = req.nextUrl.searchParams.get("setorId");
  if (!setorId)
    return NextResponse.json({ error: "Parâmetro setorId obrigatório" }, { status: 400 });

  const [templates, vinculos] = await Promise.all([
    prisma.obrigacaoTemplate.findMany({
      where: { setorId, ativo: true },
      orderBy: { ordem: "asc" },
    }),
    prisma.obrigacaoEmpresa.findMany({
      where: { empresaId: params.id, template: { setorId } },
    }),
  ]);

  const mapaVinculos = new Map(vinculos.map((v) => [v.templateId, v.ativa]));

  return NextResponse.json(
    templates.map((t) => ({
      id: t.id,
      nome: t.nome,
      vinculada: mapaVinculos.get(t.id) ?? false,
    }))
  );
}

// POST /api/empresas/[id]/obrigacoes-config
// body: { templateId, ativa }
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { templateId, ativa } = await req.json();
  if (!templateId)
    return NextResponse.json({ error: "templateId é obrigatório" }, { status: 400 });

  try {
    const template = await prisma.obrigacaoTemplate.findUnique({ where: { id: templateId } });
    if (!template)
      return NextResponse.json({ error: "Template não encontrado" }, { status: 404 });

    const vinculo = await prisma.obrigacaoEmpresa.upsert({
      where: { empresaId_templateId: { empresaId: params.id, templateId } },
      update: { ativa: !!ativa },
      create: {
        empresaId: params.id,
        templateId,
        setorId: template.setorId,
        ativa: !!ativa,
      },
    });

    return NextResponse.json(vinculo);
  } catch (e: any) {
    console.error("Erro ao configurar obrigação:", e);
    return NextResponse.json({ error: "Erro ao salvar", detalhe: e?.message }, { status: 500 });
  }
}
