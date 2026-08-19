import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { extrairEmpresasDoPdf } from "@/lib/pdfEmpresaParser";

// POST /api/empresas/importar-pdf — só LÊ o PDF e devolve os campos
// encontrados, pra pessoa revisar antes de criar o cliente de verdade.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const formData = await req.formData();
    const arquivo = formData.get("arquivo") as File | null;
    if (!arquivo)
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });

    const buffer = Buffer.from(await arquivo.arrayBuffer());
    const empresas = await extrairEmpresasDoPdf(buffer);

    if (empresas.length === 0) {
      return NextResponse.json({ error: "Não consegui reconhecer nenhuma empresa nesse PDF." }, { status: 400 });
    }

    return NextResponse.json({ empresas });
  } catch (e: any) {
    console.error("Erro ao importar PDF:", e);
    return NextResponse.json(
      { error: "Não consegui ler esse PDF. Confira se é o modelo padrão do relatório.", detalhe: e?.message },
      { status: 400 }
    );
  }
}
