import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/relatorios/ramos — quantidade de empresas ativas por ramo
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const [porRamo, semRamo, ramos] = await Promise.all([
    prisma.contabil.groupBy({
      by: ["ramoId"],
      where: { ramoId: { not: null }, empresa: { ativo: true, deletedAt: null } },
      _count: { id: true },
    }),
    prisma.contabil.count({
      where: { ramoId: null, empresa: { ativo: true, deletedAt: null } },
    }),
    prisma.ramoEmpresa.findMany({
      orderBy: [{ ordem: "asc" }, { nome: "asc" }],
      select: { id: true, nome: true, ativo: true },
    }),
  ]);

  const mapaContagem = new Map(porRamo.map((r) => [r.ramoId, r._count.id]));

  const dados = ramos
    .map((r) => ({ id: r.id, nome: r.nome, ativo: r.ativo, quantidade: mapaContagem.get(r.id) ?? 0 }))
    .filter((r) => r.ativo || r.quantidade > 0); // esconde ramos inativos sem nenhuma empresa

  if (semRamo > 0) {
    dados.push({ id: "sem-ramo", nome: "Sem ramo definido", ativo: true, quantidade: semRamo });
  }

  dados.sort((a, b) => b.quantidade - a.quantidade);

  const total = dados.reduce((soma, d) => soma + d.quantidade, 0);

  return NextResponse.json({ dados, total });
}
