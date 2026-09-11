import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enviarObrigacoesPendentes } from "@/lib/obrigacoesPendentesEmail";

// POST /api/obrigacoes/pendentes/enviar
// Dispara na hora (fora do horário do cron) o e-mail de obrigações
// pendentes: o digest coletivo por setor + o individual por operador.
// Só Diretoria pode disparar — mesmo padrão do "Enviar agora" do
// relatório de horas.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal !== "DIRETORIA")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  try {
    const config = await prisma.configuracaoAutomacao.findUnique({ where: { id: "config" } });
    const dias = config?.diasAntecedenciaVencimento ?? 7;

    const { porSetor, porOperador } = await enviarObrigacoesPendentes(dias);

    return NextResponse.json({ ok: true, porSetor, porOperador });
  } catch (e: any) {
    console.error("Erro ao enviar obrigações pendentes:", e);
    return NextResponse.json({ error: "Erro ao enviar", detalhe: e?.message }, { status: 500 });
  }
}
