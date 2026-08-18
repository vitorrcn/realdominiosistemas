"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  somenteAdmin?: boolean;
  escondeDeOperador?: boolean;
  escondeDeCoordenadorEConsulta?: boolean;
  setorNome?: string; // se preenchido, só aparece pra quem é desse setor (Operador/Líder) ou tem visão geral
}

interface NavGrupo {
  grupo: string;
  itens: NavItem[];
}

const navItems: NavGrupo[] = [
  {
    grupo: "Principal",
    itens: [
      { href: "/dashboard",  label: "Dashboard",  icon: "chart", escondeDeOperador: true },
      { href: "/empresas",   label: "Clientes",   icon: "building" },
    ],
  },
  {
    grupo: "Operacional",
    itens: [
      { href: "/obrigacoes", label: "Obrigações",  icon: "check" },
      { href: "/eventos",    label: "Eventos",    icon: "timeline" },
      { href: "/tarefas",    label: "Tarefas",    icon: "list" },
      { href: "/agenda",     label: "Agenda",     icon: "calendar", escondeDeCoordenadorEConsulta: true },
    ],
  },
  {
    grupo: "Setores",
    itens: [
      { href: "/setores/fiscal",     label: "Fiscal",     icon: "building", setorNome: "Fiscal" },
      { href: "/setores/contabil",   label: "Contábil",   icon: "building", setorNome: "Contábil" },
      { href: "/setores/dp",         label: "DP",         icon: "building", setorNome: "Departamento Pessoal" },
      { href: "/setores/societario", label: "Societário", icon: "building", setorNome: "Societário" },
    ],
  },
  {
    grupo: "Sistema",
    itens: [
      { href: "/backup",     label: "Backup",     icon: "download", somenteAdmin: true },
      { href: "/config",     label: "Configurações", icon: "settings", somenteAdmin: true },
    ],
  },
];

const Icon = ({ name }: { name: string }) => {
  const cls = "w-5 h-5";
  switch (name) {
    case "chart":    return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
    case "building": return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>;
    case "users":    return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
    case "check":    return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;
    case "timeline": return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
    case "list":     return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M4 12h16M4 16h16" /></svg>;
    case "calendar": return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
    case "download": return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>;
    case "settings": return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    default: return null;
  }
};

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const perfil = (session?.user as any)?.perfilGlobal ?? "";
  const isAdmin = perfil === "DIRETORIA";
  const vetTudo = ["DIRETORIA", "COORDENADOR", "CONSULTA"].includes(perfil);
  const meusSetores: string[] = ((session?.user as any)?.setores ?? []).map((s: any) => s.nome);

  return (
    <aside className="w-60 flex-shrink-0 bg-ink-900 border-r border-white/10 flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-white/10">
        <img src="/logo.jpg" alt="Grupo Real Domínio" className="w-8 h-8 rounded-lg flex-shrink-0 object-cover" />
        <div>
          <div className="text-sm font-semibold text-white leading-none">Real Domínio</div>
          <div className="text-xs text-gray-400 mt-0.5">Gestão operacional</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {navItems.map((grupo) => (
          <div key={grupo.grupo}>
            <div className="px-3 mb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {grupo.grupo}
            </div>
            <div className="space-y-0.5">
              {grupo.itens
                .filter((item) => !item.somenteAdmin || isAdmin)
                .filter((item) => !item.escondeDeOperador || perfil !== "OPERADOR")
                .filter((item) => !item.escondeDeCoordenadorEConsulta || !["COORDENADOR", "CONSULTA"].includes(perfil))
                .filter((item) => !item.setorNome || vetTudo || meusSetores.includes(item.setorNome))
                .map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "nav-item",
                      pathname.startsWith(item.href) && item.href !== "/dashboard"
                        ? "active"
                        : pathname === item.href
                        ? "active"
                        : ""
                    )}
                  >
                    <Icon name={item.icon} />
                    {item.label}
                  </Link>
                ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Usuário logado */}
      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-white">
              {(session?.user?.name ?? "?").charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">
              {session?.user?.name}
            </div>
            <div className="text-xs text-gray-400 truncate">{perfil}</div>
          </div>
        </div>
        <Link href="/api/auth/signout" className="btn btn-sm w-full justify-center mt-2 bg-transparent border-white/10 text-gray-300 hover:bg-white/10 hover:text-white">
          Sair
        </Link>
      </div>
    </aside>
  );
}
