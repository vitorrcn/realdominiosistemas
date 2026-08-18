import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/obrigacoes/gerar
// Gera instâncias para uma competência (chamado manualmente ou pelo cron)
export async function POST(req: NextRequest) {
  // Permite chamada interna sem sessão via CRON_SECRET
  const cronSecret = req.headers.get("x-cron-secret");
  const isCron = cronSecret === process.env.CRON_SECRET;

  if (!isCron) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const user = session.user as any;
    if (user.perfilGlobal !== "DIRETORIA")
      return NextResponse.json({ error: "Somente Diretoria pode gerar competências" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const hoje = new Date();
  const competencia =
    body.competencia ||
    `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  // Buscar todas as relações empresa-obrigação ativas
  const obrigacoesEmpresas = await prisma.obrigacaoEmpresa.findMany({
    where: {
      ativa: true,
      empresa: { ativo: true, deletedAt: null, status: { in: ["CADASTRO_INCOMPLETO", "ATIVA", "EM_ATENCAO", "IMPLANTACAO"] } },
    },
    include: {
      empresa: { select: { id: true, respFiscalId: true, respContabilId: true, respDpId: true } },
      template: { select: { setorId: true } },
    },
  });

  let criadas = 0;
  let jaExistiam = 0;

  for (const oe of obrigacoesEmpresas) {
    // Determinar responsável padrão baseado no setor
    let responsavelId: string | null = null;
    // (simplificado — pode ser expandido com mapeamento setor→responsável)

    const existe = await prisma.obrigacaoInstancia.findUnique({
      where: { obrigacaoEmpresaId_competencia: { obrigacaoEmpresaId: oe.id, competencia } },
    });

    if (existe) {
      jaExistiam++;
      continue;
    }

    await prisma.obrigacaoInstancia.create({
      data: {
        obrigacaoEmpresaId: oe.id,
        competencia,
        status: "NAO_INICIADO",
        responsavelId,
      },
    });
    criadas++;
  }

  console.log(`[gerar-competencia] ${competencia}: ${criadas} criadas, ${jaExistiam} já existiam`);

  return NextResponse.json({
    competencia,
    criadas,
    jaExistiam,
    total: criadas + jaExistiam,
  });
}
