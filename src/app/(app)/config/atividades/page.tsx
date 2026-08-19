"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Atividade {
  id: string;
  nome: string;
  descricao: string | null;
  exigeCliente: boolean;
  ativo: boolean;
  ordem: number;
  _count: { registros: number };
}

export default function AtividadesPage() {
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [novoNome, setNovoNome] = useState("");
  const [novoExigeCliente, setNovoExigeCliente] = useState(false);
  const [criando, setCriando] = useState(false);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [exigeClienteEdicao, setExigeClienteEdicao] = useState(false);

  const buscar = useCallback(async () => {
    setCarregando(true);
    const res = await fetch("/api/atividades?todos=true");
    if (res.ok) setAtividades(await res.json());
    setCarregando(false);
  }, []);

  useEffect(() => { buscar(); }, [buscar]);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!novoNome.trim()) return;
    setCriando(true);
    setErro(null);
    const res = await fetch("/api/atividades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: novoNome.trim(), exigeCliente: novoExigeCliente }),
    });
    setCriando(false);
    if (res.ok) {
      setNovoNome("");
      setNovoExigeCliente(false);
      buscar();
    } else {
      const j = await res.json().catch(() => ({}));
      setErro(j.error ?? "Erro ao criar atividade.");
    }
  }

  async function salvarEdicao(id: string) {
    if (!nomeEdicao.trim()) return;
    const res = await fetch(`/api/atividades/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: nomeEdicao.trim(), exigeCliente: exigeClienteEdicao }),
    });
    if (res.ok) { setEditandoId(null); buscar(); }
    else {
      const j = await res.json().catch(() => ({}));
      setErro(j.error ?? "Erro ao salvar atividade.");
    }
  }

  async function alternarAtivo(a: Atividade) {
    const res = await fetch(`/api/atividades/${a.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !a.ativo }),
    });
    if (res.ok) buscar();
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/config" className="hover:text-gray-900">Configurações</Link>
        <span>/</span>
        <span className="text-gray-900">Atividades</span>
      </div>

      <p className="text-sm text-gray-500">
        Essa lista alimenta o &quot;Registro de horas&quot; — cada usuário escolhe uma dessas atividades ao
        apontar o que fez no dia. Marque &quot;Exige cliente&quot; pras atividades que precisam dizer pra
        qual cliente o trabalho foi feito.
      </p>

      <form onSubmit={criar} className="card space-y-3">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="label">Nova atividade</label>
            <input className="input" placeholder="Ex: Fechamento contábil"
              value={novoNome} onChange={(e) => setNovoNome(e.target.value)} />
          </div>
          <button type="submit" disabled={criando} className="btn btn-primary">
            {criando ? "Adicionando..." : "Adicionar"}
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={novoExigeCliente} onChange={(e) => setNovoExigeCliente(e.target.checked)} />
          Exige informar o cliente
        </label>
      </form>

      {erro && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
          <span className="text-sm text-red-700">{erro}</span>
        </div>
      )}

      <div className="card !p-0 overflow-hidden">
        {carregando ? (
          <p className="text-center py-8 text-gray-400 text-sm">Carregando...</p>
        ) : atividades.length === 0 ? (
          <p className="text-center py-8 text-gray-400 text-sm">Nenhuma atividade cadastrada ainda.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {atividades.map((a) => (
              <div key={a.id} className="px-4 py-3">
                {editandoId === a.id ? (
                  <div className="space-y-2">
                    <input className="input text-sm" value={nomeEdicao} onChange={(e) => setNomeEdicao(e.target.value)} autoFocus />
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                        <input type="checkbox" checked={exigeClienteEdicao} onChange={(e) => setExigeClienteEdicao(e.target.checked)} />
                        Exige cliente
                      </label>
                      <div className="flex gap-3 ml-auto">
                        <button onClick={() => salvarEdicao(a.id)} className="text-xs text-brand-600 hover:underline">Salvar</button>
                        <button onClick={() => setEditandoId(null)} className="text-xs text-gray-400 hover:underline">Cancelar</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className={`flex-1 text-sm ${a.ativo ? "text-gray-800" : "text-gray-400 line-through"}`}>
                      {a.nome}
                      {a.exigeCliente && <span className="ml-2 badge badge-blue text-[10px]">exige cliente</span>}
                    </span>
                    <span className="text-xs text-gray-400">{a._count.registros} registro(s)</span>
                    <button
                      onClick={() => { setEditandoId(a.id); setNomeEdicao(a.nome); setExigeClienteEdicao(a.exigeCliente); }}
                      className="text-xs text-gray-500 hover:underline"
                    >
                      Editar
                    </button>
                    <button onClick={() => alternarAtivo(a)} className="text-xs text-gray-500 hover:underline">
                      {a.ativo ? "Desativar" : "Reativar"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
