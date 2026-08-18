import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Mapeia o slug da URL para o nome real do setor no banco e para o
// campo de responsável correspondente na tabela Empresa.
const SETORES: Record<string, { nome: string; respCampo: "respFiscalId" | "respContabilId" | "respDpId" | "respSocietId" }> = {
  fiscal:     { nome: "Fiscal",               respCampo: "respFiscalId" },
  contabil:   { nome: "Contábil",             respCampo: "respContabilId" },
  dp:         { nome: "Departamento Pessoal", respCampo: "respDpId" },
  societario: { nome: "Societário",           respCampo: "respSocietId" },
};

// GET /api/setores/resumo?slug=fiscal
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const config = SETORES[slug];
  if (!config)
    return NextResponse.json({ error: "Setor inválido" }, { status: 400 });

  // Operador/Líder só podem ver o resumo do(s) próprio(s) setor(es)
  if (["OPERADOR", "LIDER"].includes(user.perfilGlobal)) {
    const meusSetores: string[] = (user.setores ?? []).map((s: any) => s.nome);
    if (!meusSetores.includes(config.nome))
      return NextResponse.json({ error: "Sem permissão para ver esse setor" }, { status: 403 });
  }

  const setor = await prisma.setor.findUnique({ where: { nome: config.nome } });
  if (!setor)
    return NextResponse.json({ error: "Setor não encontrado no banco" }, { status: 404 });

  const hoje = new Date();
  const competencia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  // Só entram empresas com pelo menos 1 obrigação ativa vinculada a este setor
  const vinculosAtivos = await prisma.obrigacaoEmpresa.findMany({
    where: { template: { setorId: setor.id }, ativa: true },
    select: { empresaId: true },
    distinct: ["empresaId"],
  });
  const idsVinculados = vinculosAtivos.map((v) => v.empresaId);

  if (idsVinculados.length === 0) {
    return NextResponse.json({ setor: config.nome, competencia, dados: [] });
  }

  const whereEmpresa: any = { deletedAt: null, ativo: true, id: { in: idsVinculados } };

  // Operador só vê as empresas onde ELE é o responsável deste setor específico
  if (user.perfilGlobal === "OPERADOR") {
    whereEmpresa[config.respCampo] = user.id;
  }

  const empresas = await prisma.empresa.findMany({
    where: whereEmpresa,
    orderBy: { codigoInterno: "asc" },
    select: {
      id: true,
      codigoInterno: true,
      razaoSocial: true,
      status: true,
      [config.respCampo]: true,
      respFiscal:    config.respCampo === "respFiscalId"    ? { select: { id: true, nome: true } } : undefined,
      respContabil:  config.respCampo === "respContabilId"  ? { select: { id: true, nome: true } } : undefined,
      respDp:        config.respCampo === "respDpId"        ? { select: { id: true, nome: true } } : undefined,
      respSocietario:config.respCampo === "respSocietId"    ? { select: { id: true, nome: true } } : undefined,
    },
  });

  // Contagem de obrigações desse setor, desse mês, por empresa
  const instancias = await prisma.obrigacaoInstancia.findMany({
    where: {
      competencia,
      obrigacaoEmpresa: { template: { setorId: setor.id }, empresa: { deletedAt: null, ativo: true } },
    },
    select: {
      status: true,
      obrigacaoEmpresa: { select: { empresaId: true } },
    },
  });

  const contagemPorEmpresa = new Map<string, { pendente: number; emAtraso: number; concluido: number }>();
  for (const inst of instancias) {
    const eid = inst.obrigacaoEmpresa.empresaId;
    if (!contagemPorEmpresa.has(eid)) contagemPorEmpresa.set(eid, { pendente: 0, emAtraso: 0, concluido: 0 });
    const c = contagemPorEmpresa.get(eid)!;
    if (inst.status === "CONCLUIDO") c.concluido++;
    else if (inst.status === "EM_ATRASO") c.emAtraso++;
    else c.pendente++;
  }

  const dados = empresas.map((e: any) => ({
    id: e.id,
    codigoInterno: e.codigoInterno,
    razaoSocial: e.razaoSocial,
    status: e.status,
    responsavel: (e.respFiscal ?? e.respContabil ?? e.respDp ?? e.respSocietario)?.nome ?? null,
    obrigacoes: contagemPorEmpresa.get(e.id) ?? { pendente: 0, emAtraso: 0, concluido: 0 },
  }));

  return NextResponse.json({ setor: config.nome, competencia, dados });
}
