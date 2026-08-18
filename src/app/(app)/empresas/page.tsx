"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatCnpj, formatCpf, formatCompetencia, competenciaAtual } from "@/lib/utils";
import { STATUS_EMPRESA_LABEL, REGIME_LABEL, type EmpresaResumo } from "@/types";
import { StatusEmpresa, RegimeTributario } from "@prisma/client";

const STATUS_BADGE: Record<StatusEmpresa, string> = {
  CADASTRO_INCOMPLETO: "badge badge-pink",
  IMPLANTACAO:         "badge badge-blue",
  ATIVA:               "badge badge-green",
  EM_ATENCAO:          "badge badge-yellow",
  INATIVA:             "badge badge-gray",
  ENCERRADA:           "badge badge-red",
  EX_CLIENTE:          "badge badge-gray",
};

export default function EmpresasPage() {
  const [empresas, setEmpresas] = useState<EmpresaResumo[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);

  // Filtros
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [regime, setRegime] = useState("");
  const [minhaCarteira, setMinhaCarteira] = useState(false);
  const [emRisco, setEmRisco] = useState(false);
  const [obsCritica, setObsCritica] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Métricas
  const [metricas, setMetricas] = useState({
    ativas: 0, emAtencao: 0, implantacao: 0, incompleto: 0, exClientes: 0,
  });
  const [erroLista, setErroLista] = useState<string | null>(null);

  const buscar = useCallback(async () => {
    setCarregando(true);
    setErroLista(null);
    const params = new URLSearchParams();
    if (q)             params.set("q", q);
    if (status)        params.set("status", status);
    if (regime)        params.set("regime", regime);
    if (minhaCarteira) params.set("minhaCarteira", "true");
    if (emRisco)       params.set("emRisco", "true");
    if (obsCritica)    params.set("obsCritica", "true");
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    const res = await fetch(`/api/empresas?${params}`);
    if (res.ok) {
      const json = await res.json();
      setEmpresas(json.data);
      setTotal(json.total);
    } else {
      const json = await res.json().catch(() => ({}));
      setErroLista(json.detalhe ? `${json.error} (${json.detalhe})` : (json.error ?? "Erro ao carregar clientes."));
    }
    setCarregando(false);
  }, [q, status, regime, minhaCarteira, emRisco, obsCritica, page]);

  // Métricas globais (sem filtros)
  useEffect(() => {
    Promise.all([
      fetch("/api/empresas?status=ATIVA&pageSize=1").then((r) => r.json()),
      fetch("/api/empresas?status=EM_ATENCAO&pageSize=1").then((r) => r.json()),
      fetch("/api/empresas?status=IMPLANTACAO&pageSize=1").then((r) => r.json()),
      fetch("/api/empresas?status=CADASTRO_INCOMPLETO&pageSize=1").then((r) => r.json()),
      fetch("/api/empresas?status=EX_CLIENTE&pageSize=1").then((r) => r.json()),
    ]).then(([at, em, im, in_, ex]) => {
      setMetricas({
        ativas: at.total ?? 0,
        emAtencao: em.total ?? 0,
        implantacao: im.total ?? 0,
        incompleto: in_.total ?? 0,
        exClientes: ex.total ?? 0,
      });
    }).catch(() => {
      setMetricas({ ativas: 0, emAtencao: 0, implantacao: 0, incompleto: 0, exClientes: 0 });
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(buscar, 300);
    return () => clearTimeout(t);
  }, [buscar]);

  function limparFiltros() {
    setQ(""); setStatus(""); setRegime("");
    setMinhaCarteira(false); setEmRisco(false); setObsCritica(false);
    setPage(1);
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-5">
      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <button onClick={() => { setStatus("ATIVA"); setPage(1); }} className="metric-card text-left hover:ring-2 hover:ring-green-300 transition">
          <div className="metric-label">Total ativas</div>
          <div className="metric-value text-green-700">{metricas.ativas}</div>
        </button>
        <button onClick={() => { setStatus("EM_ATENCAO"); setPage(1); }} className="metric-card text-left hover:ring-2 hover:ring-yellow-300 transition">
          <div className="metric-label">Em atenção</div>
          <div className="metric-value text-yellow-600">{metricas.emAtencao}</div>
        </button>
        <button onClick={() => { setStatus("IMPLANTACAO"); setPage(1); }} className="metric-card text-left hover:ring-2 hover:ring-blue-300 transition">
          <div className="metric-label">Implantação</div>
          <div className="metric-value text-blue-600">{metricas.implantacao}</div>
        </button>
        <button onClick={() => { setStatus("CADASTRO_INCOMPLETO"); setPage(1); }} className="metric-card text-left hover:ring-2 hover:ring-red-300 transition">
          <div className="metric-label">Cad. incompleto</div>
          <div className="metric-value text-red-600">{metricas.incompleto}</div>
        </button>
        <button onClick={() => { setStatus("EX_CLIENTE"); setPage(1); }} className="metric-card text-left hover:ring-2 hover:ring-orange-300 transition">
          <div className="metric-label">Ex-clientes</div>
          <div className="metric-value text-orange-600">{metricas.exClientes}</div>
        </button>
      </div>

      {/* Ações + Filtros */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Busca */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              className="input pl-9 text-sm"
              placeholder="Nome, CNPJ ou código..."
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
            />
          </div>

          {/* Selects */}
          <div className="flex gap-2 flex-wrap">
            <select className="select text-sm w-44"
              value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">Todos os status</option>
              {Object.entries(STATUS_EMPRESA_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>

            <select className="select text-sm w-44"
              value={regime} onChange={(e) => { setRegime(e.target.value); setPage(1); }}>
              <option value="">Todos os regimes</option>
              {Object.entries(REGIME_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          {/* Botões */}
          <div className="flex gap-2">
            <Link href="/relatorios/ramos" className="btn btn-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Relatório por ramo
            </Link>
            <Link href="/empresas/importar" className="btn btn-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Importar
            </Link>
            <Link href="/empresas/importar-pdf" className="btn btn-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Importar PDF
            </Link>
            <Link href="/empresas/nova" className="btn btn-sm btn-primary">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Novo cliente
            </Link>
          </div>
        </div>

        {/* Filtros rápidos */}
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-gray-400">Acesso rápido:</span>
          {[
            { key: "carteira",  label: "Minha carteira", state: minhaCarteira, set: setMinhaCarteira },
            { key: "risco",     label: "Em risco",        state: emRisco,       set: setEmRisco },
            { key: "obs",       label: "Obs. crítica",    state: obsCritica,    set: setObsCritica },
          ].map(({ key, label, state, set }) => (
            <button
              key={key}
              onClick={() => { set(!state); setPage(1); }}
              className={`badge cursor-pointer transition-colors ${
                state ? "bg-brand-100 text-brand-700" : "badge-gray hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
          <button onClick={limparFiltros} className="btn btn-sm ml-auto text-gray-400">
            Limpar filtros
          </button>
        </div>
      </div>

      {erroLista && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
          <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span className="text-sm text-red-700">{erroLista}</span>
        </div>
      )}

      {/* Tabela */}
      <div className="card !p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {carregando ? "Carregando..." : `${total} cliente${total !== 1 ? "s" : ""}`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="table-auto-fixed">
            <thead>
              <tr>
                <th style={{ width: 90 }}>Código</th>
                <th style={{ width: 200 }}>Cliente</th>
                <th style={{ width: 100 }}>Status</th>
                <th style={{ width: 130 }}>Regime</th>
                <th style={{ width: 90 }}>Cidade</th>
                <th style={{ width: 100 }}>Responsáveis</th>
                <th style={{ width: 90 }}>Pendências</th>
                <th style={{ width: 70 }}>Risco</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    <svg className="w-5 h-5 animate-spin mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Carregando...
                  </td>
                </tr>
              ) : empresas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    Nenhum cliente encontrado
                  </td>
                </tr>
              ) : empresas.map((e) => (
                <tr key={e.id} className={e.status === "EX_CLIENTE" ? "bg-orange-50/40" : ""}>
                  <td>
                    <Link href={`/empresas/${e.id}`} className="font-mono font-bold text-brand-700 text-sm">
                      {e.codigoInterno}
                    </Link>
                  </td>
                  <td>
                    <Link href={`/empresas/${e.id}`} className="block">
                      <div className="font-medium text-gray-900 truncate">
                        {e.razaoSocial}
                        {e.tipoPessoa === "PF" && <span className="ml-1.5 badge badge-gray text-[10px]">PF</span>}
                        {e.status === "EX_CLIENTE" && <span className="ml-1.5 badge badge-orange text-[10px]">EX-CLIENTE</span>}
                        {e.empresaBaixada && <span className="ml-1.5 badge badge-red text-[10px]">BAIXADA</span>}
                        {e.obsCritica && (
                          <span className="ml-1.5 badge badge-red text-[10px]">crítica</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 font-mono mt-0.5">
                        {e.tipoPessoa === "PF" ? formatCpf(e.cpf ?? "") : formatCnpj(e.cnpj ?? "")}
                      </div>
                    </Link>
                  </td>
                  <td>
                    <span className={STATUS_BADGE[e.status]}>
                      {STATUS_EMPRESA_LABEL[e.status]}
                    </span>
                  </td>
                  <td className="text-gray-500 text-xs">
                    {e.fiscal?.regimeTributario
                      ? REGIME_LABEL[e.fiscal.regimeTributario]
                      : "—"}
                  </td>
                  <td className="text-gray-500 text-xs">{e.municipio ?? "—"}</td>
                  <td>
                    <div className="flex gap-1">
                      {[e.respFiscal, e.respContabil, e.respDp]
                        .filter(Boolean)
                        .slice(0, 3)
                        .map((r, i) => (
                          <div
                            key={i}
                            className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center text-[10px] font-semibold text-brand-700"
                            title={r!.nome}
                          >
                            {r!.nome.charAt(0)}
                          </div>
                        ))}
                      {!e.respFiscal && !e.respContabil && !e.respDp && (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </div>
                  </td>
                  <td>
                    {(e.pendencias ?? 0) > 0 ? (
                      <span className={`text-xs font-medium ${
                        (e.pendencias ?? 0) > 5 ? "text-red-600" : "text-yellow-600"
                      }`}>
                        {e.pendencias} pendente{(e.pendencias ?? 0) > 1 ? "s" : ""}
                      </span>
                    ) : (
                      <span className="text-xs text-green-600">Em dia</span>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <div className={`risk-dot risk-${e.risco ?? "ok"}`} />
                      <span className="text-xs text-gray-500 capitalize">
                        {e.risco === "danger" ? "Alto" : e.risco === "warn" ? "Médio" : "Baixo"}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              Página {page} de {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn btn-sm disabled:opacity-40"
              >← Anterior</button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn btn-sm disabled:opacity-40"
              >Próxima →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
