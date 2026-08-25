import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Remove o sufixo "__excluida_<timestamp>" que a exclusão acrescenta pra
// liberar o CNPJ/CPF/código interno de verdade — só pra exibir o valor
// original na tela.
function semSufixo(v: string | null): string | null {
  if (!v) return v;
  return v.replace(/__excluida_\d+$/, "");
}

// GET /api/empresas/excluidas?q=busca
// Lista clientes excluídos (soft delete) — pra restaurar ou apagar de vez.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal !== "DIRETORIA")
    return NextResponse.json({ error: "Somente Diretoria pode ver clientes excluídos" }, { status: 403 });

  const q = req.nextUrl.searchParams.get("q") || undefined;

  const empresas = await prisma.empresa.findMany({
    where: {
      deletedAt: { not: null },
      ...(q && {
        OR: [
          { razaoSocial: { contains: q, mode: "insensitive" } },
          { nomeFantasia: { contains: q, mode: "insensitive" } },
          { codigoInterno: { contains: q, mode: "insensitive" } },
          { cnpj: { contains: q.replace(/\D/g, "") || q } },
          { cpf: { contains: q.replace(/\D/g, "") || q } },
        ],
      }),
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      codigoInterno: true,
      razaoSocial: true,
      nomeFantasia: true,
      tipoPessoa: true,
      cnpj: true,
      cpf: true,
      deletedAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(
    empresas.map((e) => ({
      ...e,
      codigoInterno: semSufixo(e.codigoInterno) ?? e.codigoInterno,
      cnpj: semSufixo(e.cnpj),
      cpf: semSufixo(e.cpf),
    }))
  );
}
