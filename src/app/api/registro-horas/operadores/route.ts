import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, setoresQueSupervisiona } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/registro-horas/operadores
// Lista de pessoas pro filtro "Operador" da tela de relatórios de horas —
// mesmo escopo do relatório em si: Diretoria vê todo mundo, supervisor de
// setor vê só quem é vinculado ao(s) setor(es) que supervisiona.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  const ehDiretoria = user.perfilGlobal === "DIRETORIA";
  const setoresSupervisionados = setoresQueSupervisiona(user.setores ?? []);
  if (!ehDiretoria && setoresSupervisionados.length === 0)
    return NextResponse.json({ error: "Somente a Diretoria e supervisores de setor podem ver isso" }, { status: 403 });

  if (ehDiretoria) {
    const usuarios = await prisma.usuario.findMany({
      where: { deletedAt: null, ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    });
    return NextResponse.json(usuarios);
  }

  const usuarios = await prisma.usuario.findMany({
    where: {
      deletedAt: null,
      ativo: true,
      setores: { some: { setor: { nome: { in: setoresSupervisionados } } } },
    },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });
  return NextResponse.json(usuarios);
}
