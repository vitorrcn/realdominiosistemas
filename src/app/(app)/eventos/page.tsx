"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { BadgeEvento } from "@/components/ui/StatusBadge";
import { STATUS_EVENTO_LABEL } from "@/types";
import { formatData, diasAte } from "@/lib/utils";

export default function EventosPage() {
  const { data: session } = useSession();
  const perfil = (session?.user as any)?.perfilGlobal ?? "";
  const podeVerTudo = ["DIRETORIA", "COORDENADOR"].includes(perfil);

  const [eventos, setEventos] = useState<any[]>([]);
  const [setores, setSetores] = useState<{ id: string; nome: string }[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [setorId, setSetorId] = useState("");
  const [minhaCarteira, setMinhaCarteira] = useState(false);

  useEffect(() => {
    fetch("/api/setores").then((r) => r.ok ? r.json() : []).then(setSetores).catch(() => {});
  }, []);

  const buscar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (setorId) params.set("setorId", setorId);
    if (minhaCarteira) params.set("minhaCarteira", "true");
    const res = await fetch(`/api/eventos?${params}`);
    if (res.ok) setEventos(await res.json());
    else {
      const j = await res.json().catch(() => ({}));
      setErro(j.error ?? "Erro ao carregar eventos.");
    }
    setCarregando(false);
  }, [status, setorId, minhaCarteira]);

  useEffect(() => { buscar(); }, [buscar]);

  const abertos = eventos.filter((e) => !["CONCLUIDO", "CANCELADO"].includes(e.status));
  const atrasados = abertos.filter((e) => e.prazo && diasAte(e.prazo) !== null && diasAte(e.prazo)! < 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Eventos</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {eventos.length} evento(s) · {abertos.length} em aberto
            {atrasados.length > 0 && <span className="text-red-500 font-medium"> · {atrasados.length} atrasado(s)</span>}
          </p>
        </div>
        <Link href="/eventos/novo" className="btn btn-primary btn-sm">+ Novo evento</Link>
      </div>

      <div className="card flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Status</label>
          <select className="select text-sm w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(STATUS_EVENTO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Setor</label>
          <select className="select text-sm w-48" value={setorId} onChange={(e) => setSetorId(e.target.value)}>
            <option value="">Todos</option>
            {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </div>
        {podeVerTudo && (
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 pb-2">
            <input type="checkbox" className="w-4 h-4 rounded text-brand-600" checked={minhaCarteira} onChange={(e) => setMinhaCarteira(e.target.checked)} />
            Só a minha carteira
          </label>
        )}
      </div>

      {erro ? (
        <div className="card text-center py-10 text-red-500">{erro}</div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          <table className="table-auto-fixed">
            <thead>
              <tr>
                <th style={{ width: "22%" }}>Cliente</th>
                <th style={{ width: "18%" }}>Tipo</th>
                <th style={{ width: "14%" }}>Setor atual</th>
                <th style={{ width: "16%" }}>Responsável</th>
                <th style={{ width: "12%" }}>Prazo</th>
                <th style={{ width: "18%" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">Carregando...</td></tr>
              ) : eventos.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">Nenhum evento encontrado.</td></tr>
              ) : eventos.map((ev) => {
                const atraso = ev.prazo && !["CONCLUIDO","CANCELADO"].includes(ev.status) && diasAte(ev.prazo) !== null && diasAte(ev.prazo)! < 0;
                return (
                  <tr key={ev.id} onClick={() => window.location.assign(`/eventos/${ev.id}`)}>
                    <td>
                      <div className="font-mono font-bold text-brand-700 text-sm">{ev.empresa.codigoInterno}</div>
                      <div className="text-xs text-gray-500 truncate">{ev.empresa.razaoSocial}</div>
                    </td>
                    <td className="text-sm text-gray-700">{ev.tipoEvento?.nome ?? "—"}</td>
                    <td className="text-sm text-gray-500">{ev.setorAtual?.nome ?? "—"}</td>
                    <td className="text-sm text-gray-500">{ev.respAtual?.nome ?? "—"}</td>
                    <td className={`text-sm ${atraso ? "text-red-600 font-medium" : "text-gray-500"}`}>
                      {ev.prazo ? formatData(ev.prazo) : "—"}
                    </td>
                    <td><BadgeEvento status={ev.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
