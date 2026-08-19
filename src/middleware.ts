import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token as any;
    const path  = req.nextUrl.pathname;

    // Rotas exclusivas da Diretoria
    // Obs: /api/usuarios não entra aqui — a própria API já libera uma
    // lista mínima (id + nome) para outros perfis atribuírem responsáveis,
    // e bloqueia a criação/edição completa de usuários internamente.
    const rotasDiretoria = ["/config", "/backup", "/registro-horas/relatorios", "/relatorios/equipe"];
    if (rotasDiretoria.some((r) => path.startsWith(r))) {
      if (token?.perfilGlobal !== "DIRETORIA") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    // Dashboard não é pra Operador nem Mordomo(a) — manda direto pra Clientes.
    // O Mordomo(a) enxerga tudo da(s) empresa(s) que lidera, mas não o
    // painel gerencial do dashboard.
    if (path.startsWith("/dashboard") && ["OPERADOR", "LIDER"].includes(token?.perfilGlobal)) {
      return NextResponse.redirect(new URL("/empresas", req.url));
    }

    // Agenda não é pra Coordenador nem Estagiário — manda pra Tarefas
    if (path.startsWith("/agenda") && ["COORDENADOR", "CONSULTA"].includes(token?.perfilGlobal)) {
      return NextResponse.redirect(new URL("/tarefas", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/((?!auth|api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:jpg|jpeg|png|gif|svg|webp|ico)$).*)",
  ],
};
