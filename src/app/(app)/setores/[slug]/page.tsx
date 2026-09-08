"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import type { StatusEmpresa } from "@prisma/client";
import { BadgeEmpresa } from "@/components/ui/StatusBadge";
import { formatCompetencia } from "@/lib/utils";

const TITULOS: Record<string, string> = {
  fiscal: "Fiscal",
  contabil: "Contábil",
  dp: "Departamento Pessoal",
  societario: "Societário",
};

interface LinhaSetor {
  id: string;
  codigoInterno: string;
  razaoSocial: string;
  status: StatusEmpresa;
  responsavel: string | null;
  obrigacoes: { pendente: number; emAtraso: number; concluido: number };
}

interface TemplateObrigacao {
  id: string;
  nome: string;
  descricao: string | null;
  qtdEmpresas: number;
}

export default function SetorResumoPage({ params }: { params: { slug: string } }) {
  const { data: session } = useSession();
  const perfil = (session?.user as any)?.perfilGlobal ?? "";
  const podeGerenciarObrigacoes = ["DIRETORIA", "LIDER"].includes(perfil);

  const titulo = TITULOS[params.slug] ?? params.slug;

  // ── Clientes vinculados ao setor ──────────────────────────────
  const [dados, setDados] = useState<LinhaSetor[]>([]);
  const [competencia, setCompetencia] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [soComPendencia, setSoComPendencia] = useState(false);
  const primeiraCargaRef = useRef(true);

  const buscarResumo = useCallback(() => {
    if (primeiraCargaRef.current) setCarregando(true);
    fetch(`/api/setores/resumo?slug=${params.slug}`)
      .then(async (r) => {
        if (!r.ok) { const j = await r.json(); throw new Error(j.error ?? "Erro ao carregar"); }
        return r.json();
      })
      .then((json) => { setDados(json.dados); setCompetencia(json.competencia); })
      .catch((e) => setErro(e.message))
      .finally(() => { setCarregando(false); primeiraCargaRef.current = false; });
  }, [params.slug]);

  useEffect(() => { buscarResumo(); }, [buscarResumo]);

  const filtrados = dados.filter((d) => {
    if (soComPendencia && d.obrigacoes.pendente === 0 && d.obrigacoes.emAtraso === 0) return false;
    if (q && !d.razaoSocial.toLowerCase().includes(q.toLowerCase()) && !d.codigoInterno.includes(q)) return false;
    return true;
  });

  const totalAtraso = dados.reduce((s, d) => s + d.obrigacoes.emAtraso, 0);
  const totalPendente = dados.reduce((s, d) => s + d.obrigacoes.pendente, 0);

  // ── Setor real (para chamar as APIs de template) ──────────────
  const [setorId, setSetorId] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/setores").then((r) => r.json()).then((lista: any[]) => {
      const nomeReal = TITULOS[params.slug];
      setSetorId(lista.find((s) => s.nome === nomeReal)?.id ?? null);
    });
  }, [params.slug]);

  if (erro) return <div className="card text-center py-12 text-red-500">{erro}</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Setor {titulo}</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          {competencia && `Competência ${formatCompetencia(competencia)} · `}
          {dados.length} cliente{dados.length !== 1 ? "s" : ""} vinculado{dados.length !== 1 ? "s" : ""}
          {totalAtraso > 0 && <span className="text-red-500 font-medium"> · {totalAtraso} obrigação(ões) em atraso</span>}
          {totalPendente > 0 && <span className="text-yellow-600"> · {totalPendente} pendente(s)</span>}
        </p>
      </div>

      {setorId && (
        <ObrigacoesDoSetor setorId={setorId} podeGerenciar={podeGerenciarObrigacoes} onMudou={buscarResumo} />
      )}

      <div className="card space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <input className="input text-sm flex-1 min-w-[220px] max-w-sm" placeholder="Buscar cliente ou código..."
            value={q} onChange={(e) => setQ(e.target.value)} />
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
            <input type="checkbox" className="w-4 h-4 rounded text-brand-600"
              checked={soComPendencia} onChange={(e) => setSoComPendencia(e.target.checked)} />
            Só com pendência
          </label>
        </div>
      </div>

      <div className="card !p-0 overflow-hidden">
        <table className="table-auto-fixed">
          <thead>
            <tr>
              <th style={{ width: 70 }}>Código</th>
              <th>Cliente</th>
              <th style={{ width: 110 }}>Status</th>
              <th style={{ width: 140 }}>Responsável</th>
              <th style={{ width: 160 }}>Obrigações do mês</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr><td colSpan={5} className="text-center py-10 text-gray-400">Carregando...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-gray-400">
                Nenhum cliente vinculado a este setor ainda. {podeGerenciarObrigacoes && "Crie uma obrigação acima e vincule os clientes."}
              </td></tr>
            ) : filtrados.map((d) => (
              <tr key={d.id}>
                <td className="font-mono font-bold text-brand-700 text-sm">{d.codigoInterno}</td>
                <td>
                  <Link href={`/empresas/${d.id}?aba=${params.slug}`} className="font-medium text-gray-900 hover:text-brand-700">
                    {d.razaoSocial}
                  </Link>
                </td>
                <td><BadgeEmpresa status={d.status} /></td>
                <td className="text-xs text-gray-500">{d.responsavel ?? "—"}</td>
                <td>
                  <div className="flex gap-1.5 text-[10px]">
                    {d.obrigacoes.emAtraso > 0 && <span className="badge bg-red-100 text-red-700">{d.obrigacoes.emAtraso} atrasada(s)</span>}
                    {d.obrigacoes.pendente > 0 && <span className="badge bg-yellow-100 text-yellow-700">{d.obrigacoes.pendente} pendente(s)</span>}
                    {d.obrigacoes.concluido > 0 && <span className="badge bg-green-100 text-green-700">{d.obrigacoes.concluido} ok</span>}
                    {d.obrigacoes.emAtraso === 0 && d.obrigacoes.pendente === 0 && d.obrigacoes.concluido === 0 && (
                      <span className="text-gray-300">sem pendência este mês</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Bloco de gestão das obrigações do setor ──────────────────────
function ObrigacoesDoSetor({ setorId, podeGerenciar, onMudou }: { setorId: string; podeGerenciar: boolean; onMudou: () => void }) {
  const [templates, setTemplates] = useState<TemplateObrigacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [criando, setCriando] = useState(false);
  const [templateAberto, setTemplateAberto] = useState<string | null>(null);
  const primeiraCargaRef = useRef(true);

  const buscar = useCallback(async () => {
    if (primeiraCargaRef.current) setCarregando(true);
    const res = await fetch(`/api/obrigacoes/templates?setorId=${setorId}`);
    if (res.ok) setTemplates(await res.json());
    setCarregando(false);
    primeiraCargaRef.current = false;
  }, [setorId]);

  useEffect(() => { buscar(); }, [buscar]);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!novoNome.trim()) return;
    setCriando(true);
    const res = await fetch("/api/obrigacoes/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setorId, nome: novoNome.trim() }),
    });
    setCriando(false);
    if (res.ok) {
      setNovoNome("");
      setMostrarForm(false);
      buscar();
    }
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Obrigações deste setor</h2>
        {podeGerenciar && (
          <button onClick={() => setMostrarForm((v) => !v)} className="text-xs text-brand-600 hover:underline">
            {mostrarForm ? "Cancelar" : "+ Nova obrigação"}
          </button>
        )}
      </div>

      {mostrarForm && (
        <form onSubmit={criar} className="flex gap-2">
          <input className="input text-sm flex-1" placeholder="Nome da obrigação (ex: PGDAS, eSocial)"
            value={novoNome} onChange={(e) => setNovoNome(e.target.value)} autoFocus />
          <button type="submit" disabled={criando} className="btn btn-primary btn-sm">
            {criando ? "Criando..." : "Criar"}
          </button>
        </form>
      )}

      {carregando ? (
        <p className="text-xs text-gray-400">Carregando...</p>
      ) : templates.length === 0 ? (
        <p className="text-xs text-gray-400">Nenhuma obrigação cadastrada ainda neste setor.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {templates.map((t) => (
            <div key={t.id} className="py-2">
              <div className="flex items-center justify-between">
                <div>
                  <Link href={`/obrigacoes/templates/${t.id}`} className="text-sm font-medium text-gray-800 hover:text-brand-700 hover:underline">
                    {t.nome}
                  </Link>
                  <span className="text-xs text-gray-400 ml-2">{t.qtdEmpresas} cliente(s) vinculado(s)</span>
                </div>
                {podeGerenciar && (
                  <button
                    onClick={() => setTemplateAberto((cur) => cur === t.id ? null : t.id)}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    {templateAberto === t.id ? "Fechar" : "Gerenciar clientes"}
                  </button>
                )}
              </div>
              {templateAberto === t.id && (
                <GerenciarClientesTemplate
                  templateId={t.id}
                  onMudou={() => { buscar(); onMudou(); }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GerenciarClientesTemplate({ templateId, onMudou }: { templateId: string; onMudou: () => void }) {
  const [q, setQ] = useState("");
  const [clientes, setClientes] = useState<{ id: string; codigoInterno: string; razaoSocial: string; vinculada: boolean }[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [vinculandoTodos, setVinculandoTodos] = useState(false);
  const primeiraCargaRef = useRef(true);

  const buscar = useCallback(async () => {
    if (primeiraCargaRef.current) setCarregando(true);
    const res = await fetch(`/api/obrigacoes/templates/${templateId}/empresas?q=${encodeURIComponent(q)}`);
    if (res.ok) setClientes(await res.json());
    setCarregando(false);
    primeiraCargaRef.current = false;
  }, [templateId, q]);

  useEffect(() => {
    const t = setTimeout(buscar, 250);
    return () => clearTimeout(t);
  }, [buscar]);

  async function alternar(empresaId: string, vinculadaAtual: boolean) {
    setSalvandoId(empresaId);
    const res = await fetch(`/api/obrigacoes/templates/${templateId}/empresas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empresaId, ativa: !vinculadaAtual }),
    });
    if (res.ok) {
      setClientes((prev) => prev.map((c) => c.id === empresaId ? { ...c, vinculada: !vinculadaAtual } : c));
      onMudou();
    }
    setSalvandoId(null);
  }

  async function vincularTodos() {
    if (!confirm("Vincular TODOS os clientes ativos a esta obrigação de uma vez? Isso não desvincula ninguém, só adiciona quem ainda não estava.")) return;
    setVinculandoTodos(true);
    const res = await fetch(`/api/obrigacoes/templates/${templateId}/vincular-todos`, { method: "POST" });
    setVinculandoTodos(false);
    if (res.ok) {
      const json = await res.json();
      alert(`${json.vinculadas} cliente(s) vinculado(s) com sucesso.`);
      buscar();
      onMudou();
    } else {
      alert("Erro ao vincular todos os clientes.");
    }
  }

  return (
    <div className="mt-2 border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <input
          className="input text-sm flex-1"
          placeholder="Buscar cliente por nome ou código..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="button"
          onClick={vincularTodos}
          disabled={vinculandoTodos}
          className="btn btn-sm flex-shrink-0"
        >
          {vinculandoTodos ? "Vinculando..." : "Vincular todos ativos"}
        </button>
      </div>
      <div className="max-h-64 overflow-y-auto space-y-1">
        {carregando ? (
          <p className="text-xs text-gray-400">Carregando...</p>
        ) : clientes.length === 0 ? (
          <p className="text-xs text-gray-400">Nenhum cliente encontrado.</p>
        ) : clientes.map((c) => (
          <label key={c.id} className="flex items-center gap-2 cursor-pointer py-1 px-1 hover:bg-white rounded">
            <input
              type="checkbox"
              className="w-4 h-4 rounded text-brand-600"
              checked={c.vinculada}
              disabled={salvandoId === c.id}
              onChange={() => alternar(c.id, c.vinculada)}
            />
            <span className="text-sm text-gray-700 flex-1">{c.razaoSocial}</span>
            <span className="font-mono font-bold text-brand-700 text-sm">{c.codigoInterno}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
