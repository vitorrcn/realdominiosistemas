import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET/PUT /api/minha-nota — bloco de notas pessoal, sempre do próprio
// usuário logado (não existe endpoint pra ler a nota de outra pessoa).

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  const usuario = await prisma.usuario.findUnique({
    where: { id: user.id },
    select: { notaPessoal: true },
  });

  return NextResponse.json({ conteudo: usuario?.notaPessoal ?? "" });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  const body = await req.json().catch(() => ({}));
  const conteudo = typeof body.conteudo === "string" ? body.conteudo : "";

  // Sem limite de tamanho artificial, mas evita salvar algo absurdo por
  // engano (ex.: colar um arquivo inteiro sem querer).
  if (conteudo.length > 50_000)
    return NextResponse.json({ error: "Nota muito grande (máximo 50 mil caracteres)" }, { status: 400 });

  await prisma.usuario.update({
    where: { id: user.id },
    data: { notaPessoal: conteudo || null },
  });

  return NextResponse.json({ ok: true });
}
