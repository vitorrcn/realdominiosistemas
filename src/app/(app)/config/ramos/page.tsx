"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Ramo {
  id: string;
  nome: string;
  ativo: boolean;
  ordem: number;
  _count: { empresas: number };
}

export default function RamosPage() {
  const [ramos, setRamos] = useState<Ramo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [novoNome, setNovoNome] = useState("");
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState("");

  const buscar = useCallback(async () => {
    setCarregando(true);
    const res = await fetch("/api/ramos?todos=true");
    if (res.ok) setRamos(await res.json());
    setCarregando(false);
  }, []);

  useEffect(() => { buscar(); }, [buscar]);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!novoNome.trim()) return;
    setCriando(true);
    setErro(null);
    const res = await fetch("/api/ramos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: novoNome.trim() }),
    });
    setCriando(false);
    if (res.ok) {
      setNovoNome("");
      buscar();
    } else {
      const json = await res.json().catch(() => ({}));
      setErro(json.error ?? "Erro ao criar ramo.");
    }
  }

  async function salvarEdicao(id: string) {
    if (!nomeEdicao.trim()) return;
    const res = await fetch(`/api/ramos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: nomeEdicao.trim() }),
    });
    if (res.ok) {
      setEditandoId(null);
      buscar();
    } else {
      const json = await res.json().catch(() => ({}));
      setErro(json.error ?? "Erro ao renomear ramo.");
    }
  }

  async function alternarAtivo(ramo: Ramo) {
    const res = await fetch(`/api/ramos/${ramo.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !ramo.ativo }),
    });
    if (res.ok) buscar();
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/config" className="hover:text-gray-900">Configurações</Link>
        <span>/</span>
        <span className="text-gray-900">Ramos de empresa</span>
      </div>

      <p className="text-sm text-gray-500">
        Essa lista alimenta o campo &quot;Ramo da empresa&quot; na aba Contábil. Desativar um ramo
        não apaga o histórico de empresas já usando ele, só o tira das opções para novos cadastros.
      </p>

      <form onSubmit={criar} className="card flex gap-2 items-end">
        <div className="flex-1">
          <label className="label">Novo ramo</label>
          <input className="input" placeholder="Ex: Comércio varejista"
            value={novoNome} onChange={(e) => setNovoNome(e.target.value)} />
        </div>
        <button type="submit" disabled={criando} className="btn btn-primary">
          {criando ? "Adicionando..." : "Adicionar"}
        </button>
      </form>

      {erro && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
          <span className="text-sm text-red-700">{erro}</span>
        </div>
      )}

      <div className="card !p-0 overflow-hidden">
        {carregando ? (
          <p className="text-center py-8 text-gray-400 text-sm">Carregando...</p>
        ) : ramos.length === 0 ? (
          <p className="text-center py-8 text-gray-400 text-sm">Nenhum ramo cadastrado ainda.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {ramos.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                {editandoId === r.id ? (
                  <input
                    className="input flex-1 text-sm"
                    value={nomeEdicao}
                    onChange={(e) => setNomeEdicao(e.target.value)}
                    autoFocus
                  />
                ) : (
                  <span className={`flex-1 text-sm ${r.ativo ? "text-gray-800" : "text-gray-400 line-through"}`}>
                    {r.nome}
                  </span>
                )}

                <span className="text-xs text-gray-400">{r._count.empresas} empresa(s)</span>

                {editandoId === r.id ? (
                  <>
                    <button onClick={() => salvarEdicao(r.id)} className="text-xs text-brand-600 hover:underline">Salvar</button>
                    <button onClick={() => setEditandoId(null)} className="text-xs text-gray-400 hover:underline">Cancelar</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setEditandoId(r.id); setNomeEdicao(r.nome); }} className="text-xs text-gray-500 hover:underline">
                      Editar
                    </button>
                    <button onClick={() => alternarAtivo(r)} className="text-xs text-gray-500 hover:underline">
                      {r.ativo ? "Desativar" : "Reativar"}
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
