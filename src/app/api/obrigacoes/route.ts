import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, filtroCarteira, setoresSemCarteiraPessoal, SETOR_RESP_FIELD } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusObrigacao, Prisma } from "@prisma/client";
import { atualizarObrigacoesEmAtraso, empresaVisivelNaCompetenciaWhere } from "@/lib/obrigacoes";

// GET /api/obrigacoes?competencia=2025-05&setorId=...&status=...
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  const { searchParams } = req.nextUrl;

  // Marca como "Em atraso" quem já passou do vencimento configurado no
  // template — mantém o status em dia toda vez que a tela é carregada.
  await atualizarObrigacoesEmAtraso();

  const hoje = new Date();
  const competencia =
    searchParams.get("competencia") ||
    `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  const setorId      = searchParams.get("setorId") || undefined;
  const status       = searchParams.get("status") as StatusObrigacao | null;
  const empresaId    = searchParams.get("empresaId") || undefined;
  const minhaCarteira = searchParams.get("minhaCarteira") === "true";
  const page         = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize     = Math.min(200, Number(searchParams.get("pageSize") || 100));

  // Filtro de carteira para operadores (sem visão geral)
  const restricaoEmpresa = filtroCarteira(user.id, user.perfilGlobal, user.setores);

  // Condições comuns a toda consulta, independente do filtro de carteira
  const baseObrigEmpresaWhere: Prisma.ObrigacaoEmpresaWhereInput = {
    ...(empresaId && { empresaId }),
    ativa: true,
    ...(setorId && { template: { setorId } }),
  };

  // "Minha carteira" usa o setor de cada obrigação (Fiscal/Contábil/DP/
  // Societário) pra mostrar as obrigações onde o usuário logado é
  // pessoalmente o responsável — mesmo que ele também supervisione o
  // setor inteiro (aí é só marcar o filtro pra ver só o que atende, e
  // deixar de marcar pra ver tudo junto). Exceção: Estagiário (CONSULTA)
  // nunca tem responsabilidade pessoal, então "minha carteira" pra ele é
  // o setor inteiro em que estiver vinculado.
  const setoresSemCarteira = setoresSemCarteiraPessoal(user.perfilGlobal, user.setores ?? []);

  // Some do quadro (sem apagar nada) quem já saiu antes do início desta
  // competência — é o que evita uma empresa que saiu há anos continuar
  // aparecendo com pendência num mês em que ela nem era mais cliente.
  const visivelNaCompetencia = empresaVisivelNaCompetenciaWhere(competencia);

  const where: Prisma.ObrigacaoInstanciaWhereInput = {
    competencia,
    ...(status && { status }),
    ...(minhaCarteira
      ? {
          OR: Object.entries(SETOR_RESP_FIELD).map(([nomeSetor, campo]) => ({
            obrigacaoEmpresa: {
              ...baseObrigEmpresaWhere,
              template: { ...(setorId && { setorId }), setor: { nome: nomeSetor } },
              empresa: {
                deletedAt: null,
                ativo: true,
                [campo]: setoresSemCarteira.includes(nomeSetor) ? { not: null } : user.id,
                AND: [visivelNaCompetencia],
              },
            },
          })),
        }
      : {
          obrigacaoEmpresa: {
            ...baseObrigEmpresaWhere,
            empresa: {
              deletedAt: null,
              ativo: true,
              AND: [
                visivelNaCompetencia,
                ...(restricaoEmpresa.OR ? [{ OR: restricaoEmpresa.OR }] : []),
              ],
            },
          },
        }),
  };

  const [total, instancias] = await Promise.all([
    prisma.obrigacaoInstancia.count({ where }),
    prisma.obrigacaoInstancia.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [
        { obrigacaoEmpresa: { empresa: { codigoInterno: "asc" } } },
        { obrigacaoEmpresa: { template: { ordem: "asc" } } },
      ],
      include: {
        responsavel: { select: { id: true, nome: true } },
        obrigacaoEmpresa: {
          include: {
            empresa: {
              select: {
                id: true,
                codigoInterno: true,
                razaoSocial: true,
                status: true,
              },
            },
            template: {
              include: { setor: { select: { id: true, nome: true } } },
            },
          },
        },
      },
    }),
  ]);

  // ── Checagem de cobertura ("nenhuma empresa esquecida") ──────────────
  // Só roda quando um setor está selecionado: lista empresas ativas (que
  // deveriam ter obrigações desse setor) mas que não têm NENHUM vínculo
  // ativo com nenhuma obrigação daquele setor — sinal de que alguém
  // esqueceu de vincular esse cliente em "Gerenciar clientes".
  let semObrigacaoVinculada: { id: string; codigoInterno: string; razaoSocial: string }[] = [];
  if (setorId) {
    const empresasElegiveis = await prisma.empresa.findMany({
      where: {
        deletedAt: null,
        ativo: true,
        AND: [
          visivelNaCompetencia,
          ...(!minhaCarteira && restricaoEmpresa.OR ? [{ OR: restricaoEmpresa.OR }] : []),
        ],
      },
      select: { id: true, codigoInterno: true, razaoSocial: true },
    });

    if (empresasElegiveis.length > 0) {
      const vinculadas = await prisma.obrigacaoEmpresa.findMany({
        where: {
          ativa: true,
          template: { setorId },
          empresaId: { in: empresasElegiveis.map((e) => e.id) },
        },
        select: { empresaId: true },
      });
      const idsVinculados = new Set(vinculadas.map((v) => v.empresaId));
      semObrigacaoVinculada = empresasElegiveis
        .filter((e) => !idsVinculados.has(e.id))
        .sort((a, b) => a.codigoInterno.localeCompare(b.codigoInterno));
    }
  }

  return NextResponse.json({ data: instancias, total, page, pageSize, competencia, semObrigacaoVinculada });
}

// PATCH /api/obrigacoes — atualizar status de uma instância
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;

  const body = await req.json();
  const { id, status, observacao, responsavelId } = body;

  if (!id || !status)
    return NextResponse.json({ error: "id e status são obrigatórios" }, { status: 400 });

  const instancia = await prisma.obrigacaoInstancia.findUnique({
    where: { id },
    include: { obrigacaoEmpresa: true },
  });

  if (!instancia)
    return NextResponse.json({ error: "Obrigação não encontrada" }, { status: 404 });

  const atualizada = await prisma.obrigacaoInstancia.update({
    where: { id },
    data: {
      status,
      observacao,
      ...(responsavelId && { responsavelId }),
      dataConclusao: status === "CONCLUIDO" ? new Date() : null,
    },
  });

  // Auditoria
  await prisma.auditoria.create({
    data: {
      usuarioId: user.id,
      entidadeTipo: "obrigacao_instancia",
      entidadeId: id,
      campo: "status",
      valorAnterior: instancia.status,
      valorNovo: status,
      acao: "update",
    },
  });

  return NextResponse.json(atualizada);
}
