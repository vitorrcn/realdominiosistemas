"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

interface Template {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  qtdEmpresas: number;
  setor?: { id: string; nome: string };
  diaVencimento: number | null;
  vencimentoMesSeguinte: boolean;
}

export default function TemplatesObrigacoesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [setores, setSetores] = useState<{ id: string; nome: string }[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [diaEdicao, setDiaEdicao] = useState("");
  const [mesSeguinteEdicao, setMesSeguinteEdicao] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [novoSetorId, setNovoSetorId] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novoDia, setNovoDia] = useState("");
  const [novoMesSeguinte, setNovoMesSeguinte] = useState(false);
  const [criando, setCriando] = useState(false);
  const primeiraCargaRef = useRef(true);

  const buscar = useCallback(async () => {
    if (primeiraCargaRef.current) setCarregando(true);
    const res = await fetch("/api/obrigacoes/templates?todos=true");
    if (res.ok) setTemplates(await res.json());
    else {
      const j = await res.json().catch(() => ({}));
      setErro(j.error ?? "Erro ao carregar.");
    }
    setCarregando(false);
    primeiraCargaRef.current = false;
  }, []);

  useEffect(() => {
    buscar();
    fetch("/api/setores").then((r) => r.ok ? r.json() : []).then(setSetores).catch(() => {});
  }, [buscar]);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!novoNome.trim() || !novoSetorId) return;
    setCriando(true);
    const res = await fetch("/api/obrigacoes/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        setorId: novoSetorId,
        nome: novoNome.trim(),
        diaVencimento: novoDia || null,
        vencimentoMesSeguinte: novoMesSeguinte,
      }),
    });
    setCriando(false);
    if (res.ok) {
      setNovoNome("");
      setNovoSetorId("");
      setNovoDia("");
      setNovoMesSeguinte(false);
      setMostrarForm(false);
      buscar();
    } else {
      const j = await res.json().catch(() => ({}));
      setErro(j.error ?? "Erro ao criar obrigação.");
    }
  }

  async function salvarEdicao(id: string) {
    if (!nomeEdicao.trim()) return;
    const res = await fetch(`/api/obrigacoes/templates/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: nomeEdicao.trim(),
        diaVencimento: diaEdicao || null,
        vencimentoMesSeguinte: mesSeguinteEdicao,
      }),
    });
    if (res.ok) { setEditandoId(null); buscar(); }
  }

  async function alternarAtivo(t: Template) {
    const res = await fetch(`/api/obrigacoes/templates/${t.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !t.ativo }),
    });
    if (res.ok) buscar();
  }

  const agrupados = templates.reduce((acc: Record<string, Template[]>, t) => {
    const nomeSetor = t.setor?.nome ?? "Sem setor";
    if (!acc[nomeSetor]) acc[nomeSetor] = [];
    acc[nomeSetor].push(t);
    return acc;
  }, {});

  function descreverVencimento(t: Template) {
    if (!t.diaVencimento) return null;
    return `Vence dia ${t.diaVencimento}${t.vencimentoMesSeguinte ? " do mês seguinte" : ""}`;
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/config" className="hover:text-gray-900">Configurações</Link>
        <span>/</span>
        <span className="text-gray-900">Templates de obrigações</span>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Todas as obrigações cadastradas, de todos os setores. Pra vincular clientes a uma obrigação,
          use &quot;Gerenciar clientes&quot; dentro da tela do Setor. Definir o dia de vencimento faz o
          sistema marcar automaticamente como &quot;Em atraso&quot; quem passar da data.
        </p>
        <button onClick={() => setMostrarForm((v) => !v)} className="btn btn-sm text-brand-600 flex-shrink-0 ml-3">
          {mostrarForm ? "Cancelar" : "+ Nova"}
        </button>
      </div>

      {mostrarForm && (
        <form onSubmit={criar} className="card space-y-3">
          <div className="flex gap-2 items-end flex-wrap">
            <div>
              <label className="label">Setor</label>
              <select className="select text-sm" value={novoSetorId} onChange={(e) => setNovoSetorId(e.target.value)} required>
                <option value="">Selecione...</option>
                {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="label">Nome da obrigação</label>
              <input className="input" placeholder="Ex: PGDAS" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} required />
            </div>
          </div>
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <label className="label">Dia de vencimento</label>
              <input className="input w-28" type="number" min={1} max={31} placeholder="Ex: 20"
                value={novoDia} onChange={(e) => setNovoDia(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer pb-2">
              <input type="checkbox" checked={novoMesSeguinte} onChange={(e) => setNovoMesSeguinte(e.target.checked)} />
              Vence no mês seguinte à competência
            </label>
            <button type="submit" disabled={criando} className="btn btn-primary ml-auto">
              {criando ? "Criando..." : "Criar"}
            </button>
          </div>
        </form>
      )}

      {erro && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
          <span className="text-sm text-red-700">{erro}</span>
        </div>
      )}

      {carregando ? (
        <p className="text-center py-8 text-gray-400 text-sm">Carregando...</p>
      ) : templates.length === 0 ? (
        <p className="text-center py-8 text-gray-400 text-sm">Nenhuma obrigação cadastrada ainda.</p>
      ) : (
        Object.entries(agrupados).map(([nomeSetor, itens]) => (
          <div key={nomeSetor} className="card !p-0 overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <h3 className="text-xs font-semibold text-gray-600 uppercase">{nomeSetor}</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {itens.map((t) => (
                <div key={t.id} className="px-4 py-3">
                  {editandoId === t.id ? (
                    <div className="space-y-2">
                      <input className="input text-sm" value={nomeEdicao} onChange={(e) => setNomeEdicao(e.target.value)} autoFocus />
                      <div className="flex gap-3 items-end flex-wrap">
                        <div>
                          <label className="label">Dia de vencimento</label>
                          <input className="input w-24 text-sm" type="number" min={1} max={31}
                            value={diaEdicao} onChange={(e) => setDiaEdicao(e.target.value)} />
                        </div>
                        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer pb-2">
                          <input type="checkbox" checked={mesSeguinteEdicao} onChange={(e) => setMesSeguinteEdicao(e.target.checked)} />
                          Mês seguinte
                        </label>
                        <div className="flex gap-3 ml-auto">
                          <button onClick={() => salvarEdicao(t.id)} className="text-xs text-brand-600 hover:underline">Salvar</button>
                          <button onClick={() => setEditandoId(null)} className="text-xs text-gray-400 hover:underline">Cancelar</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm ${t.ativo ? "text-gray-800" : "text-gray-400 line-through"}`}>{t.nome}</span>
                        {descreverVencimento(t) && (
                          <span className="ml-2 text-xs text-gray-400">{descreverVencimento(t)}</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">{t.qtdEmpresas} cliente(s)</span>
                      <button
                        onClick={() => {
                          setEditandoId(t.id);
                          setNomeEdicao(t.nome);
                          setDiaEdicao(t.diaVencimento ? String(t.diaVencimento) : "");
                          setMesSeguinteEdicao(t.vencimentoMesSeguinte);
                        }}
                        className="text-xs text-gray-500 hover:underline"
                      >
                        Editar
                      </button>
                      <button onClick={() => alternarAtivo(t)} className="text-xs text-gray-500 hover:underline">
                        {t.ativo ? "Desativar" : "Reativar"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
