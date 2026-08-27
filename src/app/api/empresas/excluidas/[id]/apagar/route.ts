import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/empresas/excluidas/[id]/apagar
// Apaga PERMANENTEMENTE um cliente já excluído (soft delete) e todo o
// histórico ligado a ele. Só age em cliente que já está na lixeira
// (deletedAt preenchido) — pra apagar um cliente ativo direto, é o DELETE
// de /api/empresas/[id] (que só faz soft delete).
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal !== "DIRETORIA")
    return NextResponse.json({ error: "Somente Diretoria pode apagar clientes definitivamente" }, { status: 403 });

  const empresa = await prisma.empresa.findUnique({
    where: { id: params.id },
    select: { id: true, razaoSocial: true, deletedAt: true },
  });
  if (!empresa) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  if (!empresa.deletedAt)
    return NextResponse.json({ error: "Esse cliente ainda está ativo — exclua ele primeiro" }, { status: 400 });

  try {
    await prisma.$transaction(async (tx) => {
      const empresaId = params.id;

      await tx.eventoHistorico.deleteMany({ where: { evento: { empresaId } } });
      await tx.evento.deleteMany({ where: { empresaId } });
      await tx.tarefa.deleteMany({ where: { empresaId } });
      await tx.obrigacaoInstancia.deleteMany({ where: { obrigacaoEmpresa: { empresaId } } });
      await tx.obrigacaoEmpresa.deleteMany({ where: { empresaId } });
      await tx.documento.deleteMany({ where: { empresaId } });
      await tx.obsHistorico.deleteMany({ where: { empresaId } });
      await tx.acessoSistema.deleteMany({ where: { empresaId } });
      await tx.contaBancaria.deleteMany({ where: { contabil: { empresaId } } });
      await tx.fiscal.deleteMany({ where: { empresaId } });
      await tx.contabil.deleteMany({ where: { empresaId } });
      await tx.dp.deleteMany({ where: { empresaId } });
      await tx.societario.deleteMany({ where: { empresaId } });
      await tx.relacionamento.deleteMany({ where: { empresaId } });
      await tx.comercial.deleteMany({ where: { empresaId } });
      await tx.empresaPessoa.deleteMany({ where: { empresaId } });
      await tx.relacaoComercial.deleteMany({ where: { OR: [{ prestadorId: empresaId }, { tomadorId: empresaId }] } });
      await tx.alteracaoContratual.deleteMany({ where: { empresaId } });
      await tx.empresa.delete({ where: { id: empresaId } });
    });

    await prisma.auditoria.create({
      data: {
        usuarioId: user.id,
        entidadeTipo: "empresa",
        entidadeId: params.id,
        acao: "apagar_definitivo",
        valorAnterior: empresa.razaoSocial,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Erro ao apagar cliente definitivamente:", e);
    return NextResponse.json({ error: "Erro ao apagar cliente", detalhe: e?.message }, { status: 500 });
  }
}
