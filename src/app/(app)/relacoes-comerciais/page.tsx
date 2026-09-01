"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { formatData, cn } from "@/lib/utils";

interface EmpresaResumida {
  id: string;
  codigoInterno: string;
  razaoSocial: string;
}

interface RelacaoComercial {
  id: string;
  prestador: EmpresaResumida;
  tomador: EmpresaResumida;
  ramo: { id: string; nome: string } | null;
  descricao: string | null;
  valor: string | null;
  data: string | null;
  observacoes: string | null;
  criadoPor: { id: string; nome: string };
  createdAt: string;
}

const fmtMoeda = (v: string | number | null) =>
  v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function RelacoesComerciaisPage() {
  const [relacoes, setRelacoes] = useState<RelacaoComercial[]>([]);
  const [ramos, setRamos] = useState<{ id: string; nome: string }[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroEmpresa, setFiltroEmpresa] = useState<EmpresaResumida | null>(null);
  const [filtroRamo, setFiltroRamo] = useState("");
  const [modal, setModal] = useState<{ aberto: boolean; item?: RelacaoComercial } | null>(null);
  const primeiraCargaRef = useRef(true);

  const buscar = useCallback(async () => {
    if (primeiraCargaRef.current) setCarregando(true);
    setErro(null);
    const params = new URLSearchParams();
    if (filtroEmpresa) params.set("empresaId", filtroEmpresa.id);
    if (filtroRamo) params.set("ramoId", filtroRamo);
    const res = await fetch(`/api/relacoes-comerciais?${params}`);
    if (res.ok) setRelacoes(await res.json());
    else {
      const json = await res.json().catch(() => ({}));
      setErro(json.error ?? "Erro ao carregar relações comerciais.");
    }
    setCarregando(false);
    primeiraCargaRef.current = false;
  }, [filtroEmpresa, filtroRamo]);

  useEffect(() => { buscar(); }, [buscar]);
  useEffect(() => {
    fetch("/api/ramos").then((r) => r.ok ? r.json() : []).then(setRamos).catch(() => {});
  }, []);

  async function excluir(item: RelacaoComercial) {
    if (!confirm(`Excluir a relação entre ${item.prestador.codigoInterno} e ${item.tomador.codigoInterno}?`)) return;
    const res = await fetch(`/api/relacoes-comerciais/${item.id}`, { method: "DELETE" });
    if (res.ok) buscar();
  }

  const totalValor = relacoes.reduce((acc, r) => acc + (r.valor ? Number(r.valor) : 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Relações comerciais entre clientes</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Área restrita — registro de quando um cliente presta serviço ou vende produto para outro cliente do escritório.
            {relacoes.length > 0 && <> · {relacoes.length} relação(ões) · {fmtMoeda(totalValor)} no total</>}
          </p>
        </div>
        <button onClick={() => setModal({ aberto: true })} className="btn btn-primary btn-sm">
          + Nova relação
        </button>
      </div>

      <div className="card flex flex-wrap gap-3 items-end">
        <div className="min-w-[220px]">
          <label className="label">Filtrar por cliente</label>
          <SeletorEmpresa valor={filtroEmpresa} onSelecionar={setFiltroEmpresa} placeholder="Qualquer cliente (prestador ou tomador)" />
        </div>
        <div>
          <label className="label">Categoria</label>
          <select className="select text-sm w-52" value={filtroRamo} onChange={(e) => setFiltroRamo(e.target.value)}>
            <option value="">Todas</option>
            {ramos.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </div>
        {(filtroEmpresa || filtroRamo) && (
          <button onClick={() => { setFiltroEmpresa(null); setFiltroRamo(""); }} className="btn btn-sm text-gray-400">
            Limpar filtros
          </button>
        )}
      </div>

      {erro ? (
        <div className="card text-center py-10 text-red-500">{erro}</div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          <table className="table-auto-fixed">
            <thead>
              <tr>
                <th style={{ width: "18%" }}>Prestador</th>
                <th style={{ width: "18%" }}>Tomador</th>
                <th style={{ width: "15%" }}>Categoria</th>
                <th style={{ width: "23%" }}>Descrição</th>
                <th style={{ width: "16%" }}>Valor</th>
                <th style={{ width: "10%" }}></th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">Carregando...</td></tr>
              ) : relacoes.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">Nenhuma relação comercial cadastrada ainda.</td></tr>
              ) : relacoes.map((r) => (
                <tr key={r.id} onClick={() => setModal({ aberto: true, item: r })} className="cursor-pointer">
                  <td>
                    <div className="font-mono font-bold text-brand-700 text-sm">{r.prestador.codigoInterno}</div>
                    <div className="text-xs text-gray-500 truncate">{r.prestador.razaoSocial}</div>
                  </td>
                  <td>
                    <div className="font-mono font-bold text-brand-700 text-sm">{r.tomador.codigoInterno}</div>
                    <div className="text-xs text-gray-500 truncate">{r.tomador.razaoSocial}</div>
                  </td>
                  <td className="text-sm text-gray-700">{r.ramo?.nome ?? "—"}</td>
                  <td className="text-sm text-gray-500 truncate" title={r.descricao ?? ""}>{r.descricao ?? "—"}</td>
                  <td className="text-sm font-medium text-gray-800">{fmtMoeda(r.valor)}</td>
                  <td className="sem-corte">
                    <button
                      onClick={(e) => { e.stopPropagation(); excluir(r); }}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal?.aberto && (
        <ModalRelacao
          item={modal.item}
          onFechar={() => setModal(null)}
          onSalvo={() => { setModal(null); buscar(); }}
        />
      )}
    </div>
  );
}

// ── Busca/seleciona uma empresa (usado pra prestador, tomador e filtro) ────
function SeletorEmpresa({ valor, onSelecionar, placeholder }: {
  valor: EmpresaResumida | null;
  onSelecionar: (e: EmpresaResumida | null) => void;
  placeholder?: string;
}) {
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<EmpresaResumida[]>([]);

  useEffect(() => {
    if (!busca || valor) { setResultados([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/empresas?q=${encodeURIComponent(busca)}&pageSize=6`);
      if (res.ok) setResultados((await res.json()).data ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [busca, valor]);

  return (
    <div className="relative">
      <input
        className="input text-sm"
        placeholder={placeholder ?? "Buscar cliente por nome ou código..."}
        value={valor ? `${valor.codigoInterno} — ${valor.razaoSocial}` : busca}
        onChange={(e) => { setBusca(e.target.value); onSelecionar(null); }}
      />
      {resultados.length > 0 && !valor && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {resultados.map((e) => (
            <button
              key={e.id} type="button"
              onClick={() => { onSelecionar(e); setBusca(""); setResultados([]); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
            >
              <span className="font-mono font-bold text-brand-700">{e.codigoInterno}</span> — {e.razaoSocial}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Modal de criar/editar relação comercial ─────────────────────────────
function ModalRelacao({ item, onFechar, onSalvo }: {
  item?: RelacaoComercial;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const editando = !!item;
  const [prestador, setPrestador] = useState<EmpresaResumida | null>(item?.prestador ?? null);
  const [tomador, setTomador] = useState<EmpresaResumida | null>(item?.tomador ?? null);
  const [ramos, setRamos] = useState<{ id: string; nome: string }[]>([]);
  const [form, setForm] = useState({
    ramoId: item?.ramo?.id ?? "",
    descricao: item?.descricao ?? "",
    valor: item?.valor ?? "",
    data: item?.data ? String(item.data).slice(0, 10) : "",
    observacoes: item?.observacoes ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ramos").then((r) => r.ok ? r.json() : []).then(setRamos).catch(() => {});
  }, []);

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!prestador || !tomador) { setErro("Selecione o prestador e o tomador."); return; }
    if (prestador.id === tomador.id) { setErro("Prestador e tomador não podem ser o mesmo cliente."); return; }
    setSalvando(true);
    setErro(null);

    const payload = {
      prestadorId: prestador.id,
      tomadorId: tomador.id,
      ramoId: form.ramoId || null,
      descricao: form.descricao || null,
      valor: form.valor || null,
      data: form.data || null,
      observacoes: form.observacoes || null,
    };

    const res = editando
      ? await fetch(`/api/relacoes-comerciais/${item!.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        })
      : await fetch("/api/relacoes-comerciais", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });

    setSalvando(false);
    if (res.ok) onSalvo();
    else {
      const json = await res.json().catch(() => ({}));
      setErro(json.error ?? "Erro ao salvar.");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onFechar}>
      <div className="card w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            {editando ? "Editar relação comercial" : "Nova relação comercial"}
          </h3>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>

        <form onSubmit={salvar} className="space-y-3">
          <div>
            <label className="label">Prestador (quem prestou o serviço/produto)</label>
            <SeletorEmpresa valor={prestador} onSelecionar={setPrestador} />
          </div>
          <div>
            <label className="label">Tomador (quem contratou/comprou)</label>
            <SeletorEmpresa valor={tomador} onSelecionar={setTomador} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Categoria da atividade</label>
              <select className="select" value={form.ramoId} onChange={(e) => set("ramoId", e.target.value)}>
                <option value="">Selecione...</option>
                {ramos.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Valor</label>
              <input className="input" type="number" step="0.01" min={0} value={form.valor} onChange={(e) => set("valor", e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Data (opcional)</label>
            <input className="input" type="date" value={form.data} onChange={(e) => set("data", e.target.value)} />
          </div>

          <div>
            <label className="label">Descrição</label>
            <input className="input" placeholder="Ex: Consultoria de marketing, transporte de mercadorias..." value={form.descricao} onChange={(e) => set("descricao", e.target.value)} />
          </div>

          <div>
            <label className="label">Observações (opcional)</label>
            <textarea className="input min-h-[70px]" value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
          </div>

          {erro && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200">
              <span className="text-xs text-red-700">{erro}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onFechar} className="btn">Cancelar</button>
            <button type="submit" disabled={salvando} className="btn btn-primary">
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
