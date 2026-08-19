import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, SETOR_RESP_FIELD } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/relatorios/equipe
// Somente Diretoria. Pra cada usuário ativo, calcula em quantas empresas
// (ativas, não excluídas) ele desempenha cada papel:
// - lidera: é o mordomo (respLiderId) dessa empresa;
// - opera (carteira): é responsável em algum setor dela (Fiscal/Contábil/
//   DP/Societário) - a mesma regra usada em "Minha carteira";
// - supervisiona: é supervisor de algum setor (papel em UsuarioSetor) -
//   conta a carteira INTEIRA daquele(s) setor(es), não só as empresas que
//   ele mesmo atende.
// Como os três papéis são independentes, o mesmo usuário pode aparecer
// com números nas três colunas ao mesmo tempo.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal !== "DIRETORIA")
    return NextResponse.json({ error: "Somente a Diretoria pode ver estatísticas da equipe" }, { status: 403 });

  const [usuarios, empresas] = await Promise.all([
    prisma.usuario.findMany({
      where: { deletedAt: null, ativo: true },
      select: {
        id: true,
        nome: true,
        perfilGlobal: true,
        setores: { where: { papel: "supervisor" }, select: { setor: { select: { nome: true } } } },
      },
      orderBy: { nome: "asc" },
    }),
    prisma.empresa.findMany({
      where: { deletedAt: null, ativo: true },
      select: { respLiderId: true, respFiscalId: true, respContabilId: true, respDpId: true, respSocietId: true },
    }),
  ]);

  const lidera = new Map<string, number>();
  const opera = new Map<string, number>();
  // Quantas empresas têm responsável definido em cada setor - usado pra
  // calcular a carteira inteira de quem supervisiona aquele setor.
  const totalPorSetor = new Map<string, number>();
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

    for (const [nomeSetor, campo] of Object.entries(SETOR_RESP_FIELD)) {
      if (e[campo]) totalPorSetor.set(nomeSetor, (totalPorSetor.get(nomeSetor) ?? 0) + 1);
    }
  }

  const equipe = usuarios.map((u) => {
    const setoresSupervisionados = u.setores.map((s) => s.setor.nome);
    // Soma o tamanho de cada setor supervisionado. Como um mesmo usuário
    // raramente supervisiona mais de um setor, empresa contada duas vezes
    // (se atende dois setores supervisionados por ele) é um caso raro o
    // suficiente pra não valer a complexidade de deduplicar aqui.
    const empresasSupervisiona = setoresSupervisionados.reduce(
      (soma, nomeSetor) => soma + (totalPorSetor.get(nomeSetor) ?? 0),
      0
    );

    return {
      id: u.id,
      nome: u.nome,
      funcao: u.perfilGlobal,
      empresasCarteira: opera.get(u.id) ?? 0,
      empresasLidera: lidera.get(u.id) ?? 0,
      empresasSupervisiona,
      setoresSupervisionados,
    };
  });

  return NextResponse.json({ equipe });
}
