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

    // Comunicados é pra Diretoria + quem supervisiona algum setor
    if (path.startsWith("/comunicados")) {
      const souSupervisor = Array.isArray(token?.setores) && token.setores.some((s: any) => s.papel === "supervisor");
      if (token?.perfilGlobal !== "DIRETORIA" && !souSupervisor) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    // Dashboard não é pra Operador nem Mordomo(a) — manda direto pra Clientes.
    // O Mordomo(a) enxerga tudo da(s) empresa(s) que lidera, mas não o
    // painel gerencial do dashboard.
    if (path.startsWith("/dashboard") && ["OPERADOR", "LIDER"].includes(token?.perfilGlobal)) {
      return NextResponse.redirect(new URL("/empresas", req.url));
    }

    // Agenda não é pra Estagiário — manda pra Tarefas
    if (path.startsWith("/agenda") && token?.perfilGlobal === "CONSULTA") {
      return NextResponse.redirect(new URL("/tarefas", req.url));
    }

    // Aplicações (ferramentas internas, ex.: simulador tributário) é pra
    // Operador + Diretoria
    if (path.startsWith("/aplicacoes") && !["DIRETORIA", "OPERADOR"].includes(token?.perfilGlobal)) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // Relações Comerciais é pra Diretoria + quem foi autorizado individualmente
    if (path.startsWith("/relacoes-comerciais") && token?.perfilGlobal !== "DIRETORIA" && !token?.podeVerRelacoesComerciais) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Rotas de cron (chamadas pelo Vercel Cron ou manualmente com o
      // header de segredo, sem sessão de usuário nenhuma) fazem a própria
      // checagem via CRON_SECRET dentro da rota - liberadas aqui pra não
      // caírem no redirect de login do NextAuth antes de chegar lá.
      authorized: ({ token, req }) => {
        if (req.nextUrl.pathname.startsWith("/api/cron/")) return true;
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    "/((?!auth|api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:jpg|jpeg|png|gif|svg|webp|ico)$).*)",
  ],
};
