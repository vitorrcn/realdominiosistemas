import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { criptografar } from "@/lib/crypto";

// GET /api/empresas/[id]/acessos?setorId=xxx
// A senha NUNCA vem nessa lista — só um "temSenha: true/false".
// Pra ver a senha de verdade, tem um endpoint separado (.../senha).
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const setorId = req.nextUrl.searchParams.get("setorId") || undefined;

  const acessos = await prisma.acessoSistema.findMany({
    where: { empresaId: params.id, ...(setorId && { setorId }) },
    orderBy: { nomeSistema: "asc" },
    include: { criadoPor: { select: { id: true, nome: true } } },
  });

  return NextResponse.json(
    acessos.map((a) => ({
      id: a.id,
      nomeSistema: a.nomeSistema,
      link: a.link,
      usuario: a.usuario,
      observacao: a.observacao,
      temSenha: !!a.senhaCifrada,
      criadoPor: a.criadoPor.nome,
      updatedAt: a.updatedAt,
    }))
  );
}

// POST /api/empresas/[id]/acessos
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
  const { setorId, nomeSistema, link, usuario, senha, observacao } = body;

  if (!setorId || !nomeSistema)
    return NextResponse.json({ error: "Setor e nome do sistema são obrigatórios" }, { status: 400 });

  try {
    const acesso = await prisma.acessoSistema.create({
      data: {
        empresaId: params.id,
        setorId,
        nomeSistema,
        link: link || null,
        usuario: usuario || null,
        senhaCifrada: senha ? criptografar(senha) : null,
        observacao: observacao || null,
        criadoPorId: user.id,
      },
    });
    return NextResponse.json({ id: acesso.id }, { status: 201 });
  } catch (e: any) {
    console.error("Erro ao criar acesso:", e);
    return NextResponse.json({ error: "Erro ao salvar acesso", detalhe: e?.message }, { status: 500 });
  }
}
