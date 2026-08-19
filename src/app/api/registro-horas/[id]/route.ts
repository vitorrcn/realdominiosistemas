import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function combinarDataHora(data: string, hora: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  const [h, m] = hora.split(":").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia, h, m));
}

function apenasData(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

// PUT /api/registro-horas/[id] — editar um registro (dono do registro, ou Diretoria)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;

  const existente = await prisma.registroAtividade.findUnique({ where: { id: params.id } });
  if (!existente)
    return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });

  if (existente.usuarioId !== user.id && user.perfilGlobal !== "DIRETORIA")
    return NextResponse.json({ error: "Sem permissão pra editar esse registro" }, { status: 403 });

  const body = await req.json();
  const { atividadeId, empresaId, data, horaInicio, horaFim, observacao } = body;

  const dataFinal = data || existente.data.toISOString().slice(0, 10);
  const horaInicioFinal = horaInicio || existente.horaInicio.toISOString().slice(11, 16);
  const horaFimFinal = horaFim || existente.horaFim.toISOString().slice(11, 16);
  const atividadeIdFinal = atividadeId || existente.atividadeId;

  const atividade = await prisma.atividade.findUnique({ where: { id: atividadeIdFinal } });
  if (!atividade)
    return NextResponse.json({ error: "Atividade não encontrada" }, { status: 400 });

  const empresaIdFinal = empresaId !== undefined ? (empresaId || null) : existente.empresaId;
  if (atividade.exigeCliente && !empresaIdFinal)
    return NextResponse.json({ error: `A atividade "${atividade.nome}" exige informar o cliente` }, { status: 400 });

  const inicio = combinarDataHora(dataFinal, horaInicioFinal);
  const fim = combinarDataHora(dataFinal, horaFimFinal);

  if (fim <= inicio)
    return NextResponse.json({ error: "O horário final precisa ser depois do horário inicial" }, { status: 400 });

  const conflito = await prisma.registroAtividade.findFirst({
    where: {
      id: { not: params.id },
      usuarioId: existente.usuarioId,
      data: apenasData(dataFinal),
      horaInicio: { lt: fim },
      horaFim: { gt: inicio },
    },
    include: { atividade: { select: { nome: true } } },
  });
  if (conflito) {
    return NextResponse.json({
      error: `Esse horário se sobrepõe a um registro já existente ("${conflito.atividade.nome}", ` +
        `${conflito.horaInicio.toISOString().slice(11, 16)} às ${conflito.horaFim.toISOString().slice(11, 16)})`,
    }, { status: 409 });
  }

  const registro = await prisma.registroAtividade.update({
    where: { id: params.id },
    data: {
      atividadeId: atividadeIdFinal,
      empresaId: empresaIdFinal,
      data: apenasData(dataFinal),
      horaInicio: inicio,
      horaFim: fim,
      observacao: observacao !== undefined ? (observacao || null) : undefined,
    },
    include: {
      atividade: { select: { id: true, nome: true, exigeCliente: true } },
      empresa: { select: { id: true, codigoInterno: true, razaoSocial: true } },
    },
  });

  return NextResponse.json(registro);
}

// DELETE /api/registro-horas/[id] — excluir um registro (dono do registro, ou Diretoria)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;

  const existente = await prisma.registroAtividade.findUnique({ where: { id: params.id } });
  if (!existente)
    return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });

  if (existente.usuarioId !== user.id && user.perfilGlobal !== "DIRETORIA")
    return NextResponse.json({ error: "Sem permissão pra excluir esse registro" }, { status: 403 });

  await prisma.registroAtividade.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
