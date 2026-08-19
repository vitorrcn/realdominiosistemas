import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { empresaVisivelNaCompetenciaWhere } from "@/lib/obrigacoes";

// Setor da obrigação → campo de responsável correspondente na Empresa.
// O filtro de "carteira" desta planilha precisa olhar o responsável do
// MESMO setor da obrigação (ex.: obrigação Contábil → respContabilId) —
// não um campo genérico de "operador responsável" desconectado do setor.
const SETOR_RESP_FIELD: Record<string, "respFiscalId" | "respContabilId" | "respDpId" | "respSocietId"> = {
  "Fiscal": "respFiscalId",
  "Contábil": "respContabilId",
  "Departamento Pessoal": "respDpId",
  "Societário": "respSocietId",
};

function competenciaMaisMeses(base: string, delta: number): string {
  const [ano, mes] = base.split("-").map(Number);
  const d = new Date(ano, mes - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function competenciaAtual(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

// GET /api/obrigacoes/templates/[templateId]/planilha?mesBase=2026-05
// Devolve as empresas vinculadas a essa obrigação e o status de cada uma
// nos 3 meses a partir de mesBase (ou do mês atual, se não informado).
export async function GET(
  req: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const user = session.user as any;
    const mesBase = req.nextUrl.searchParams.get("mesBase") || competenciaAtual();
    const competencias = [0, 1, 2].map((i) => competenciaMaisMeses(mesBase, i));

    // Operador só pode ver a própria carteira, não importa o que pedir na URL.
    // Níveis acima (Líder/Coordenador/Diretoria) têm liberdade de escolher
    // qualquer carteira, ou ver todo mundo (sem filtro).
    let carteiraId = req.nextUrl.searchParams.get("carteiraId") || undefined;
    if (user.perfilGlobal === "OPERADOR") carteiraId = user.id;

    const template = await prisma.obrigacaoTemplate.findUnique({
      where: { id: params.templateId },
      select: { id: true, nome: true, setorId: true, setor: { select: { nome: true } } },
    });
    if (!template)
      return NextResponse.json({ error: "Obrigação não encontrada" }, { status: 404 });

    // Campo de responsável do setor desta obrigação (ex.: Contábil → respContabilId).
    const campoResp = SETOR_RESP_FIELD[template.setor.nome];

    // Some da planilha (sem apagar nada) quem já saiu antes do mês exibido —
    // evita empresas que deixaram de ser cliente há muito tempo aparecerem
    // com pendência aberta num período em que nem eram mais cliente.
    const empresaWhere: Prisma.EmpresaWhereInput = { AND: [empresaVisivelNaCompetenciaWhere(mesBase)] };
    if (carteiraId) {
      // Se o setor da obrigação tem um campo de responsável dedicado, filtra
      // por ele; senão cai pro campo genérico (obrigações sem setor mapeado).
      if (campoResp) empresaWhere[campoResp] = carteiraId;
      else empresaWhere.respCarteiraId = carteiraId;
    }

    const vinculos = await prisma.obrigacaoEmpresa.findMany({
      where: {
        templateId: params.templateId,
        ativa: true,
        empresa: empresaWhere,
      },
      include: {
        empresa: { select: { id: true, codigoInterno: true, razaoSocial: true, respCarteiraId: true } },
        instancias: { where: { competencia: { in: competencias } } },
      },
      orderBy: { empresa: { codigoInterno: "asc" } },
    });

    const linhas = vinculos.map((v) => {
      const celulas: Record<string, { instanciaId: string; status: string; dataConclusao: string | null } | null> = {};
      for (const comp of competencias) {
        const inst = v.instancias.find((i) => i.competencia === comp);
        celulas[comp] = inst
          ? { instanciaId: inst.id, status: inst.status, dataConclusao: inst.dataConclusao ? inst.dataConclusao.toISOString() : null }
          : null;
      }
      return {
        empresaId: v.empresa.id,
        codigoInterno: v.empresa.codigoInterno,
        razaoSocial: v.empresa.razaoSocial,
        obrigacaoEmpresaId: v.id,
        celulas,
      };
    });

    return NextResponse.json({
      template: { id: template.id, nome: template.nome },
      competencias,
      linhas,
      carteiraTravada: user.perfilGlobal === "OPERADOR",
      carteiraSelecionada: carteiraId ?? null,
    });
  } catch (e: any) {
    console.error("Erro ao carregar planilha de obrigação:", e);
    return NextResponse.json({ error: "Erro ao carregar planilha", detalhe: e?.message }, { status: 500 });
  }
}

// PATCH /api/obrigacoes/templates/[templateId]/planilha
// body: { obrigacaoEmpresaId, competencia, dataConclusao }
// dataConclusao = "" ou null para desmarcar (volta para NAO_INICIADO)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal === "CONSULTA")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  try {
    const body = await req.json();
    const { obrigacaoEmpresaId, competencia, dataConclusao } = body;

    if (!obrigacaoEmpresaId || !competencia)
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });

    const desmarcar = !dataConclusao;

    const instancia = await prisma.obrigacaoInstancia.upsert({
      where: { obrigacaoEmpresaId_competencia: { obrigacaoEmpresaId, competencia } },
      update: {
        status: desmarcar ? "NAO_INICIADO" : "CONCLUIDO",
        dataConclusao: desmarcar ? null : new Date(dataConclusao),
      },
      create: {
        obrigacaoEmpresaId,
        competencia,
        status: desmarcar ? "NAO_INICIADO" : "CONCLUIDO",
        dataConclusao: desmarcar ? null : new Date(dataConclusao),
      },
    });

    return NextResponse.json({
      instanciaId: instancia.id,
      status: instancia.status,
      dataConclusao: instancia.dataConclusao ? instancia.dataConclusao.toISOString() : null,
    });
  } catch (e: any) {
    console.error("Erro ao marcar entrega:", e);
    return NextResponse.json({ error: "Erro ao salvar", detalhe: e?.message }, { status: 500 });
  }
}
