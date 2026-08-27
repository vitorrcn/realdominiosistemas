import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { lerExcel } from "@/lib/relatorio-financeiro/excel";

export const runtime = "nodejs";

// POST /api/relatorio-financeiro/meses — lê só o cabeçalho do Excel pra
// devolver os meses disponíveis (MM/AAAA), usado pra pré-preencher o
// período assim que a pessoa escolhe o arquivo (igual o app original
// fazia ao selecionar o Excel).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const excel = formData.get("excel") as File | null;
    if (!excel) return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });

    const buffer = Buffer.from(await excel.arrayBuffer());
    const linhas = lerExcel(buffer);
    const header = linhas[0] ?? [];
    const meses = header
      .map((c: any) => String(c ?? "").trim())
      .filter((c: string) => /^\d{2}\/\d{4}$/.test(c));

    return NextResponse.json({ meses });
  } catch (e: any) {
    console.error("Erro ao ler meses do Excel:", e);
    return NextResponse.json({ error: "Não foi possível ler esse Excel.", detalhe: e?.message }, { status: 400 });
  }
}
