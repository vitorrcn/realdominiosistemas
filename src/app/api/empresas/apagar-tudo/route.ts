import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const FRASE_CONFIRMACAO = "EXCLUIR TODOS OS CLIENTES";

// POST /api/empresas/apagar-tudo
// Apaga TODOS os clientes/empresas e todo o histórico ligado a eles.
// Ação irreversível — só Diretoria, e só com a frase de confirmação exata.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal !== "DIRETORIA")
    return NextResponse.json({ error: "Somente a Diretoria pode fazer isso" }, { status: 403 });

  const body = await req.json();
  if (body.confirmacao !== FRASE_CONFIRMACAO) {
    return NextResponse.json(
      { error: `Digite exatamente "${FRASE_CONFIRMACAO}" para confirmar` },
      { status: 400 }
    );
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const totalEmpresas = await tx.empresa.count();

      // Apaga na ordem certa: filhos antes dos pais
      await tx.eventoHistorico.deleteMany({});
      await tx.evento.deleteMany({});
      await tx.tarefa.deleteMany({});
      await tx.obrigacaoInstancia.deleteMany({});
      await tx.obrigacaoEmpresa.deleteMany({});
      await tx.documento.deleteMany({});
      await tx.obsHistorico.deleteMany({});
      await tx.acessoSistema.deleteMany({});
      await tx.empresaPessoa.deleteMany({});
      await tx.fiscal.deleteMany({});
      await tx.contabil.deleteMany({});
      await tx.dp.deleteMany({});
      await tx.societario.deleteMany({});
      await tx.relacionamento.deleteMany({});
      await tx.comercial.deleteMany({});
      await tx.empresa.deleteMany({});

      return totalEmpresas;
    });

    await prisma.auditoria.create({
      data: {
        usuarioId: user.id,
        entidadeTipo: "empresa",
        entidadeId: "todos",
        acao: "apagar_tudo",
        valorAnterior: `${resultado} clientes`,
      },
    });

    return NextResponse.json({ ok: true, apagados: resultado });
  } catch (e: any) {
    console.error("Erro ao apagar todos os clientes:", e);
    return NextResponse.json({ error: "Erro ao apagar clientes", detalhe: e?.message }, { status: 500 });
  }
}
