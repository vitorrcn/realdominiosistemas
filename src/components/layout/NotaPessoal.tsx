"use client";

import { useState, useEffect, useRef } from "react";

// Bloco de notas pessoal — um rascunho livre, salvo automaticamente,
// visível só pra quem está logado. Fica igual um "post-it" no topo do
// sistema: abre num popover, some quando clica fora.
export function NotaPessoal() {
  const [aberto, setAberto] = useState(false);
  const [conteudo, setConteudo] = useState("");
  const [carregado, setCarregado] = useState(false);
  const [status, setStatus] = useState<"idle" | "salvando" | "salvo">("idle");
  const ref = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!aberto || carregado) return;
    fetch("/api/minha-nota")
      .then((r) => (r.ok ? r.json() : { conteudo: "" }))
      .then((json) => setConteudo(json.conteudo ?? ""))
      .finally(() => setCarregado(true));
  }, [aberto, carregado]);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [aberto]);

  function mudar(valor: string) {
    setConteudo(valor);
    setStatus("salvando");
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      await fetch("/api/minha-nota", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conteudo: valor }),
      }).catch(() => {});
      setStatus("salvo");
      setTimeout(() => setStatus("idle"), 1500);
    }, 700);
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setAberto((v) => !v)} className="btn-icon" title="Bloco de notas pessoal">
        <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>

      {aberto && (
        <div className="absolute right-0 top-11 z-30 w-72 bg-white border border-gray-200 rounded-lg shadow-lg">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">Minhas anotações</span>
            <span className="text-[11px] text-gray-400">
              {status === "salvando" ? "salvando..." : status === "salvo" ? "salvo" : ""}
            </span>
          </div>
          <div className="p-3">
            {!carregado ? (
              <p className="text-center py-6 text-xs text-gray-400">Carregando...</p>
            ) : (
              <textarea
                autoFocus
                className="w-full h-48 text-sm text-gray-700 border-0 focus:ring-0 resize-none outline-none bg-yellow-50/60 rounded-lg p-3"
                placeholder="Rascunhos, lembretes... só você vê isso aqui."
                value={conteudo}
                onChange={(e) => mudar(e.target.value)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
