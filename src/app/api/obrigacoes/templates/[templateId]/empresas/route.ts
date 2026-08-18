import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { garantirInstanciaCompetenciaAtual } from "@/lib/obrigacoes";

// GET /api/obrigacoes/templates/[templateId]/empresas?q=busca
// Lista todas as empresas ativas, com um flag indicando se já estão
// vinculadas a este template.
export async function GET(
  req: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q") || undefined;

  const [empresas, vinculos] = await Promise.all([
    prisma.empresa.findMany({
      where: {
        deletedAt: null,
        ativo: true,
        ...(q && {
          OR: [
            { razaoSocial: { contains: q, mode: "insensitive" } },
            { codigoInterno: { contains: q, mode: "insensitive" } },
          ],
        }),
      },
      orderBy: { codigoInterno: "asc" },
      take: 100,
      select: { id: true, codigoInterno: true, razaoSocial: true },
    }),
    prisma.obrigacaoEmpresa.findMany({ where: { templateId: params.templateId } }),
  ]);

  const mapaVinculos = new Map(vinculos.map((v) => [v.empresaId, v.ativa]));

  return NextResponse.json(
    empresas.map((e) => ({
      id: e.id,
      codigoInterno: e.codigoInterno,
      razaoSocial: e.razaoSocial,
      vinculada: mapaVinculos.get(e.id) ?? false,
    }))
  );
}

// POST /api/obrigacoes/templates/[templateId]/empresas
// body: { empresaId, ativa }
export async function POST(
  req: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (["CONSULTA", "OPERADOR"].includes(user.perfilGlobal))
    return NextResponse.json({ error: "Sem permissão para vincular empresas" }, { status: 403 });

  const { empresaId, ativa } = await req.json();
  if (!empresaId)
    return NextResponse.json({ error: "empresaId é obrigatório" }, { status: 400 });

  try {
    const template = await prisma.obrigacaoTemplate.findUnique({ where: { id: params.templateId } });
    if (!template)
      return NextResponse.json({ error: "Obrigação não encontrada" }, { status: 404 });

    const vinculo = await prisma.obrigacaoEmpresa.upsert({
      where: { empresaId_templateId: { empresaId, templateId: params.templateId } },
      update: { ativa: !!ativa },
      create: {
        empresaId,
        templateId: params.templateId,
        setorId: template.setorId,
        ativa: !!ativa,
      },
    });

    // Ativou o vínculo → já gera a pendência do mês atual, sem depender
    // de alguém clicar em "Gerar competência do mês" depois.
    if (vinculo.ativa) {
      await garantirInstanciaCompetenciaAtual(vinculo.id);
    }

    return NextResponse.json(vinculo);
  } catch (e: any) {
    console.error("Erro ao vincular empresa à obrigação:", e);
    return NextResponse.json({ error: "Erro ao salvar", detalhe: e?.message }, { status: 500 });
  }
}
