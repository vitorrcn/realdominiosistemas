import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { PerfilGlobal } from "@prisma/client";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // 8 horas
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const usuario = await prisma.usuario.findUnique({
          where: { email: credentials.email.toLowerCase() },
          include: {
            setores: {
              include: { setor: { select: { id: true, nome: true } } },
            },
          },
        });

        if (!usuario || !usuario.ativo) return null;

        const senhaValida = await bcrypt.compare(
          credentials.password,
          usuario.senhaHash
        );
        if (!senhaValida) return null;

        // Registrar auditoria de login
        await prisma.auditoria.create({
          data: {
            usuarioId: usuario.id,
            entidadeTipo: "usuario",
            entidadeId: usuario.id,
            acao: "login",
          },
        });

        return {
          id: usuario.id,
          name: usuario.nome,
          email: usuario.email,
          perfilGlobal: usuario.perfilGlobal,
          podeVerComercial: usuario.podeVerComercial,
          setores: usuario.setores.map((us) => ({
            setorId: us.setorId,
            nome: us.setor.nome,
            papel: us.papel,
          })),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.perfilGlobal = (user as any).perfilGlobal;
        token.podeVerComercial = (user as any).podeVerComercial;
        token.setores = (user as any).setores;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).perfilGlobal = token.perfilGlobal;
        (session.user as any).podeVerComercial = token.podeVerComercial;
        (session.user as any).setores = token.setores;
      }
      return session;
    },
  },
};

// ── Helpers de permissão ─────────────────────────────────────────

export function podeVerTudo(perfil: PerfilGlobal): boolean {
  return perfil === "DIRETORIA" || perfil === "COORDENADOR";
}

export function podeEditar(perfil: PerfilGlobal): boolean {
  return perfil !== "CONSULTA";
}

export function podeVerComercial(
  perfil: PerfilGlobal,
  flagIndividual: boolean
): boolean {
  return perfil === "DIRETORIA" || flagIndividual;
}

// Filtro de empresas por carteira — aplica restrição se necessário
export function filtroCarteira(
  usuarioId: string,
  perfil: PerfilGlobal,
  setores: Array<{ setorId: string; papel: string }>
) {
  if (podeVerTudo(perfil)) return {}; // sem restrição

  // Líder/Operador vê somente empresas onde é responsável
  return {
    OR: [
      { respFiscalId: usuarioId },
      { respContabilId: usuarioId },
      { respDpId: usuarioId },
      { respSocietId: usuarioId },
      { respCarteiraId: usuarioId },
    ],
  };
}
