import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, filtroCarteira } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusObrigacao, Prisma } from "@prisma/client";

// GET /api/obrigacoes?competencia=2025-05&setorId=...&status=...
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  const { searchParams } = req.nextUrl;

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

  // Filtro de carteira para operadores
  const restricaoEmpresa = filtroCarteira(user.id, user.perfilGlobal, user.setores);

  const where: Prisma.ObrigacaoInstanciaWhereInput = {
    competencia,
    ...(status && { status }),
    obrigacaoEmpresa: {
      ...(empresaId && { empresaId }),
      ativa: true,
      empresa: {
        deletedAt: null,
        ativo: true,
        ...(restricaoEmpresa.OR ? { OR: restricaoEmpresa.OR } : {}),
      },
      ...(setorId && { template: { setorId } }),
    },
    ...(minhaCarteira && { responsavelId: user.id }),
  };

  const [total, instancias] = await Promise.all([
    prisma.obrigacaoInstancia.count({ where }),
    prisma.obrigacaoInstancia.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [
        { obrigacaoEmpresa: { empresa: { razaoSocial: "asc" } } },
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

  return NextResponse.json({ data: instancias, total, page, pageSize, competencia });
}

// PATCH /api/obrigacoes — atualizar status de uma instância
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal === "CONSULTA")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

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
