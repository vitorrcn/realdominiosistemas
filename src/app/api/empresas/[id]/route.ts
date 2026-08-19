import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, podeVerComercial } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/empresas/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;

  const empresa = await prisma.empresa.findUnique({
    where: { id: params.id, deletedAt: null },
    include: {
      respFiscal:     { select: { id: true, nome: true } },
      respContabil:   { select: { id: true, nome: true } },
      respDp:         { select: { id: true, nome: true } },
      respSocietario: { select: { id: true, nome: true } },
      respCarteira:   { select: { id: true, nome: true } },
      respLider:      { select: { id: true, nome: true } },
      supervisores:   { select: { usuario: { select: { id: true, nome: true } } } },
      fiscal:         true,
      contabil:       true,
      dp:             true,
      societario:     true,
      relacionamento: true,
      // Comercial: só para quem tem permissão
      comercial: podeVerComercial(user.perfilGlobal, user.podeVerComercial)
        ? true
        : false,
      socios: {
        include: { pessoa: { select: { id: true, nome: true, cpf: true } } },
        where: { dataFim: null },
      },
      eventos: {
        where: { deletedAt: null, status: { notIn: ["CONCLUIDO", "CANCELADO"] } },
        orderBy: { dataAbertura: "desc" },
        take: 10,
        include: {
          tipoEvento: { select: { nome: true } },
          setorAtual: { select: { nome: true } },
          respAtual:  { select: { id: true, nome: true } },
        },
      },
      tarefas: {
        where: { deletedAt: null, status: { notIn: ["CONCLUIDO", "CANCELADO"] } },
        orderBy: { prazo: "asc" },
        take: 10,
        include: {
          setor:       { select: { nome: true } },
          responsavel: { select: { id: true, nome: true } },
        },
      },
      obsHistorico: {
        orderBy: { dataHora: "desc" },
        take: 20,
      },
    },
  });

  if (!empresa)
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });

  // Obrigações da competência atual
  const hoje = new Date();
  const competencia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  const obrigacoes = await prisma.obrigacaoInstancia.findMany({
    where: {
      competencia,
      obrigacaoEmpresa: { empresaId: params.id, ativa: true },
    },
    include: {
      responsavel: { select: { id: true, nome: true } },
      obrigacaoEmpresa: {
        include: {
          template: {
            include: { setor: { select: { id: true, nome: true } } },
          },
        },
      },
    },
    orderBy: [
      { obrigacaoEmpresa: { template: { setor: { ordem: "asc" } } } },
      { obrigacaoEmpresa: { template: { ordem: "asc" } } },
    ],
  });

  // Auditoria de visualização (para dados sensíveis)
  await prisma.auditoria.create({
    data: {
      usuarioId:    user.id,
      entidadeTipo: "empresa",
      entidadeId:   params.id,
      acao:         "view",
    },
  });

  return NextResponse.json({
    ...empresa,
    supervisores: empresa.supervisores.map((s) => s.usuario),
    obrigacoesCompetencia: obrigacoes,
    competencia,
  });
}

