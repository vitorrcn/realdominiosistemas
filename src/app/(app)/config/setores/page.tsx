"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Setor {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  ordem: number;
  _count: { usuarios: number; obrigacaoTemplates: number };
}

export default function SetoresPage() {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [novoNome, setNovoNome] = useState("");
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState("");

  const buscar = useCallback(async () => {
    setCarregando(true);
    const res = await fetch("/api/setores?todos=true");
    if (res.ok) setSetores(await res.json());
    setCarregando(false);
  }, []);

  useEffect(() => { buscar(); }, [buscar]);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!novoNome.trim()) return;
    setCriando(true);
    setErro(null);
    const res = await fetch("/api/setores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: novoNome.trim() }),
    });
    setCriando(false);
    if (res.ok) {
      setNovoNome("");
      buscar();
    } else {
      const j = await res.json().catch(() => ({}));
      setErro(j.error ?? "Erro ao criar setor.");
    }
  }

  async function salvarEdicao(id: string) {
    if (!nomeEdicao.trim()) return;
    const res = await fetch(`/api/setores/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: nomeEdicao.trim() }),
    });
    if (res.ok) {
      setEditandoId(null);
      buscar();
    } else {
      const j = await res.json().catch(() => ({}));
      setErro(j.error ?? "Erro ao renomear setor.");
    }
  }

  async function alternarAtivo(s: Setor) {
    const res = await fetch(`/api/setores/${s.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !s.ativo }),
    });
    if (res.ok) buscar();
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/config" className="hover:text-gray-900">Configurações</Link>
        <span>/</span>
        <span className="text-gray-900">Setores</span>
      </div>

      <p className="text-sm text-gray-500">
        Setores aparecem no menu lateral, nas obrigações e nos responsáveis de cada cliente.
        Desativar um setor não apaga histórico — só tira ele das opções para uso futuro.
      </p>

      <form onSubmit={criar} className="card flex gap-2 items-end">
        <div className="flex-1">
          <label className="label">Novo setor</label>
          <input className="input" placeholder="Ex: Cobrança"
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
        ) : setores.length === 0 ? (
          <p className="text-center py-8 text-gray-400 text-sm">Nenhum setor cadastrado ainda.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {setores.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                {editandoId === s.id ? (
                  <input
                    className="input flex-1 text-sm"
                    value={nomeEdicao}
                    onChange={(e) => setNomeEdicao(e.target.value)}
                    autoFocus
                  />
                ) : (
                  <span className={`flex-1 text-sm ${s.ativo ? "text-gray-800" : "text-gray-400 line-through"}`}>
                    {s.nome}
                  </span>
                )}

                <span className="text-xs text-gray-400">
                  {s._count.usuarios} usuário(s) · {s._count.obrigacaoTemplates} obrigação(ões)
                </span>

                {editandoId === s.id ? (
                  <>
                    <button onClick={() => salvarEdicao(s.id)} className="text-xs text-brand-600 hover:underline">Salvar</button>
                    <button onClick={() => setEditandoId(null)} className="text-xs text-gray-400 hover:underline">Cancelar</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setEditandoId(s.id); setNomeEdicao(s.nome); }} className="text-xs text-gray-500 hover:underline">
                      Editar
                    </button>
                    <button onClick={() => alternarAtivo(s)} className="text-xs text-gray-500 hover:underline">
                      {s.ativo ? "Desativar" : "Reativar"}
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
