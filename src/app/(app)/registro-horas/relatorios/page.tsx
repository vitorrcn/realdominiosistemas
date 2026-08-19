"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface PorOperador {
  usuarioId: string;
  nome: string;
  qtdRegistros: number;
  diasComRegistro: number;
  totalHoras: number;
  mediaHorasPorDia: number;
}

interface PorOperadorAtividade {
  usuarioId: string;
  nomeUsuario: string;
  atividadeId: string;
  nomeAtividade: string;
  qtdRegistros: number;
  totalHoras: number;
  mediaMinutosPorRegistro: number;
}

function primeiroDiaDoMes(): string {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-01`;
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatarMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

export default function RelatorioHorasPage() {
  const [de, setDe] = useState(primeiroDiaDoMes());
  const [ate, setAte] = useState(hoje());
  const [usuarioId, setUsuarioId] = useState("");
  const [atividadeId, setAtividadeId] = useState("");
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string }[]>([]);
  const [atividades, setAtividades] = useState<{ id: string; nome: string }[]>([]);
  const [porOperador, setPorOperador] = useState<PorOperador[]>([]);
  const [porOperadorAtividade, setPorOperadorAtividade] = useState<PorOperadorAtividade[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [operadorFiltrado, setOperadorFiltrado] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/usuarios").then((r) => r.ok ? r.json() : []).then(setUsuarios).catch(() => {});
    fetch("/api/atividades").then((r) => r.ok ? r.json() : []).then(setAtividades).catch(() => {});
  }, []);

  const buscar = useCallback(async () => {
    setCarregando(true);
    const params = new URLSearchParams({ de, ate });
    if (usuarioId) params.set("usuarioId", usuarioId);
    if (atividadeId) params.set("atividadeId", atividadeId);
    const res = await fetch(`/api/registro-horas/relatorio?${params}`);
    if (res.ok) {
      const json = await res.json();
      setPorOperador(json.porOperador);
      setPorOperadorAtividade(json.porOperadorAtividade);
    }
    setCarregando(false);
  }, [de, ate, usuarioId, atividadeId]);

  useEffect(() => { buscar(); }, [buscar]);

  function exportarExcel() {
    const params = new URLSearchParams({ de, ate, formato: "excel" });
    if (usuarioId) params.set("usuarioId", usuarioId);
    if (atividadeId) params.set("atividadeId", atividadeId);
    window.location.href = `/api/registro-horas/relatorio?${params}`;
  }

  const detalheAtividades = operadorFiltrado
    ? porOperadorAtividade.filter((oa) => oa.usuarioId === operadorFiltrado)
    : porOperadorAtividade;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/registro-horas" className="hover:text-gray-900">Registro de horas</Link>
        <span>/</span>
        <span className="text-gray-900">Relatórios</span>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg font-semibold text-gray-900">Relatórios de horas</h1>
        <button onClick={exportarExcel} className="btn btn-primary btn-sm">Exportar Excel</button>
      </div>

      <div className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label">De</label>
          <input className="input text-sm" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </div>
        <div>
          <label className="label">Até</label>
          <input className="input text-sm" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </div>
        <div>
          <label className="label">Operador</label>
          <select className="select text-sm w-48" value={usuarioId} onChange={(e) => { setUsuarioId(e.target.value); setOperadorFiltrado(null); }}>
            <option value="">Todos</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Atividade</label>
          <select className="select text-sm w-48" value={atividadeId} onChange={(e) => setAtividadeId(e.target.value)}>
            <option value="">Todas</option>
            {atividades.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </div>
      </div>

      {carregando ? (
        <div className="card text-center py-10 text-gray-400">Carregando...</div>
      ) : (
        <>
          <div className="card !p-0 overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <h3 className="text-xs font-semibold text-gray-600 uppercase">Total de horas por operador</h3>
            </div>
            {porOperador.length === 0 ? (
              <p className="text-center py-8 text-gray-400 text-sm">Nenhum registro no período.</p>
            ) : (
              <table className="table-auto-fixed">
                <thead>
                  <tr>
                    <th>Operador</th>
                    <th className="text-right">Dias c/ registro</th>
                    <th className="text-right">Qtd. registros</th>
                    <th className="text-right">Total de horas</th>
                    <th className="text-right">Média/dia</th>
                  </tr>
                </thead>
                <tbody>
                  {porOperador.map((o) => (
                    <tr
                      key={o.usuarioId}
                      onClick={() => setOperadorFiltrado(operadorFiltrado === o.usuarioId ? null : o.usuarioId)}
                      className={operadorFiltrado === o.usuarioId ? "bg-brand-50" : ""}
                    >
                      <td className="font-medium text-gray-900">{o.nome}</td>
                      <td className="text-right">{o.diasComRegistro}</td>
                      <td className="text-right">{o.qtdRegistros}</td>
                      <td className="text-right font-semibold">{formatarMin(o.totalHoras * 60)}</td>
                      <td className="text-right">{formatarMin(o.mediaHorasPorDia * 60)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card !p-0 overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-600 uppercase">
                Tempo médio por atividade {operadorFiltrado && "— " + porOperador.find((o) => o.usuarioId === operadorFiltrado)?.nome}
              </h3>
              {operadorFiltrado && (
                <button onClick={() => setOperadorFiltrado(null)} className="text-xs text-brand-600 hover:underline">
                  Ver todos
                </button>
              )}
            </div>
            {detalheAtividades.length === 0 ? (
              <p className="text-center py-8 text-gray-400 text-sm">Nenhum registro no período.</p>
            ) : (
              <table className="table-auto-fixed">
                <thead>
                  <tr>
                    <th>Operador</th>
                    <th>Atividade</th>
                    <th className="text-right">Qtd. registros</th>
                    <th className="text-right">Total de horas</th>
                    <th className="text-right">Média por registro</th>
                  </tr>
                </thead>
                <tbody>
                  {detalheAtividades.map((oa) => (
                    <tr key={`${oa.usuarioId}::${oa.atividadeId}`}>
                      <td className="text-gray-700">{oa.nomeUsuario}</td>
                      <td className="text-gray-900">{oa.nomeAtividade}</td>
                      <td className="text-right">{oa.qtdRegistros}</td>
                      <td className="text-right font-semibold">{formatarMin(oa.totalHoras * 60)}</td>
                      <td className="text-right">{formatarMin(oa.mediaMinutosPorRegistro)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
