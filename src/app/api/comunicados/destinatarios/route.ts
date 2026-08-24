import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, ehSupervisorDeAlgumSetor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/comunicados/destinatarios?tipo=colaboradores|clientes&q=busca
// Lista quem pode ser destinatário de um comunicado — só quem já tem
// e-mail cadastrado (sem e-mail, não tem pra onde mandar).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal !== "DIRETORIA" && !ehSupervisorDeAlgumSetor(user.setores ?? []))
    return NextResponse.json({ error: "Restrito à Diretoria e supervisores" }, { status: 403 });

  const tipo = req.nextUrl.searchParams.get("tipo");
  const q = req.nextUrl.searchParams.get("q") || undefined;

  if (tipo === "colaboradores") {
    const usuarios = await prisma.usuario.findMany({
      where: {
        deletedAt: null,
        ativo: true,
        email: { not: "" },
        ...(q && {
          OR: [
            { nome: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }),
      },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, email: true },
    });
    return NextResponse.json(usuarios);
  }

  if (tipo === "clientes") {
    const empresas = await prisma.empresa.findMany({
      where: {
        deletedAt: null,
        ativo: true,
        email: { not: null },
        ...(q && {
          OR: [
            { razaoSocial: { contains: q, mode: "insensitive" } },
            { nomeFantasia: { contains: q, mode: "insensitive" } },
            { codigoInterno: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }),
      },
      orderBy: { codigoInterno: "asc" },
      select: { id: true, codigoInterno: true, razaoSocial: true, email: true },
    });
    return NextResponse.json(
      empresas
        .filter((e) => e.email && e.email.trim())
        .map((e) => ({ id: e.id, nome: `${e.codigoInterno} - ${e.razaoSocial}`, email: e.email as string }))
    );
  }

  return NextResponse.json({ error: "Parâmetro 'tipo' inválido (use colaboradores ou clientes)" }, { status: 400 });
}
