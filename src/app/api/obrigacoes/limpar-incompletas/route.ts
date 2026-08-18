import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/obrigacoes/limpar-incompletas
// Endpoint de manutenção temporário: apaga obrigações da competência
// informada que foram geradas por engano para empresas com "Cadastro
// incompleto" (antes da correção que exclui esse status da geração
// automática), desde que a instância esteja intocada (sem observação
// nem data de conclusão preenchida). Remover depois de usar.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal !== "DIRETORIA")
    return NextResponse.json({ error: "Somente Diretoria" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const competencia = body.competencia;
  if (!competencia)
    return NextResponse.json({ error: "competencia é obrigatória" }, { status: 400 });

  const candidatas = await prisma.obrigacaoInstancia.findMany({
    where: {
      competencia,
      status: "NAO_INICIADO",
      obrigacaoEmpresa: { empresa: { status: "CADASTRO_INCOMPLETO" } },
    },
    select: { id: true, observacao: true, dataConclusao: true },
  });

  const idsSeguras = candidatas.filter((c) => !c.observacao && !c.dataConclusao).map((c) => c.id);

  let apagadas = 0;
  if (idsSeguras.length > 0) {
    const r = await prisma.obrigacaoInstancia.deleteMany({ where: { id: { in: idsSeguras } } });
    apagadas = r.count;
  }

  return NextResponse.json({
    encontradas: candidatas.length,
    comDadosPreenchidos: candidatas.length - idsSeguras.length,
    apagadas,
  });
}
