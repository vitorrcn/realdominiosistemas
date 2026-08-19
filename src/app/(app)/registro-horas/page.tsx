"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface Atividade {
  id: string;
  nome: string;
  descricao: string | null;
  exigeCliente: boolean;
  exigeQuantidade: boolean;
  unidadeQuantidade: string | null;
}

interface Registro {
  id: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  quantidade: number | null;
  observacao: string | null;
  atividade: { id: string; nome: string; exigeCliente: boolean; exigeQuantidade: boolean; unidadeQuantidade: string | null };
  empresa: { id: string; codigoInterno: string; razaoSocial: string } | null;
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function horaLocal(iso: string): string {
  return iso.slice(11, 16);
}

function minutos(r: Registro): number {
  const [hi, mi] = r.horaInicio.slice(11, 16).split(":").map(Number);
  const [hf, mf] = r.horaFim.slice(11, 16).split(":").map(Number);
  return (hf * 60 + mf) - (hi * 60 + mi);
}

function formatarDuracao(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

export default function RegistroHorasPage() {
  const { data: session } = useSession();
  const isDiretoria = (session?.user as any)?.perfilGlobal === "DIRETORIA";

  const [data, setData] = useState(hoje());
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [form, setForm] = useState({
    atividadeId: "", empresaId: "", horaInicio: "", horaFim: "", quantidade: "", observacao: "",
  });
  const [buscaEmpresa, setBuscaEmpresa] = useState("");
  const [resultadosEmpresa, setResultadosEmpresa] = useState<any[]>([]);
  const [empresaEscolhida, setEmpresaEscolhida] = useState<any>(null);

  useEffect(() => {
    fetch("/api/atividades").then((r) => r.ok ? r.json() : []).then(setAtividades).catch(() => {});
  }, []);

  const buscar = useCallback(async () => {
    setCarregando(true);
    const res = await fetch(`/api/registro-horas?data=${data}`);
    if (res.ok) setRegistros(await res.json());
    setCarregando(false);
  }, [data]);

  useEffect(() => { buscar(); }, [buscar]);

  useEffect(() => {
    if (!buscaEmpresa || empresaEscolhida) { setResultadosEmpresa([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/empresas?q=${encodeURIComponent(buscaEmpresa)}&pageSize=6`);
      if (res.ok) setResultadosEmpresa((await res.json()).data);
    }, 300);
    return () => clearTimeout(t);
  }, [buscaEmpresa, empresaEscolhida]);

  const atividadeEscolhida = atividades.find((a) => a.id === form.atividadeId);

  function abrirNovo() {
    setForm({ atividadeId: "", empresaId: "", horaInicio: "", horaFim: "", quantidade: "", observacao: "" });
    setEmpresaEscolhida(null);
    setBuscaEmpresa("");
    setEditandoId(null);
    setErro(null);
    setMostrarForm(true);
  }

  function abrirEdicao(r: Registro) {
    setForm({
      atividadeId: r.atividade.id,
      empresaId: r.empresa?.id ?? "",
      horaInicio: horaLocal(r.horaInicio),
      horaFim: horaLocal(r.horaFim),
      quantidade: r.quantidade != null ? String(r.quantidade) : "",
      observacao: r.observacao ?? "",
    });
    setEmpresaEscolhida(r.empresa);
    setBuscaEmpresa("");
    setEditandoId(r.id);
    setErro(null);
    setMostrarForm(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (atividadeEscolhida?.exigeCliente && !empresaEscolhida) {
      setErro(`A atividade "${atividadeEscolhida.nome}" exige informar o cliente.`);
      return;
    }
    if (atividadeEscolhida?.exigeQuantidade && !(Number(form.quantidade) > 0)) {
      setErro(`A atividade "${atividadeEscolhida.nome}" exige informar a quantidade.`);
      return;
    }
    setSalvando(true);
    const payload = {
      atividadeId: form.atividadeId,
      empresaId: empresaEscolhida?.id || null,
      data,
      horaInicio: form.horaInicio,
      horaFim: form.horaFim,
      quantidade: atividadeEscolhida?.exigeQuantidade ? Number(form.quantidade) : null,
      observacao: form.observacao || null,
    };
    const res = editandoId
      ? await fetch(`/api/registro-horas/${editandoId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        })
      : await fetch("/api/registro-horas", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
    setSalvando(false);
    if (res.ok) {
      setMostrarForm(false);
      buscar();
    } else {
      const j = await res.json().catch(() => ({}));
      setErro(j.error ?? "Erro ao salvar registro.");
    }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este registro?")) return;
    const res = await fetch(`/api/registro-horas/${id}`, { method: "DELETE" });
    if (res.ok) buscar();
  }

  const totalMinutosDia = registros.reduce((acc, r) => acc + minutos(r), 0);

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg font-semibold text-gray-900">Registro de horas</h1>
        {isDiretoria && (
          <Link href="/registro-horas/relatorios" className="btn btn-sm">Ver relatórios</Link>
        )}
      </div>

      <div className="card flex items-center gap-3 flex-wrap">
        <label className="label mb-0">Dia</label>
        <input className="input w-44" type="date" value={data} max={hoje()} onChange={(e) => setData(e.target.value)} />
        <button onClick={() => setData(hoje())} className="btn btn-sm">Hoje</button>
        <span className="text-sm text-gray-500 ml-auto">
          Total do dia: <strong className="text-gray-900">{formatarDuracao(totalMinutosDia)}</strong>
        </span>
        <button onClick={abrirNovo} className="btn btn-primary btn-sm">+ Novo registro</button>
      </div>

      {carregando ? (
        <div className="card text-center py-10 text-gray-400">Carregando...</div>
      ) : registros.length === 0 ? (
        <div className="card text-center py-10 text-gray-400">
          Nenhuma atividade registrada nesse dia ainda.
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {registros.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <span className="font-mono text-xs text-gray-500 w-24 flex-shrink-0">
                  {horaLocal(r.horaInicio)}–{horaLocal(r.horaFim)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-800">{r.atividade.nome}</div>
                  {r.empresa && (
                    <div className="text-xs text-gray-400">
                      <span className="font-mono">{r.empresa.codigoInterno}</span> — {r.empresa.razaoSocial}
                    </div>
                  )}
                  {r.quantidade != null && (
                    <div className="text-xs text-gray-400">
                      {r.quantidade} {r.atividade.unidadeQuantidade || "unidade(s)"}
                    </div>
                  )}
                  {r.observacao && <div className="text-xs text-gray-400 italic">{r.observacao}</div>}
                </div>
                <span className="badge badge-gray flex-shrink-0">{formatarDuracao(minutos(r))}</span>
                <button onClick={() => abrirEdicao(r)} className="text-xs text-gray-500 hover:underline flex-shrink-0">Editar</button>
                <button onClick={() => excluir(r.id)} className="text-xs text-red-500 hover:underline flex-shrink-0">Excluir</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {mostrarForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setMostrarForm(false)}>
          <form onSubmit={salvar} className="card w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-semibold text-gray-900">
              {editandoId ? "Editar registro" : "Novo registro"} — {new Date(data + "T00:00:00").toLocaleDateString("pt-BR")}
            </h2>

            <div>
              <label className="label">Atividade</label>
              <select className="select" value={form.atividadeId} required
                onChange={(e) => setForm((p) => ({ ...p, atividadeId: e.target.value }))}>
                <option value="">Selecione...</option>
                {atividades.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </div>

            {atividadeEscolhida?.exigeCliente && (
              <div className="relative">
                <label className="label">Cliente</label>
                <input
                  className="input"
                  placeholder="Buscar cliente por nome ou código..."
                  value={empresaEscolhida ? `${empresaEscolhida.codigoInterno} — ${empresaEscolhida.razaoSocial}` : buscaEmpresa}
                  onChange={(e) => { setBuscaEmpresa(e.target.value); setEmpresaEscolhida(null); }}
                />
                {resultadosEmpresa.length > 0 && !empresaEscolhida && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {resultadosEmpresa.map((e: any) => (
                      <button key={e.id} type="button" onClick={() => { setEmpresaEscolhida(e); setResultadosEmpresa([]); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                        <span className="font-mono font-bold text-brand-700">{e.codigoInterno}</span> — {e.razaoSocial}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Início</label>
                <input className="input" type="time" value={form.horaInicio} required
                  onChange={(e) => setForm((p) => ({ ...p, horaInicio: e.target.value }))} />
              </div>
              <div>
                <label className="label">Fim</label>
                <input className="input" type="time" value={form.horaFim} required
                  onChange={(e) => setForm((p) => ({ ...p, horaFim: e.target.value }))} />
              </div>
            </div>

            {atividadeEscolhida?.exigeQuantidade && (
              <div>
                <label className="label">
                  Quantidade {atividadeEscolhida.unidadeQuantidade ? `(${atividadeEscolhida.unidadeQuantidade})` : ""}
                </label>
                <input className="input" type="number" min={1} step={1} value={form.quantidade} required
                  onChange={(e) => setForm((p) => ({ ...p, quantidade: e.target.value }))} />
              </div>
            )}

            <div>
              <label className="label">Observação (opcional)</label>
              <input className="input" value={form.observacao}
                onChange={(e) => setForm((p) => ({ ...p, observacao: e.target.value }))} />
            </div>

            {erro && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{erro}</div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setMostrarForm(false)} className="btn">Cancelar</button>
              <button type="submit" disabled={salvando} className="btn btn-primary">
                {salvando ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
