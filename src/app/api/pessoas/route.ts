import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// GET /api/pessoas?q=&page=&pageSize=
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q") || undefined;
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(100, Number(searchParams.get("pageSize") || 50));

  const where: Prisma.PessoaWhereInput = { deletedAt: null, ativo: true };

  if (q) {
    where.OR = [
      { nome: { contains: q, mode: "insensitive" } },
      { cpf: { contains: q.replace(/\D/g, "") } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, pessoas] = await Promise.all([
    prisma.pessoa.count({ where }),
    prisma.pessoa.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        cpf: true,
        telefone: true,
        email: true,
        _count: { select: { empresas: true, dependentes: true } },
        empresas: {
          where: { dataFim: null },
          take: 3,
          select: { empresa: { select: { id: true, razaoSocial: true } }, eAdministrador: true },
        },
      },
    }),
  ]);

  return NextResponse.json({
    data: pessoas,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

// POST /api/pessoas — criar pessoa física
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal === "CONSULTA")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json();
  const cpf = String(body.cpf || "").replace(/\D/g, "");

  if (!body.nome || !cpf)
    return NextResponse.json({ error: "Nome e CPF são obrigatórios" }, { status: 400 });

  if (cpf.length !== 11)
    return NextResponse.json({ error: "CPF inválido (precisa ter 11 dígitos)" }, { status: 400 });

  try {
    const pessoa = await prisma.pessoa.create({
      data: {
        nome: body.nome,
        cpf,
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
        entidadeId: pessoa.id,
        acao: "create",
      },
    });

    return NextResponse.json(pessoa, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Já existe uma pessoa cadastrada com esse CPF" }, { status: 409 });
    }
    console.error("Erro ao criar pessoa:", e);
    return NextResponse.json({ error: "Erro ao criar pessoa" }, { status: 500 });
  }
}
