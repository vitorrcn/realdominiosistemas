import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Combina uma data ("AAAA-MM-DD") e uma hora ("HH:MM") num Date em UTC —
// mesma convenção usada no resto do sistema (datas guardadas como o
// "horário de parede" digitado, sem conversão de fuso).
function combinarDataHora(data: string, hora: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  const [h, m] = hora.split(":").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia, h, m));
}

function apenasData(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

// GET /api/registro-horas?data=2026-08-19
// GET /api/registro-horas?de=2026-08-01&ate=2026-08-19
// Sem usuarioId: mostra os registros do próprio usuário logado.
// Com usuarioId: só Diretoria pode ver o registro de outra pessoa.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  const { searchParams } = req.nextUrl;

  const dataUnica = searchParams.get("data");
  const de = searchParams.get("de");
  const ate = searchParams.get("ate");
  let usuarioId = searchParams.get("usuarioId") || user.id;

  if (usuarioId !== user.id && user.perfilGlobal !== "DIRETORIA") {
    return NextResponse.json({ error: "Sem permissão pra ver o registro de outra pessoa" }, { status: 403 });
  }

  const where: any = { usuarioId };
  if (dataUnica) {
    where.data = apenasData(dataUnica);
  } else if (de || ate) {
    where.data = {};
    if (de) where.data.gte = apenasData(de);
    if (ate) where.data.lte = apenasData(ate);
  } else {
    where.data = apenasData(new Date().toISOString().slice(0, 10));
  }

  const registros = await prisma.registroAtividade.findMany({
    where,
    orderBy: [{ data: "desc" }, { horaInicio: "asc" }],
    include: {
      atividade: { select: { id: true, nome: true, exigeCliente: true } },
      empresa: { select: { id: true, codigoInterno: true, razaoSocial: true } },
    },
  });

  return NextResponse.json(registros);
}

// POST /api/registro-horas
// body: { atividadeId, empresaId?, data: "AAAA-MM-DD", horaInicio: "HH:MM", horaFim: "HH:MM", observacao? }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal === "CONSULTA")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json();
  const { atividadeId, empresaId, data, horaInicio, horaFim, observacao } = body;

  if (!atividadeId || !data || !horaInicio || !horaFim)
    return NextResponse.json({ error: "Atividade, data e horário são obrigatórios" }, { status: 400 });

  const atividade = await prisma.atividade.findUnique({ where: { id: atividadeId } });
  if (!atividade || !atividade.ativo)
    return NextResponse.json({ error: "Atividade não encontrada ou inativa" }, { status: 400 });

  if (atividade.exigeCliente && !empresaId)
    return NextResponse.json({ error: `A atividade "${atividade.nome}" exige informar o cliente` }, { status: 400 });

  const inicio = combinarDataHora(data, horaInicio);
  const fim = combinarDataHora(data, horaFim);

  if (fim <= inicio)
    return NextResponse.json({ error: "O horário final precisa ser depois do horário inicial" }, { status: 400 });

  // Impede sobreposição com outro registro do mesmo usuário no mesmo dia —
  // sem isso, as horas trabalhadas seriam contadas duas vezes no relatório.
  const conflito = await prisma.registroAtividade.findFirst({
    where: {
      usuarioId: user.id,
      data: apenasData(data),
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

  const registro = await prisma.registroAtividade.create({
    data: {
      usuarioId: user.id,
      atividadeId,
      empresaId: empresaId || null,
      data: apenasData(data),
      horaInicio: inicio,
      horaFim: fim,
      observacao: observacao || null,
    },
    include: {
      atividade: { select: { id: true, nome: true, exigeCliente: true } },
      empresa: { select: { id: true, codigoInterno: true, razaoSocial: true } },
    },
  });

  return NextResponse.json(registro, { status: 201 });
}
