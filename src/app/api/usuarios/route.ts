import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { PerfilGlobal } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;

  // Diretoria vê a lista completa (usada na tela de Configurações > Usuários)
  if (user.perfilGlobal === "DIRETORIA") {
    const usuarios = await prisma.usuario.findMany({
      where: { deletedAt: null },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        email: true,
        perfilGlobal: true,
        podeVerComercial: true,
        ativo: true,
        createdAt: true,
        setores: {
          include: { setor: { select: { id: true, nome: true } } },
        },
      },
    });
    return NextResponse.json(usuarios);
  }

  // Demais perfis recebem só o essencial (id + nome), usado para
  // preencher os menus de "responsável" no cadastro de empresas.
  const usuarios = await prisma.usuario.findMany({
    where: { deletedAt: null, ativo: true },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });

  return NextResponse.json(usuarios);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal !== "DIRETORIA")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json();
  const { nome, email, senha, perfilGlobal, podeVerComercial, setores } = body;

  if (!nome || !email || !senha)
    return NextResponse.json({ error: "nome, email e senha são obrigatórios" }, { status: 400 });

  const senhaHash = await bcrypt.hash(senha, 12);

  const novoUsuario = await prisma.usuario.create({
    data: {
      nome,
      email: email.toLowerCase(),
      senhaHash,
      perfilGlobal: perfilGlobal as PerfilGlobal,
      podeVerComercial: podeVerComercial ?? false,
      setores: setores?.length
        ? {
            create: setores.map((s: { setorId: string; papel: string }) => ({
              setorId: s.setorId,
              papel:   s.papel || "membro",
            })),
          }
        : undefined,
    },
    select: { id: true, nome: true, email: true, perfilGlobal: true },
  });

  return NextResponse.json(novoUsuario, { status: 201 });
}
