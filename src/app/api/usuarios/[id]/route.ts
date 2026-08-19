import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, validarLimiteSupervisores } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { PerfilGlobal } from "@prisma/client";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  // Diretoria pode editar qualquer um; usuário pode editar a si mesmo (só nome/senha)
  const ehProprioUsuario = user.id === params.id;
  if (user.perfilGlobal !== "DIRETORIA" && !ehProprioUsuario)
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json();
  const dados: any = {};

  if (body.nome)  dados.nome  = body.nome;
  if (body.email && user.perfilGlobal === "DIRETORIA")
    dados.email = body.email.toLowerCase();
  if (body.senha) dados.senhaHash = await bcrypt.hash(body.senha, 12);

  // Somente Diretoria pode alterar perfil e permissões
  if (user.perfilGlobal === "DIRETORIA") {
    if (body.perfilGlobal)            dados.perfilGlobal    = body.perfilGlobal as PerfilGlobal;
    if (body.podeVerComercial != null) dados.podeVerComercial = body.podeVerComercial;
    if (body.ativo != null)           dados.ativo           = body.ativo;

    // Atualizar setores se informado
    if (body.setores) {
      const erroLimite = await validarLimiteSupervisores(body.setores, params.id);
      if (erroLimite) return NextResponse.json({ error: erroLimite }, { status: 400 });

      await prisma.usuarioSetor.deleteMany({ where: { usuarioId: params.id } });
      if (body.setores.length > 0) {
        await prisma.usuarioSetor.createMany({
          data: body.setores.map((s: { setorId: string; papel: string }) => ({
            usuarioId: params.id,
            setorId:   s.setorId,
            papel:     s.papel || "membro",
          })),
        });
      }
    }
  }

  const atualizado = await prisma.usuario.update({
    where: { id: params.id },
    data: dados,
    select: { id: true, nome: true, email: true, perfilGlobal: true, ativo: true },
  });

  return NextResponse.json(atualizado);
}

// DELETE /api/usuarios/[id]
// DELETE /api/usuarios/[id]?permanente=true — apaga o registro de vez (não dá pra desfazer)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = session.user as any;
  if (user.perfilGlobal !== "DIRETORIA")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  if (user.id === params.id)
    return NextResponse.json({ error: "Não é possível remover o próprio usuário" }, { status: 400 });

  const permanente = req.nextUrl.searchParams.get("permanente") === "true";

  if (permanente) {
    try {
      await prisma.usuario.delete({ where: { id: params.id } });
      return NextResponse.json({ ok: true, permanente: true });
    } catch (e: any) {
      if (e?.code === "P2003") {
        return NextResponse.json(
          {
            error:
              "Não é possível excluir esse usuário de vez porque ele tem histórico vinculado no sistema " +
              "(empresas, auditoria, agenda, obrigações, etc). Use \"Desativar\" para bloquear o acesso sem apagar o histórico.",
          },
          { status: 409 }
        );
      }
      console.error("Erro ao excluir usuário definitivamente:", e);
      return NextResponse.json({ error: "Erro ao excluir usuário", detalhe: e?.message }, { status: 500 });
    }
  }

  // Soft delete (padrão) — mantém o histórico, só desativa o acesso
  await prisma.usuario.update({
    where: { id: params.id },
    data: { deletedAt: new Date(), ativo: false },
  });

  return NextResponse.json({ ok: true });
}
