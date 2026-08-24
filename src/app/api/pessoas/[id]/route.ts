import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/pessoas/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const pessoa = await prisma.pessoa.findUnique({
    where: { id: params.id, deletedAt: null },
    include: {
      conjuge: { select: { id: true, nome: true, cpf: true } },
      dependentes: {
        include: { dependente: { select: { id: true, nome: true, cpf: true, dataNascimento: true } } },
      },
      empresas: {
        where: { dataFim: null },
        include: { empresa: { select: { id: true, razaoSocial: true, cnpj: true, codigoInterno: true } } },
      },
      irpf: { orderBy: { ano: "desc" } },
    },
  });

  if (!pessoa)
    return NextResponse.json({ error: "Pessoa não encontrada" }, { status: 404 });

  return NextResponse.json(pessoa);
}

// PUT /api/pessoas/[id] — atualizar dados
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;

  const body = await req.json();

  try {
    const pessoa = await prisma.pessoa.update({
      where: { id: params.id },
      data: {
        nome: body.nome,
        dataNascimento: body.dataNascimento ? new Date(body.dataNascimento) : null,
        estadoCivil: body.estadoCivil || null,
        telefone: body.telefone || null,
        email: body.email || null,
        conjugeId: body.conjugeId || null,
      },
    });

    await prisma.auditoria.create({
      data: {
        usuarioId: user.id,
        entidadeTipo: "pessoa",
        entidadeId: params.id,
        acao: "update",
      },
    });

    return NextResponse.json(pessoa);
  } catch (e: any) {
    console.error("Erro ao atualizar pessoa:", e);
    return NextResponse.json({ error: "Erro ao salvar dados da pessoa" }, { status: 500 });
  }
}

// DELETE /api/pessoas/[id] — soft delete
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal !== "DIRETORIA")
    return NextResponse.json({ error: "Sem permissão para excluir pessoas" }, { status: 403 });

  await prisma.pessoa.update({
    where: { id: params.id },
    data: { deletedAt: new Date(), ativo: false },
  });

  await prisma.auditoria.create({
    data: {
      usuarioId: user.id,
      entidadeTipo: "pessoa",
      entidadeId: params.id,
      acao: "delete",
    },
  });

  return NextResponse.json({ ok: true });
}
