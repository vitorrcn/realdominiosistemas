import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/relatorios/equipe
// Somente Diretoria. Pra cada usuário ativo, calcula em quantas empresas
// (ativas, não excluídas) ele desempenha cada papel: líder, supervisor, ou
// operador (responsável em qualquer setor - Fiscal/Contábil/DP/Societário,
// a mesma regra usada em "Minha carteira" no resto do sistema). Como os
// três papéis são independentes por empresa, o mesmo usuário pode aparecer
// com números nas três colunas ao mesmo tempo.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal !== "DIRETORIA")
    return NextResponse.json({ error: "Somente a Diretoria pode ver estatísticas da equipe" }, { status: 403 });

  const [usuarios, empresas, supervisores] = await Promise.all([
    prisma.usuario.findMany({
      where: { deletedAt: null, ativo: true },
      select: { id: true, nome: true, perfilGlobal: true },
      orderBy: { nome: "asc" },
    }),
    prisma.empresa.findMany({
      where: { deletedAt: null, ativo: true },
      select: { respLiderId: true, respFiscalId: true, respContabilId: true, respDpId: true, respSocietId: true },
    }),
    prisma.empresaSupervisor.findMany({
      where: { empresa: { deletedAt: null, ativo: true } },
      select: { usuarioId: true },
    }),
  ]);

  const lidera = new Map<string, number>();
  const opera = new Map<string, number>();
  for (const e of empresas) {
    if (e.respLiderId) lidera.set(e.respLiderId, (lidera.get(e.respLiderId) ?? 0) + 1);

    // "Opera" conta a empresa uma vez só, mesmo que a pessoa seja
    // responsável em mais de um setor dela.
    const operadoresDaEmpresa = new Set(
      [e.respFiscalId, e.respContabilId, e.respDpId, e.respSocietId].filter(Boolean) as string[]
    );
    for (const usuarioId of operadoresDaEmpresa) {
      opera.set(usuarioId, (opera.get(usuarioId) ?? 0) + 1);
    }
  }

  const supervisiona = new Map<string, number>();
  for (const s of supervisores) {
    supervisiona.set(s.usuarioId, (supervisiona.get(s.usuarioId) ?? 0) + 1);
  }

  const equipe = usuarios.map((u) => ({
    id: u.id,
    nome: u.nome,
    funcao: u.perfilGlobal,
    empresasCarteira: opera.get(u.id) ?? 0,
    empresasLidera: lidera.get(u.id) ?? 0,
    empresasSupervisiona: supervisiona.get(u.id) ?? 0,
  }));

  return NextResponse.json({ equipe });
}
