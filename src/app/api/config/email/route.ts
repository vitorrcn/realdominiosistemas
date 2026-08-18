import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { criptografar } from "@/lib/crypto";

// GET /api/config/email — devolve se já está configurado (nunca devolve a senha)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal !== "DIRETORIA")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const config = await prisma.configuracaoEmail.findUnique({ where: { id: "config" } });
  return NextResponse.json({
    gmailUser: config?.gmailUser ?? "",
    configurado: !!(config?.gmailUser && config?.gmailSenhaCifrada),
  });
}

// PUT /api/config/email — salva o e-mail e a senha de app (criptografada)
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal !== "DIRETORIA")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  try {
    const body = await req.json();
    const { gmailUser, gmailSenha } = body;

    if (!gmailUser)
      return NextResponse.json({ error: "Informe o e-mail" }, { status: 400 });

    await prisma.configuracaoEmail.upsert({
      where: { id: "config" },
      update: {
        gmailUser,
        atualizadoPorId: user.id,
        ...(gmailSenha ? { gmailSenhaCifrada: criptografar(gmailSenha) } : {}),
      },
      create: {
        id: "config",
        gmailUser,
        gmailSenhaCifrada: gmailSenha ? criptografar(gmailSenha) : null,
        atualizadoPorId: user.id,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Erro ao salvar configuração de e-mail:", e);
    return NextResponse.json({ error: "Erro ao salvar", detalhe: e?.message }, { status: 500 });
  }
}