// PUT /api/empresas/[id] — atualizar dados gerais
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal === "CONSULTA")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json();

  try {
    const existente = await prisma.empresa.findUnique({
      where: { id: params.id },
      select: { status: true },
    });

    // Campos gerais da empresa
    const empresa = await prisma.empresa.update({
      where: { id: params.id },
      data: {
        razaoSocial:   body.razaoSocial,
        nomeFantasia:  body.nomeFantasia,
        municipio:     body.municipio,
        bairro:        body.bairro,
        estado:        body.estado,
        endereco:      body.endereco !== undefined ? (body.endereco || null) : undefined,
        numero:        body.numero !== undefined ? (body.numero || null) : undefined,
        complemento:   body.complemento !== undefined ? (body.complemento || null) : undefined,
        cep:           body.cep !== undefined ? (body.cep ? String(body.cep).replace(/\D/g, "") : null) : undefined,
        telefone:      body.telefone !== undefined ? (body.telefone || null) : undefined,
        email:         body.email !== undefined ? (body.email || null) : undefined,
        inscricaoMunicipal: body.inscricaoMunicipal !== undefined ? (body.inscricaoMunicipal || null) : undefined,
        inscricaoEstadual:  body.inscricaoEstadual !== undefined ? (body.inscricaoEstadual || null) : undefined,
        capitalSocial: body.capitalSocial !== undefined ? (body.capitalSocial || null) : undefined,
        cnae:          body.cnae !== undefined ? (body.cnae || null) : undefined,
        dataAbertura:  body.dataAbertura  ? new Date(body.dataAbertura)  : undefined,
        dataEntrada:   body.dataEntrada   ? new Date(body.dataEntrada)   : undefined,
        dataSaida:     body.dataSaida     ? new Date(body.dataSaida)     : (body.dataSaida === "" ? null : undefined),
        empresaBaixada: body.empresaBaixada !== undefined ? !!body.empresaBaixada : undefined,
        status:        body.status,
        obsAtual:      body.obsAtual,
        obsCritica:    body.obsCritica,
        respFiscalId:  body.respFiscalId  || null,
        respContabilId:body.respContabilId|| null,
        respDpId:      body.respDpId      || null,
        respSocietId:  body.respSocietId  || null,
        respCarteiraId:body.respCarteiraId|| null,
        respLiderId:      body.respLiderId      || null,
      },
    });

    // Supervisores (N:N) — só mexe se o formulário mandou a lista; substitui
    // o conjunto inteiro pelo que veio, pra refletir marcações/desmarcações.
    let qtdSupervisores = 0;
    if (Array.isArray(body.supervisorIds)) {
      const idsUnicos = [...new Set(body.supervisorIds)] as string[];
      await prisma.$transaction([
        prisma.empresaSupervisor.deleteMany({ where: { empresaId: params.id } }),
        ...(idsUnicos.length > 0
          ? [prisma.empresaSupervisor.createMany({
              data: idsUnicos.map((usuarioId) => ({ empresaId: params.id, usuarioId })),
            })]
          : []),
      ]);
      qtdSupervisores = idsUnicos.length;
    } else {
      qtdSupervisores = await prisma.empresaSupervisor.count({ where: { empresaId: params.id } });
    }

    // ── Regra: avisar (sem bloquear) quando sai de "Cadastro incompleto"
    // e ainda faltam informações básicas ────────────────────────────
    const avisos: string[] = [];
    const saiuDeIncompleto =
      existente?.status === "CADASTRO_INCOMPLETO" &&
      body.status && body.status !== "CADASTRO_INCOMPLETO";

    if (saiuDeIncompleto) {
      if (!empresa.municipio || !empresa.estado) avisos.push("Município/Estado não preenchidos");
      if (!empresa.dataAbertura) avisos.push("Data de abertura não preenchida");
      if (!empresa.respLiderId) avisos.push("Líder responsável não definido");
      if (qtdSupervisores === 0) avisos.push("Nenhum supervisor responsável definido");
      if (!empresa.respFiscalId || !empresa.respContabilId || !empresa.respDpId || !empresa.respSocietId) {
        avisos.push("Nem todos os responsáveis de setor (Fiscal/Contábil/DP/Societário) estão definidos");
      }
      const fiscal = await prisma.fiscal.findUnique({ where: { empresaId: params.id }, select: { regimeTributario: true } });
      if (!fiscal?.regimeTributario) avisos.push("Regime tributário não definido (aba Fiscal)");
    }

    // Gravar histórico se obs. crítica mudou
    if (body.obsCritica !== undefined) {
      const anterior = await prisma.auditoria.findFirst({
        where: { entidadeId: params.id, campo: "obsCritica" },
        orderBy: { dataHora: "desc" },
      });
      await prisma.auditoria.create({
        data: {
          usuarioId:     user.id,
          entidadeTipo:  "empresa",
          entidadeId:    params.id,
          campo:         "obsCritica",
          valorAnterior: anterior?.valorNovo ?? null,
          valorNovo:     body.obsCritica,
          acao:          "update",
        },
      });
    }

    return NextResponse.json({ ...empresa, avisos });
  } catch (e: any) {
    console.error("Erro ao atualizar dados gerais da empresa:", e);
    return NextResponse.json(
      { error: "Erro ao salvar dados da empresa.", detalhe: e?.message },
      { status: 500 }
    );
  }
}

// DELETE /api/empresas/[id] — soft delete
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal !== "DIRETORIA")
    return NextResponse.json({ error: "Somente Diretoria pode excluir empresas" }, { status: 403 });

  await prisma.empresa.update({
    where: { id: params.id },
    data: { deletedAt: new Date(), ativo: false },
  });

  await prisma.auditoria.create({
    data: {
      usuarioId:    user.id,
      entidadeTipo: "empresa",
      entidadeId:   params.id,
      acao:         "delete",
    },
  });

  return NextResponse.json({ ok: true });
}
