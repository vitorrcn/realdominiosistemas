import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, filtroCarteira } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusEmpresa, RegimeTributario, Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const user = session.user as any;
  const { searchParams } = req.nextUrl;

  const q = searchParams.get("q") || undefined;
  const status = searchParams.get("status") as StatusEmpresa | null;
  const regime = searchParams.get("regime") as RegimeTributario | null;
  const municipio = searchParams.get("municipio") || undefined;
  const minhaCarteira = searchParams.get("minhaCarteira") === "true";
  const emRisco = searchParams.get("emRisco") === "true";
  const obsCritica = searchParams.get("obsCritica") === "true";
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(100, Number(searchParams.get("pageSize") || 50));
  const orderBy = searchParams.get("orderBy") || "codigoInterno";
  const orderDir = (searchParams.get("orderDir") || "asc") as "asc" | "desc";

  // ── Montar filtros ────────────────────────────────────────────
  const where: Prisma.EmpresaWhereInput = {
    deletedAt: null,
    ativo: true,
  };

  // Subcondições que combinam via AND — evita que o OR da busca por texto
  // colida com o OR do filtro de carteira quando os dois estão ativos.
  const filtrosAdicionais: Prisma.EmpresaWhereInput[] = [];

  if (q) {
    filtrosAdicionais.push({
      OR: [
        { razaoSocial: { contains: q, mode: "insensitive" } },
        { nomeFantasia: { contains: q, mode: "insensitive" } },
        { cnpj: { contains: q.replace(/\D/g, "") } },
        { cpf: { contains: q.replace(/\D/g, "") } },
        { codigoInterno: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (status) where.status = status;
  if (municipio) where.municipio = { contains: municipio, mode: "insensitive" };
  if (obsCritica) where.obsCritica = { not: null };

  if (regime) {
    where.fiscal = { regimeTributario: regime };
  }

  // Restrição por carteira. "Minha carteira" é sempre pessoal — mostra só
  // as empresas onde o próprio usuário logado é responsável em algum
  // setor (Fiscal/Contábil/DP/Societário), independente do perfil dele
  // (inclusive Diretoria/Coordenador, que normalmente veem tudo). Fora
  // desse filtro, quem não tem visão geral já fica restrito à própria
  // carteira por padrão.
  if (minhaCarteira) {
    filtrosAdicionais.push({
      OR: [
        { respFiscalId: user.id },
        { respContabilId: user.id },
        { respDpId: user.id },
        { respSocietId: user.id },
        { respLiderId: user.id },
        { respSupervisorId: user.id },
      ],
    });
  } else if (!["DIRETORIA", "COORDENADOR"].includes(user.perfilGlobal)) {
    const restricao = filtroCarteira(user.id, user.perfilGlobal, user.setores);
    if (restricao.OR) filtrosAdicionais.push(restricao);
  }

  if (filtrosAdicionais.length > 0) where.AND = filtrosAdicionais;

  // ── Consulta ──────────────────────────────────────────────────
  try {
    const [total, empresas] = await Promise.all([
      prisma.empresa.count({ where }),
      prisma.empresa.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [orderBy]: orderDir },
        select: {
          id: true,
          codigoInterno: true,
          tipoPessoa: true,
          cnpj: true,
          cpf: true,
          razaoSocial: true,
          nomeFantasia: true,
          municipio: true,
          estado: true,
          status: true,
          obsCritica: true,
          dataEntrada: true,
          empresaBaixada: true,
          respFiscal: { select: { id: true, nome: true } },
          respContabil: { select: { id: true, nome: true } },
          respDp: { select: { id: true, nome: true } },
          respSocietario: { select: { id: true, nome: true } },
          fiscal: { select: { regimeTributario: true, parcelamentoAtivo: true } },
          _count: {
            select: {
              eventos: { where: { deletedAt: null, status: { notIn: ["CONCLUIDO", "CANCELADO"] } } },
              tarefas: { where: { deletedAt: null, status: { notIn: ["CONCLUIDO", "CANCELADO"] } } },
            },
          },
        },
      }),
    ]);

    // ── Calcular pendências e risco ───────────────────────────────
    const hoje = new Date();
    const competenciaAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

    // Buscar contagem de obrigações pendentes para as empresas retornadas
    const idsEmpresas = empresas.map((e) => e.id);
    const pendenciasPorEmpresa = await prisma.obrigacaoInstancia.groupBy({
      by: ["obrigacaoEmpresaId"],
      where: {
        competencia: competenciaAtual,
        status: { notIn: ["CONCLUIDO", "NAO_SE_APLICA"] },
        obrigacaoEmpresa: { empresaId: { in: idsEmpresas } },
      },
      _count: { id: true },
    });

    // Mapear por empresa
    const obrigsPorEmpresa = await prisma.obrigacaoEmpresa.findMany({
      where: { empresaId: { in: idsEmpresas } },
      select: { id: true, empresaId: true },
    });

    const mapEmpresaObrig = new Map<string, string[]>();
    for (const oe of obrigsPorEmpresa) {
      if (!mapEmpresaObrig.has(oe.empresaId)) mapEmpresaObrig.set(oe.empresaId, []);
      mapEmpresaObrig.get(oe.empresaId)!.push(oe.id);
    }

    const mapPendencias = new Map<string, number>();
    for (const p of pendenciasPorEmpresa) {
      // encontrar empresa via obrigacaoEmpresaId
      for (const [empId, oeIds] of mapEmpresaObrig.entries()) {
        if (oeIds.includes(p.obrigacaoEmpresaId)) {
          mapPendencias.set(empId, (mapPendencias.get(empId) || 0) + p._count.id);
        }
      }
    }

    const resultado = empresas.map((e) => {
      const pendencias = mapPendencias.get(e.id) || 0;
      const eventosAbertos = e._count.eventos;
      const temParcelamento = e.fiscal?.parcelamentoAtivo;
      const temObsCritica = !!e.obsCritica;

      let risco: "ok" | "warn" | "danger" = "ok";
      if (pendencias > 5 || eventosAbertos > 3 || (temParcelamento && pendencias > 2)) {
        risco = "danger";
      } else if (pendencias > 2 || eventosAbertos > 1 || temObsCritica) {
        risco = "warn";
      }

      return { ...e, pendencias, risco };
    });

    // Filtrar "em risco" se solicitado
    const dadosFiltrados = emRisco
      ? resultado.filter((e) => e.risco !== "ok")
      : resultado;

    return NextResponse.json({
      data: dadosFiltrados,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (e: any) {
    console.error("Erro ao listar clientes:", e);
    return NextResponse.json(
      { error: "Erro ao carregar clientes. Verifique se o banco de dados está atualizado.", detalhe: e?.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const user = session.user as any;
  if (!["DIRETORIA", "LIDER"].includes(user.perfilGlobal)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json();

  const tipoPessoa = body.tipoPessoa === "PF" ? "PF" : "PJ";
  const cnpjLimpo = body.cnpj ? String(body.cnpj).replace(/\D/g, "") : null;
  const cpfLimpo = body.cpf ? String(body.cpf).replace(/\D/g, "") : null;

  if (tipoPessoa === "PJ" && !cnpjLimpo) {
    return NextResponse.json({ error: "Informe o CNPJ" }, { status: 400 });
  }
  if (tipoPessoa === "PF" && !cpfLimpo) {
    return NextResponse.json({ error: "Informe o CPF" }, { status: 400 });
  }

  try {
    const empresa = await prisma.empresa.create({
      data: {
        codigoInterno: body.codigoInterno,
        tipoPessoa,
        cnpj: tipoPessoa === "PJ" ? cnpjLimpo : null,
        cpf: tipoPessoa === "PF" ? cpfLimpo : null,
        razaoSocial: body.razaoSocial,
        nomeFantasia: body.nomeFantasia,
        municipio: body.municipio,
        bairro: body.bairro,
        estado: body.estado,
        endereco: body.endereco || null,
        numero: body.numero || null,
        complemento: body.complemento || null,
        cep: body.cep ? String(body.cep).replace(/\D/g, "") : null,
        telefone: body.telefone || null,
        email: body.email || null,
        inscricaoMunicipal: body.inscricaoMunicipal || null,
        inscricaoEstadual: body.inscricaoEstadual || null,
        capitalSocial: body.capitalSocial || null,
        cnae: body.cnae || null,
        dataAbertura: body.dataAbertura ? new Date(body.dataAbertura) : null,
        dataEntrada: body.dataEntrada ? new Date(body.dataEntrada) : new Date(),
        dataSaida: body.dataSaida ? new Date(body.dataSaida) : null,
        status: "CADASTRO_INCOMPLETO",
        respCarteiraId: body.respCarteiraId || null,
        respLiderId: body.respLiderId || null,
        respSupervisorId: body.respSupervisorId || null,
        // Criar módulos setoriais vazios automaticamente (e já com o
        // regime tributário, se veio da importação por PDF)
        fiscal: { create: { regimeTributario: body.regimeTributario || null } },
        contabil: { create: {} },
        dp: { create: {} },
        societario: { create: {} },
        relacionamento: { create: {} },
      },
    });

    // Auditoria
    await prisma.auditoria.create({
      data: {
        usuarioId: user.id,
        entidadeTipo: "empresa",
        entidadeId: empresa.id,
        acao: "create",
      },
    });

    return NextResponse.json(empresa, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002") {
      const campo = e?.meta?.target?.includes("cnpj") ? "CNPJ"
        : e?.meta?.target?.includes("cpf") ? "CPF"
        : e?.meta?.target?.includes("codigoInterno") ? "código interno"
        : "campo único";
      return NextResponse.json({ error: `Já existe um cliente cadastrado com esse ${campo}` }, { status: 409 });
    }
    console.error("Erro ao criar cliente:", e);
    return NextResponse.json({ error: "Erro ao criar cliente", detalhe: e?.message }, { status: 500 });
  }
}
