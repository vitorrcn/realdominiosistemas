"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { formatData } from "@/lib/utils";
import { STATUS_EMPRESA_LABEL } from "@/types";
import { StatusEmpresa } from "@prisma/client";

interface Linha {
  id: string;
  codigoInterno: string;
  razaoSocial: string;
  status: StatusEmpresa;
  saiu: boolean;
  dataSaida: string | null;
  ultimoFechamento: string | null;
  situacao: "em_dia" | "atrasado" | "sem_data";
  limiteLabel: string;
  responsavelId: string | null;
  responsavelNome: string | null;
}

interface Contagem { total: number; emDia: number; atrasado: number; semData: number }
interface Resumo { geral: Contagem; ativos: Contagem; exClientes: Contagem }

const SITUACAO_LABEL: Record<Linha["situacao"], string> = {
  em_dia: "Em dia",
  atrasado: "Atrasado",
  sem_data: "Sem data",
};

const SITUACAO_BADGE: Record<Linha["situacao"], string> = {
  em_dia: "badge badge-green",
  atrasado: "badge badge-red",
  sem_data: "badge badge-gray",
};

export default function RelatorioFechamentoContabilPage() {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [anoAtual, setAnoAtual] = useState<number | null>(null);
  const [vejoTudo, setVejoTudo] = useState(true);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);

  const [situacaoFiltro, setSituacaoFiltro] = useState<"" | Linha["situacao"]>("");
  const [grupoFiltro, setGrupoFiltro] = useState<"" | "ativos" | "exClientes">("");
  const [carteiraFiltro, setCarteiraFiltro] = useState("");
  const [q, setQ] = useState("");
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    fetch("/api/relatorios/fechamento-contabil")
      .then(async (r) => {
        if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error ?? "Erro ao carregar"); }
        return r.json();
      })
      .then((json) => { setLinhas(json.linhas); setResumo(json.resumo); setAnoAtual(json.anoAtual); setVejoTudo(json.vejoTudo ?? true); })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
    fetch("/api/usuarios").then((r) => r.ok ? r.json() : []).then(setUsuarios).catch(() => {});
  }, []);

  const filtradas = useMemo(() => {
    return linhas.filter((l) => {
      if (situacaoFiltro && l.situacao !== situacaoFiltro) return false;
      if (grupoFiltro === "ativos" && l.saiu) return false;
      if (grupoFiltro === "exClientes" && !l.saiu) return false;
      if (carteiraFiltro === "sem-responsavel" && l.responsavelId) return false;
      if (carteiraFiltro && carteiraFiltro !== "sem-responsavel" && l.responsavelId !== carteiraFiltro) return false;
      if (q && !l.razaoSocial.toLowerCase().includes(q.toLowerCase()) && !l.codigoInterno.includes(q)) return false;
      return true;
    });
  }, [linhas, situacaoFiltro, grupoFiltro, carteiraFiltro, q]);

  // Só entram no dropdown quem tem pelo menos um cliente nesse relatório —
  // evita listar todo mundo do escritório, a maioria fora do Contábil.
  const carteiras = useMemo(() => {
    const ids = new Set(linhas.map((l) => l.responsavelId).filter(Boolean) as string[]);
    return usuarios.filter((u) => ids.has(u.id)).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [linhas, usuarios]);

  async function exportarExcel() {
    setExportando(true);
    try {
      const XLSX = await import("xlsx");
      const dados = filtradas.map((l) => ({
        "Código": l.codigoInterno,
        "Cliente": l.razaoSocial,
        "Status": STATUS_EMPRESA_LABEL[l.status],
        "Situação": l.saiu ? "Ex-cliente" : "Ativo",
        "Responsável": l.responsavelNome ?? "",
        "Último fechamento": l.ultimoFechamento ? formatData(l.ultimoFechamento) : "",
        "Exigido": l.limiteLabel,
        "Fechamento contábil": SITUACAO_LABEL[l.situacao],
      }));
      const ws = XLSX.utils.json_to_sheet(dados);
      ws["!cols"] = [{ wch: 12 }, { wch: 40 }, { wch: 16 }, { wch: 12 }, { wch: 22 }, { wch: 16 }, { wch: 26 }, { wch: 16 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Fechamento contábil");
      XLSX.writeFile(wb, `fechamento-contabil-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally {
      setExportando(false);
    }
  }

  if (erro) return <div className="card text-center py-12 text-red-500">{erro}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/empresas" className="hover:text-gray-900">Clientes</Link>
        <span>/</span>
        <span className="text-gray-900">Fechamento contábil</span>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Fechamento contábil</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {carregando
              ? "Carregando..."
              : anoAtual
              ? `Clientes ativos precisam de fechamento até 31/12/${anoAtual - 1} · clientes que saíram, até o mês em que saíram`
              : ""}
            {!carregando && !vejoTudo && <span className="text-gray-500"> · Mostrando só a sua carteira</span>}
          </p>
        </div>
        <button onClick={exportarExcel} disabled={carregando || exportando || filtradas.length === 0} className="btn btn-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          {exportando ? "Gerando..." : "Exportar Excel"}
        </button>
      </div>

      {/* Métricas */}
      {resumo && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => { setSituacaoFiltro(""); setGrupoFiltro(""); }}
            className="metric-card text-left hover:ring-2 hover:ring-gray-300 transition"
          >
            <div className="metric-label">Total de clientes</div>
            <div className="metric-value text-gray-800">{resumo.geral.total}</div>
          </button>
          <button
            onClick={() => { setSituacaoFiltro("em_dia"); setGrupoFiltro(""); }}
            className="metric-card text-left hover:ring-2 hover:ring-green-300 transition"
          >
            <div className="metric-label">Em dia</div>
            <div className="metric-value text-green-700">{resumo.geral.emDia}</div>
          </button>
          <button
            onClick={() => { setSituacaoFiltro("atrasado"); setGrupoFiltro(""); }}
            className="metric-card text-left hover:ring-2 hover:ring-red-300 transition"
          >
            <div className="metric-label">Atrasados</div>
            <div className="metric-value text-red-600">{resumo.geral.atrasado}</div>
          </button>
          <button
            onClick={() => { setSituacaoFiltro("sem_data"); setGrupoFiltro(""); }}
            className="metric-card text-left hover:ring-2 hover:ring-gray-300 transition"
          >
            <div className="metric-label">Sem data</div>
            <div className="metric-value text-gray-500">{resumo.geral.semData}</div>
          </button>
        </div>
      )}

      {/* Resumo por grupo */}
      {resumo && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="card space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Clientes ativos</h3>
              <span className="text-xs text-gray-400">{resumo.ativos.total} no total</span>
            </div>
            <div className="flex gap-2 text-xs flex-wrap">
              <span className="badge badge-green">{resumo.ativos.emDia} em dia</span>
              <span className="badge badge-red">{resumo.ativos.atrasado} atrasado(s)</span>
              <span className="badge badge-gray">{resumo.ativos.semData} sem data</span>
            </div>
          </div>
          <div className="card space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Ex-clientes (já saíram)</h3>
              <span className="text-xs text-gray-400">{resumo.exClientes.total} no total</span>
            </div>
            <div className="flex gap-2 text-xs flex-wrap">
              <span className="badge badge-green">{resumo.exClientes.emDia} em dia</span>
              <span className="badge badge-red">{resumo.exClientes.atrasado} atrasado(s)</span>
              <span className="badge badge-gray">{resumo.exClientes.semData} sem data</span>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="card flex flex-wrap gap-3 items-center">
        <input className="input text-sm flex-1 min-w-[220px] max-w-sm" placeholder="Buscar cliente ou código..."
          value={q} onChange={(e) => setQ(e.target.value)} />

        <select className="select text-sm w-44" value={grupoFiltro} onChange={(e) => setGrupoFiltro(e.target.value as any)}>
          <option value="">Ativos e ex-clientes</option>
          <option value="ativos">Só ativos</option>
          <option value="exClientes">Só ex-clientes</option>
        </select>

        <select className="select text-sm w-44" value={situacaoFiltro} onChange={(e) => setSituacaoFiltro(e.target.value as any)}>
          <option value="">Todas as situações</option>
          <option value="em_dia">Em dia</option>
          <option value="atrasado">Atrasado</option>
          <option value="sem_data">Sem data</option>
        </select>

        {vejoTudo && (
          <select className="select text-sm w-52" value={carteiraFiltro} onChange={(e) => setCarteiraFiltro(e.target.value)}>
            <option value="">Todas as carteiras</option>
            <option value="sem-responsavel">Sem responsável</option>
            {carteiras.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        )}

        {(situacaoFiltro || grupoFiltro || carteiraFiltro || q) && (
          <button onClick={() => { setSituacaoFiltro(""); setGrupoFiltro(""); setCarteiraFiltro(""); setQ(""); }} className="btn btn-sm ml-auto text-gray-400">
            Limpar filtros
          </button>
        )}
      </div>

      {/* Tabela */}
      <div className="card !p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {carregando ? "Carregando..." : `${filtradas.length} cliente${filtradas.length !== 1 ? "s" : ""}`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="table-auto-fixed">
            <thead>
              <tr>
                <th style={{ width: 90 }}>Código</th>
                <th>Cliente</th>
                <th style={{ width: 100 }}>Status</th>
                <th style={{ width: 130 }}>Responsável</th>
                <th style={{ width: 110 }}>Último fechamento</th>
                <th style={{ width: 220 }}>Exigido</th>
                <th style={{ width: 100 }}>Fechamento</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Carregando...</td></tr>
              ) : filtradas.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Nenhum cliente encontrado</td></tr>
              ) : filtradas.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link href={`/empresas/${l.id}?aba=contabil`} className="font-mono font-bold text-brand-700 text-sm">
                      {l.codigoInterno}
                    </Link>
                  </td>
                  <td>
                    <Link href={`/empresas/${l.id}?aba=contabil`} className="text-gray-900 hover:text-brand-700">
                      {l.razaoSocial}
                    </Link>
                    {l.saiu && <span className="ml-1.5 badge badge-orange text-[10px]">EX-CLIENTE</span>}
                  </td>
                  <td className="text-gray-500 text-xs">{STATUS_EMPRESA_LABEL[l.status]}</td>
                  <td className="text-gray-500 text-xs">{l.responsavelNome ?? "—"}</td>
                  <td className="text-gray-500 text-xs">{l.ultimoFechamento ? formatData(l.ultimoFechamento) : "—"}</td>
                  <td className="text-gray-400 text-xs">{l.limiteLabel}</td>
                  <td><span className={SITUACAO_BADGE[l.situacao]}>{SITUACAO_LABEL[l.situacao]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
