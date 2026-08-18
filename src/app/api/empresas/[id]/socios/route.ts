import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/empresas/[id]/socios — vincular uma pessoa como sócio/administrador
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal === "CONSULTA")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json();
  const { pessoaId, percentualParticipacao, eAdministrador } = body;

  if (!pessoaId)
    return NextResponse.json({ error: "Selecione uma pessoa" }, { status: 400 });

  try {
    const vinculo = await prisma.empresaPessoa.upsert({
      where: { empresaId_pessoaId: { empresaId: params.id, pessoaId } },
      update: {
        percentualParticipacao: percentualParticipacao || null,
        eAdministrador: !!eAdministrador,
        dataFim: null, // reativa o vínculo se estava encerrado
      },
      create: {
        empresaId: params.id,
        pessoaId,
        percentualParticipacao: percentualParticipacao || null,
        eAdministrador: !!eAdministrador,
        dataInicio: new Date(),
      },
      include: { pessoa: { select: { id: true, nome: true, cpf: true } } },
    });

    await prisma.auditoria.create({
      data: {
        usuarioId: user.id,
        entidadeTipo: "empresa",
        entidadeId: params.id,
        acao: "vincular_socio",
        valorNovo: JSON.stringify({ pessoaId, percentualParticipacao, eAdministrador }),
      },
    });

    return NextResponse.json(vinculo, { status: 201 });
  } catch (e: any) {
    console.error("Erro ao vincular sócio:", e);
    return NextResponse.json({ error: "Erro ao vincular sócio à empresa" }, { status: 500 });
  }
}

// DELETE /api/empresas/[id]/socios?pessoaId=xxx — encerrar o vínculo
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal === "CONSULTA")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const pessoaId = req.nextUrl.searchParams.get("pessoaId");
  if (!pessoaId)
    return NextResponse.json({ error: "Parâmetro 'pessoaId' obrigatório" }, { status: 400 });

  await prisma.empresaPessoa.update({
    where: { empresaId_pessoaId: { empresaId: params.id, pessoaId } },
    data: { dataFim: new Date() },
  });

  return NextResponse.json({ ok: true });
}
