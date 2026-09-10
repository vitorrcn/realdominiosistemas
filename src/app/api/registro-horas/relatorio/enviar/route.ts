import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { formatData } from "@/lib/utils";
import { enviarRelatoriosHoras } from "@/lib/relatorioHorasEmail";

function apenasData(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

// POST /api/registro-horas/relatorio/enviar
// body: { de: "2026-09-01", ate: "2026-09-10" }
//
// Dispara na hora, pro período escolhido, os mesmos dois e-mails que o
// cron semanal manda automaticamente: o relatório individual ("Suas
// horas") pra cada pessoa com registro no período, e o comparativo pra
// Diretoria e supervisores de cada setor (ver relatorioHorasEmail.ts pro
// detalhe de quem recebe o quê). Só Diretoria pode disparar — é um envio
// em massa pra toda a empresa, não algo que um supervisor deva acionar
// sozinho (ele já recebe o comparativo do próprio setor automaticamente).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal !== "DIRETORIA")
    return NextResponse.json({ error: "Só a Diretoria pode disparar o envio dos relatórios de horas" }, { status: 403 });

  try {
    const body = await req.json();
    const { de, ate } = body;
    if (!de || !ate)
      return NextResponse.json({ error: "Informe o período (de/até)" }, { status: 400 });

    const deDate = apenasData(de);
    const ateDate = apenasData(ate);
    if (deDate > ateDate)
      return NextResponse.json({ error: "A data \"de\" não pode ser depois da data \"até\"" }, { status: 400 });

    const label = `${formatData(deDate)} a ${formatData(ateDate)}`;
    const { individuais, comparativo } = await enviarRelatoriosHoras(deDate, ateDate, label);

    return NextResponse.json({ ok: true, individuais, comparativo, periodo: label });
  } catch (e: any) {
    console.error("Erro ao disparar relatórios de horas:", e);
    return NextResponse.json({ error: "Erro ao enviar relatórios", detalhe: e?.message }, { status: 500 });
  }
}
