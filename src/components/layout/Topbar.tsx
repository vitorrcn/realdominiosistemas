"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { formatData } from "@/lib/utils";
import { NotaPessoal } from "./NotaPessoal";

const TITULOS: Record<string, string> = {
  "/dashboard":  "Dashboard",
  "/empresas":   "Clientes",
  "/agenda":     "Agenda",
  "/obrigacoes": "Obrigações mensais",
  "/eventos":    "Eventos",
  "/tarefas":    "Tarefas",
  "/setores":    "Setor",
  "/backup":     "Backup e exportação",
  "/config":     "Configurações",
};

interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  dataHora: string;
}

export function Topbar() {
  const pathname = usePathname();
  const base = "/" + pathname.split("/")[1];
  const titulo = TITULOS[base] ?? "Real Domínio";

  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [menuAberto, setMenuAberto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  async function buscarNotificacoes() {
    const res = await fetch("/api/notificacoes");
    if (res.ok) {
      const json = await res.json();
      setNotificacoes(json.notificacoes);
      setNaoLidas(json.naoLidas);
    }
  }

  useEffect(() => {
    buscarNotificacoes();
    const intervalo = setInterval(buscarNotificacoes, 60_000); // atualiza a cada 1 min
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    if (!menuAberto) return;
    const fechar = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAberto(false);
    };
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [menuAberto]);

  async function marcarLida(id: string) {
    await fetch(`/api/notificacoes/${id}`, { method: "PATCH" });
    buscarNotificacoes();
  }

  async function marcarTodasLidas() {
    await fetch("/api/notificacoes", { method: "PATCH" });
    buscarNotificacoes();
  }

  return (
    <header className="h-16 bg-ink-900 border-b border-white/10 flex items-center px-6 gap-4 flex-shrink-0">
      <h1 className="text-base font-semibold text-white flex-1">{titulo}</h1>

      {/* Busca global */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Buscar cliente, CNPJ, CPF..."
          className="input pl-9 w-72 text-sm"
        />
      </div>

      {/* Abrir em nova aba — útil no modo "app" (sem barra de endereço) */}
      <button
        onClick={() => window.open(window.location.origin, "_blank")}
        className="btn-icon"
        title="Abrir o sistema em outra aba"
      >
        <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
        </svg>
      </button>

      <NotaPessoal />

      {/* Notificações */}
      <div className="relative" ref={menuRef}>
        <button onClick={() => setMenuAberto((v) => !v)} className="btn-icon relative">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {naoLidas > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-medium">
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </button>

        {menuAberto && (
          <div className="absolute right-0 top-11 z-30 w-80 bg-white border border-gray-200 rounded-lg shadow-lg">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-900">Notificações</span>
              {naoLidas > 0 && (
                <button onClick={marcarTodasLidas} className="text-xs text-brand-600 hover:underline">
                  Marcar todas como lidas
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notificacoes.length === 0 ? (
                <p className="text-center py-8 text-sm text-gray-400">Nenhuma notificação ainda.</p>
              ) : (
                notificacoes.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => !n.lida && marcarLida(n.id)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 ${!n.lida ? "bg-brand-50/50" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.lida && <span className="w-1.5 h-1.5 rounded-full bg-brand-600 mt-1.5 flex-shrink-0" />}
                      <div className={!n.lida ? "" : "pl-3.5"}>
                        <p className="text-sm font-medium text-gray-900">{n.titulo}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{n.mensagem}</p>
                        <p className="text-[11px] text-gray-400 mt-1">{formatData(n.dataHora)}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
