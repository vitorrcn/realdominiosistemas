import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULTS = {
  pausadoGeral: false,
  diasAntecedenciaVencimento: 7,
  alertaObrigacoesAtivo: true,
  alertaCarteiraSemRespAtivo: true,
  relatorioIndividualAtivo: true,
  relatorioIndividualDiaSemana: 1,
  relatorioComparativoAtivo: true,
  relatorioComparativoDiaSemana: 1,
  copiaEmailsFixos: "",
};

// GET /api/config/automacao
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal !== "DIRETORIA")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const config = await prisma.configuracaoAutomacao.findUnique({ where: { id: "config" } });
  return NextResponse.json({
    pausadoGeral: config?.pausadoGeral ?? DEFAULTS.pausadoGeral,
    diasAntecedenciaVencimento: config?.diasAntecedenciaVencimento ?? DEFAULTS.diasAntecedenciaVencimento,
    alertaObrigacoesAtivo: config?.alertaObrigacoesAtivo ?? DEFAULTS.alertaObrigacoesAtivo,
    alertaCarteiraSemRespAtivo: config?.alertaCarteiraSemRespAtivo ?? DEFAULTS.alertaCarteiraSemRespAtivo,
    relatorioIndividualAtivo: config?.relatorioIndividualAtivo ?? DEFAULTS.relatorioIndividualAtivo,
    relatorioIndividualDiaSemana: config?.relatorioIndividualDiaSemana ?? DEFAULTS.relatorioIndividualDiaSemana,
    relatorioComparativoAtivo: config?.relatorioComparativoAtivo ?? DEFAULTS.relatorioComparativoAtivo,
    relatorioComparativoDiaSemana: config?.relatorioComparativoDiaSemana ?? DEFAULTS.relatorioComparativoDiaSemana,
    copiaEmailsFixos: config?.copiaEmailsFixos ?? DEFAULTS.copiaEmailsFixos,
  });
}

// PUT /api/config/automacao
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal !== "DIRETORIA")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  try {
    const body = await req.json();
    const {
      pausadoGeral,
      diasAntecedenciaVencimento, alertaObrigacoesAtivo, alertaCarteiraSemRespAtivo,
      relatorioIndividualAtivo, relatorioIndividualDiaSemana,
      relatorioComparativoAtivo, relatorioComparativoDiaSemana,
      copiaEmailsFixos,
    } = body;

    const dias = Number(diasAntecedenciaVencimento);
    if (!Number.isFinite(dias) || dias < 0 || dias > 90)
      return NextResponse.json({ error: "Dias de antecedência inválido (0 a 90)" }, { status: 400 });

    const diaInd = Number(relatorioIndividualDiaSemana);
    const diaComp = Number(relatorioComparativoDiaSemana);
    const diasValidos = [0, 1, 2, 3, 4, 5, 6];
    if (!diasValidos.includes(diaInd) || !diasValidos.includes(diaComp))
      return NextResponse.json({ error: "Dia da semana inválido" }, { status: 400 });

    const data = {
      pausadoGeral: !!pausadoGeral,
      diasAntecedenciaVencimento: dias,
      alertaObrigacoesAtivo: !!alertaObrigacoesAtivo,
      alertaCarteiraSemRespAtivo: !!alertaCarteiraSemRespAtivo,
      relatorioIndividualAtivo: !!relatorioIndividualAtivo,
      relatorioIndividualDiaSemana: diaInd,
      relatorioComparativoAtivo: !!relatorioComparativoAtivo,
      relatorioComparativoDiaSemana: diaComp,
      copiaEmailsFixos: (copiaEmailsFixos ?? "").toString().trim() || null,
      atualizadoPorId: user.id,
    };

    await prisma.configuracaoAutomacao.upsert({
      where: { id: "config" },
      update: data,
      create: { id: "config", ...data },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Erro ao salvar configuração de automação:", e);
    return NextResponse.json({ error: "Erro ao salvar", detalhe: e?.message }, { status: 500 });
  }
}
