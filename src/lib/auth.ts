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

// Estagiário (perfil CONSULTA) não tem carteira própria — ele auxilia em
// todas as carteiras dos operadores, então nunca é restrito por
// responsabilidade individual (embora não seja "podeVerTudo" no sentido
// de gestão/administração, que continua exclusivo de Diretoria/Coordenador).
export function podeEditar(perfil: PerfilGlobal): boolean {
  return true;
}

export function podeVerComercial(
  perfil: PerfilGlobal,
  flagIndividual: boolean
): boolean {
  return perfil === "DIRETORIA" || flagIndividual;
}

export type SetorUsuario = { setorId: string; nome: string; papel: string };

// Nome do setor → campo de responsável correspondente na Empresa. Usado
// tanto pra achar a carteira pessoal de alguém quanto pra achar a carteira
// INTEIRA de um setor que a pessoa supervisiona.
export const SETOR_RESP_FIELD: Record<string, "respFiscalId" | "respContabilId" | "respDpId" | "respSocietId"> = {
  "Fiscal": "respFiscalId",
  "Contábil": "respContabilId",
  "Departamento Pessoal": "respDpId",
  "Societário": "respSocietId",
};

// Nomes dos setores em que a pessoa é supervisora (papel === "supervisor").
// Supervisor de um setor enxerga e edita a carteira INTEIRA daquele setor
// (todas as empresas, não só as que ele mesmo atende), mas não tem
// nenhum acesso extra nos outros setores.
export function setoresQueSupervisiona(setores: SetorUsuario[]): string[] {
  return (setores ?? []).filter((s) => s.papel === "supervisor").map((s) => s.nome);
}

// Setores em que a pessoa enxerga a carteira INTEIRA (todas as empresas
// daquele setor, não uma carteira pessoal): quem é supervisor do setor, e
// também o Estagiário (perfil CONSULTA) vinculado a ele — ele ajuda o
// setor inteiro, então enxerga a carteira toda em vez de ser dono de
// clientes específicos como um Operador.
export function setoresComCarteiraCompleta(perfil: PerfilGlobal, setores: SetorUsuario[]): string[] {
  if (perfil === "CONSULTA") return (setores ?? []).map((s) => s.nome);
  return setoresQueSupervisiona(setores);
}

// Setores que entram no filtro "Minha carteira" mesmo sem responsabilidade
// pessoal em nenhuma empresa — hoje só o caso do Estagiário (CONSULTA)
// vinculado a um setor, que nunca é responsável pessoal de ninguém: pra
// ele, "minha carteira" É o setor inteiro (não tem outra carteira pra
// mostrar). Supervisor de setor NÃO entra aqui de propósito: quem é
// supervisor E operador ao mesmo tempo pode querer ver só o que atende
// pessoalmente, sem a carteira inteira que ele só enxerga por supervisão
// — "Minha carteira" marcado mostra só isso; sem marcar, continua vendo
// tudo junto (personal + setor supervisionado), como sempre foi.
export function setoresSemCarteiraPessoal(perfil: PerfilGlobal, setores: SetorUsuario[]): string[] {
  if (perfil === "CONSULTA") return (setores ?? []).map((s) => s.nome);
  return [];
}

// Filtro de empresas por carteira — aplica restrição se necessário
export function filtroCarteira(
  usuarioId: string,
  perfil: PerfilGlobal,
  setores: SetorUsuario[]
) {
  // Diretoria/Coordenador sempre veem tudo. Estagiário SEM nenhum setor
  // vinculado também — ele ajuda geral, em qualquer carteira. Já o
  // Estagiário vinculado a um ou mais setores fica restrito à carteira
  // INTEIRA desse(s) setor(es), igual um supervisor (ver
  // setoresComCarteiraCompleta abaixo).
  if (podeVerTudo(perfil)) return {};
  if (perfil === "CONSULTA" && (setores ?? []).length === 0) return {};

  // Mordomo(a)/Operador vê as empresas onde é responsável pessoalmente...
  // (Estagiário nunca é responsável pessoal de ninguém, então essas
  // condições nunca batem pra ele — inofensivo deixar aqui.)
  const condicoes: Record<string, any>[] = [
    { respFiscalId: usuarioId },
    { respContabilId: usuarioId },
    { respDpId: usuarioId },
    { respSocietId: usuarioId },
    { respCarteiraId: usuarioId },
  ];

  // ...mais a carteira INTEIRA de qualquer setor que ele supervisiona, ou
  // — no caso do Estagiário — qualquer setor em que ele estiver vinculado.
  for (const nomeSetor of setoresComCarteiraCompleta(perfil, setores)) {
    const campo = SETOR_RESP_FIELD[nomeSetor];
    if (campo) condicoes.push({ [campo]: { not: null } });
  }

  return { OR: condicoes };
}

const MAX_SUPERVISORES_POR_SETOR = 2;

// Confere se marcar esse conjunto de setores como supervisor estouraria o
// limite de supervisores por setor. `usuarioIdExcluir` tira o próprio
// usuário da contagem (pra edição não se travar sozinho). Retorna uma
// mensagem de erro (pra devolver como 400) ou null se estiver tudo certo.
export async function validarLimiteSupervisores(
  setores: { setorId: string; papel?: string }[] | undefined,
  usuarioIdExcluir?: string
): Promise<string | null> {
  const setoresNovosComoSupervisor = (setores ?? []).filter((s) => s.papel === "supervisor").map((s) => s.setorId);
  if (setoresNovosComoSupervisor.length === 0) return null;

  const atuais = await prisma.usuarioSetor.findMany({
    where: {
      setorId: { in: setoresNovosComoSupervisor },
      papel: "supervisor",
      ...(usuarioIdExcluir ? { usuarioId: { not: usuarioIdExcluir } } : {}),
    },
    include: { setor: { select: { nome: true } } },
  });

  const contagem = new Map<string, number>();
  for (const a of atuais) contagem.set(a.setorId, (contagem.get(a.setorId) ?? 0) + 1);

  for (const setorId of setoresNovosComoSupervisor) {
    if ((contagem.get(setorId) ?? 0) >= MAX_SUPERVISORES_POR_SETOR) {
      const nomeSetor = atuais.find((a) => a.setorId === setorId)?.setor.nome ?? "esse setor";
      return `O setor "${nomeSetor}" já tem ${MAX_SUPERVISORES_POR_SETOR} supervisores.`;
    }
  }
  return null;
}
