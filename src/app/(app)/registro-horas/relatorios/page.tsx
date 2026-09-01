"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

interface PorOperador {
  usuarioId: string;
  nome: string;
  qtdRegistros: number;
  diasComRegistro: number;
  totalHoras: number;
  mediaHorasPorDia: number;
}

interface OperadorNaAtividade {
  usuarioId: string;
  nome: string;
  totalHoras: number;
  qtdRegistros: number;
  mediaMinutosPorRegistro: number;
  totalQuantidade: number | null;
}

interface PorAtividade {
  atividadeId: string;
  nomeAtividade: string;
  operadores: OperadorNaAtividade[];
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
  const [porAtividade, setPorAtividade] = useState<PorAtividade[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [operadorDestacado, setOperadorDestacado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const primeiraCargaRef = useRef(true);

  useEffect(() => {
    fetch("/api/registro-horas/operadores").then((r) => r.ok ? r.json() : []).then(setUsuarios).catch(() => {});
    fetch("/api/atividades").then((r) => r.ok ? r.json() : []).then(setAtividades).catch(() => {});
  }, []);

  const buscar = useCallback(async () => {
    if (primeiraCargaRef.current) setCarregando(true);
    setErro(null);
    const params = new URLSearchParams({ de, ate });
    if (usuarioId) params.set("usuarioId", usuarioId);
    if (atividadeId) params.set("atividadeId", atividadeId);
    const res = await fetch(`/api/registro-horas/relatorio?${params}`);
    if (res.ok) {
      const json = await res.json();
      setPorOperador(json.porOperador);
      setPorAtividade(json.porAtividade);
    } else {
      const j = await res.json().catch(() => ({}));
      setErro(j.error ?? "Erro ao carregar o relatório.");
      setPorOperador([]);
      setPorAtividade([]);
    }
    setCarregando(false);
    primeiraCargaRef.current = false;
  }, [de, ate, usuarioId, atividadeId]);

  useEffect(() => { buscar(); }, [buscar]);

  function exportarExcel() {
    const params = new URLSearchParams({ de, ate, formato: "excel" });
    if (usuarioId) params.set("usuarioId", usuarioId);
    if (atividadeId) params.set("atividadeId", atividadeId);
    window.location.href = `/api/registro-horas/relatorio?${params}`;
  }

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
          <select className="select text-sm w-48" value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
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
      ) : erro ? (
        <div className="card text-center py-10 text-red-600 text-sm">{erro}</div>
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
                      onClick={() => setOperadorDestacado(operadorDestacado === o.usuarioId ? null : o.usuarioId)}
                      className={operadorDestacado === o.usuarioId ? "bg-brand-50" : ""}
                      title="Clique pra destacar esse operador no comparativo por atividade, abaixo"
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
              <h3 className="text-xs font-semibold text-gray-600 uppercase">Comparativo por atividade</h3>
              <p className="text-[11px] text-gray-400">
                Quanto tempo cada operador gastou na mesma atividade, do maior pro menor.
                {operadorDestacado && " Clique no operador destacado acima de novo pra tirar o destaque."}
              </p>
            </div>
            {porAtividade.length === 0 ? (
              <p className="text-center py-8 text-gray-400 text-sm">Nenhum registro no período.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {porAtividade.map((a) => {
                  const maxHoras = Math.max(...a.operadores.map((o) => o.totalHoras), 0.01);
                  return (
                    <div key={a.atividadeId} className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900 mb-2">{a.nomeAtividade}</div>
                      <div className="space-y-1.5">
                        {a.operadores.map((o) => {
                          const destacado = operadorDestacado === o.usuarioId;
                          return (
                            <div key={o.usuarioId} className="flex items-center gap-3">
                              <span className={`text-xs w-32 flex-shrink-0 truncate ${destacado ? "font-semibold text-brand-700" : "text-gray-600"}`}>
                                {o.nome}
                              </span>
                              <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${destacado ? "bg-brand-600" : "bg-brand-300"}`}
                                  style={{ width: `${Math.max(4, (o.totalHoras / maxHoras) * 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-700 w-16 text-right flex-shrink-0 font-medium">
                                {formatarMin(o.totalHoras * 60)}
                              </span>
                              <span className="text-[11px] text-gray-400 w-24 text-right flex-shrink-0">
                                méd. {formatarMin(o.mediaMinutosPorRegistro)}
                              </span>
                              {o.totalQuantidade != null && (
                                <span className="text-[11px] text-gray-400 w-20 text-right flex-shrink-0">
                                  {o.totalQuantidade} un.
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
