import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { lerExcel } from "@/lib/relatorio-financeiro/excel";
import { gerarRelatorio } from "@/lib/relatorio-financeiro/relatorio";
import type { ConfigRelatorioFinanceiro } from "@/lib/relatorio-financeiro/tipos";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/relatorio-financeiro/gerar
// multipart/form-data: excel (obrigatório), excelComparativo (opcional),
// config (JSON: empresa, cnpj, responsável, período, modo, textos, ICF,
// dados do comparativo). Devolve o relatório já calculado, pronto pra
// tela de impressão renderizar.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const excel = formData.get("excel") as File | null;
    const excelComparativo = formData.get("excelComparativo") as File | null;
    const configRaw = formData.get("config") as string | null;

    if (!excel) {
      return NextResponse.json({ error: "Selecione o arquivo Excel principal." }, { status: 400 });
    }
    if (!configRaw) {
      return NextResponse.json({ error: "Configuração do relatório não enviada." }, { status: 400 });
    }

    const config = JSON.parse(configRaw) as ConfigRelatorioFinanceiro;
    if (!config.empresa?.trim()) {
      return NextResponse.json({ error: "Informe o nome da empresa." }, { status: 400 });
    }
    if (!/^\d{2}\/\d{4}$/.test(config.mesIni || "") || !/^\d{2}\/\d{4}$/.test(config.mesFim || "")) {
      return NextResponse.json({ error: "Período inválido. Use o formato MM/AAAA." }, { status: 400 });
    }

    const excelBuffer = Buffer.from(await excel.arrayBuffer());
    let linhasExcel: any[][];
    try {
      linhasExcel = lerExcel(excelBuffer);
    } catch (e: any) {
      return NextResponse.json({ error: "Não foi possível ler o Excel principal.", detalhe: e?.message }, { status: 400 });
    }

    let linhasComparativo: any[][] | null = null;
    if (excelComparativo) {
      const compBuffer = Buffer.from(await excelComparativo.arrayBuffer());
      try {
        linhasComparativo = lerExcel(compBuffer);
      } catch (e: any) {
        return NextResponse.json({ error: "Não foi possível ler o Excel comparativo.", detalhe: e?.message }, { status: 400 });
      }
    }

    try {
      const relatorio = gerarRelatorio(linhasExcel, linhasComparativo, config);
      return NextResponse.json(relatorio);
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || "Erro ao montar o relatório." }, { status: 400 });
    }
  } catch (e: any) {
    console.error("Erro ao gerar relatório financeiro:", e);
    return NextResponse.json({ error: "Erro ao gerar o relatório.", detalhe: e?.message }, { status: 500 });
  }
}
