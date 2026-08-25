import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function semSufixo(v: string | null): string | null {
  if (!v) return v;
  return v.replace(/__excluida_\d+$/, "");
}

// POST /api/empresas/excluidas/[id]/restaurar
// Desfaz a exclusão (volta a aparecer em Clientes) e tenta devolver o
// CNPJ/CPF/código interno original. Se esse valor já estiver em uso por
// outro cliente ativo (ex: alguém já recadastrou com o mesmo CNPJ),
// devolve um erro claro em vez de quebrar.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal !== "DIRETORIA")
    return NextResponse.json({ error: "Somente Diretoria pode restaurar clientes" }, { status: 403 });

  const empresa = await prisma.empresa.findUnique({
    where: { id: params.id },
    select: { deletedAt: true, codigoInterno: true, cnpj: true, cpf: true },
  });
  if (!empresa) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  if (!empresa.deletedAt) return NextResponse.json({ error: "Esse cliente não está excluído" }, { status: 400 });

  try {
    const empresaRestaurada = await prisma.empresa.update({
      where: { id: params.id },
      data: {
        deletedAt: null,
        ativo: true,
        codigoInterno: semSufixo(empresa.codigoInterno)!,
        cnpj: semSufixo(empresa.cnpj),
        cpf: semSufixo(empresa.cpf),
      },
    });
    return NextResponse.json(empresaRestaurada);
  } catch (e: any) {
    if (e?.code === "P2002") {
      const campo = e?.meta?.target?.includes("cnpj") ? "CNPJ"
        : e?.meta?.target?.includes("cpf") ? "CPF"
        : e?.meta?.target?.includes("codigoInterno") ? "código interno"
        : "campo único";
      return NextResponse.json(
        { error: `Já existe outro cliente ativo com esse mesmo ${campo} — não dá pra restaurar sem trocar isso primeiro.` },
        { status: 409 }
      );
    }
    console.error("Erro ao restaurar cliente:", e);
    return NextResponse.json({ error: "Erro ao restaurar cliente", detalhe: e?.message }, { status: 500 });
  }
}
