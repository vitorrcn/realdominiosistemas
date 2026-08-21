"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { BadgeTarefa } from "@/components/ui/StatusBadge";
import { SeletorGruposEmail } from "@/components/ui/SeletorGruposEmail";
import { STATUS_TAREFA_LABEL } from "@/types";
import { formatData, diasAte } from "@/lib/utils";

export default function TarefasPage() {
  const { data: session } = useSession();
  const perfil = (session?.user as any)?.perfilGlobal ?? "";
  const podeVerTudo = ["DIRETORIA", "COORDENADOR"].includes(perfil);

  const [tarefas, setTarefas] = useState<any[]>([]);
  const [setores, setSetores] = useState<{ id: string; nome: string }[]>([]);
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string }[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [status, setStatus] = useState("");
  const [setorId, setSetorId] = useState("");
  const [minhaCarteira, setMinhaCarteira] = useState(false);
  const [somenteMinhas, setSomenteMinhas] = useState(false);

  const [modal, setModal] = useState<{ aberto: boolean; tarefa?: any } | null>(null);

  useEffect(() => {
    fetch("/api/setores").then((r) => r.ok ? r.json() : []).then(setSetores).catch(() => {});
    fetch("/api/usuarios").then((r) => r.ok ? r.json() : []).then(setUsuarios).catch(() => {});
  }, []);

  const buscar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (setorId) params.set("setorId", setorId);
    if (minhaCarteira) params.set("minhaCarteira", "true");
    if (somenteMinhas) params.set("minhas", "true");
    const res = await fetch(`/api/tarefas?${params}`);
    if (res.ok) setTarefas(await res.json());
    else {
      const j = await res.json().catch(() => ({}));
      setErro(j.error ?? "Erro ao carregar tarefas.");
    }
    setCarregando(false);
  }, [status, setorId, minhaCarteira, somenteMinhas]);

  useEffect(() => { buscar(); }, [buscar]);

  async function alternarConcluida(t: any) {
    const novoStatus = t.status === "CONCLUIDO" ? "NAO_INICIADO" : "CONCLUIDO";
    await fetch(`/api/tarefas/${t.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: novoStatus }),
    });
    buscar();
  }

  const abertas = tarefas.filter((t) => !["CONCLUIDO", "CANCELADO"].includes(t.status));
  const atrasadas = abertas.filter((t) => t.prazo && diasAte(t.prazo) !== null && diasAte(t.prazo)! < 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Tarefas</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {tarefas.length} tarefa(s) · {abertas.length} em aberto
            {atrasadas.length > 0 && <span className="text-red-500 font-medium"> · {atrasadas.length} atrasada(s)</span>}
          </p>
        </div>
        <button onClick={() => setModal({ aberto: true })} className="btn btn-primary btn-sm">+ Nova tarefa</button>
      </div>

      <div className="card flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Status</label>
          <select className="select text-sm w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(STATUS_TAREFA_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Setor</label>
          <select className="select text-sm w-48" value={setorId} onChange={(e) => setSetorId(e.target.value)}>
            <option value="">Todos</option>
            {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 pb-2">
          <input type="checkbox" className="w-4 h-4 rounded text-brand-600" checked={somenteMinhas} onChange={(e) => setSomenteMinhas(e.target.checked)} />
          Só as minhas
        </label>
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
                <th style={{ width: 40 }}></th>
                <th style={{ width: "20%" }}>Cliente</th>
                <th style={{ width: "24%" }}>Título</th>
                <th style={{ width: "12%" }}>Setor</th>
                <th style={{ width: "14%" }}>Responsável</th>
                <th style={{ width: "10%" }}>Prazo</th>
                <th style={{ width: "14%" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">Carregando...</td></tr>
              ) : tarefas.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">Nenhuma tarefa encontrada.</td></tr>
              ) : tarefas.map((t) => {
                const atraso = t.prazo && !["CONCLUIDO","CANCELADO"].includes(t.status) && diasAte(t.prazo) !== null && diasAte(t.prazo)! < 0;
                const concluida = t.status === "CONCLUIDO";
                return (
                  <tr key={t.id}>
                    <td className="sem-corte">
                      <input type="checkbox" className="w-4 h-4 rounded text-brand-600" checked={concluida} onChange={() => alternarConcluida(t)} />
                    </td>
                    <td onClick={() => setModal({ aberto: true, tarefa: t })} className="cursor-pointer">
                      <div className="font-mono font-bold text-brand-700 text-sm">{t.empresa.codigoInterno}</div>
                      <div className="text-xs text-gray-500 truncate">{t.empresa.razaoSocial}</div>
                    </td>
                    <td onClick={() => setModal({ aberto: true, tarefa: t })} className={`cursor-pointer text-sm ${concluida ? "line-through text-gray-400" : "text-gray-700"}`}>
                      {t.titulo}
                    </td>
                    <td className="text-sm text-gray-500">{t.setor?.nome ?? "—"}</td>
                    <td className="text-sm text-gray-500">{t.responsavel?.nome ?? "—"}</td>
                    <td className={`text-sm ${atraso ? "text-red-600 font-medium" : "text-gray-500"}`}>
                      {t.prazo ? formatData(t.prazo) : "—"}
                    </td>
                    <td><BadgeTarefa status={t.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal?.aberto && (
        <ModalTarefa
          tarefa={modal.tarefa}
          setores={setores}
          usuarios={usuarios}
          onFechar={() => setModal(null)}
          onSalvo={() => { setModal(null); buscar(); }}
        />
      )}
    </div>
  );
}

function ModalTarefa({ tarefa, setores, usuarios, onFechar, onSalvo }: {
  tarefa?: any;
  setores: { id: string; nome: string }[];
  usuarios: { id: string; nome: string }[];
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const editando = !!tarefa;
  const [buscaEmpresa, setBuscaEmpresa] = useState(tarefa ? `${tarefa.empresa.codigoInterno} — ${tarefa.empresa.razaoSocial}` : "");
  const [resultados, setResultados] = useState<any[]>([]);
  const [empresaEscolhida, setEmpresaEscolhida] = useState<any>(tarefa?.empresa ?? null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [form, setForm] = useState({
    titulo: tarefa?.titulo ?? "",
    descricao: tarefa?.descricao ?? "",
    setorId: tarefa?.setor?.id ?? "",
    responsavelId: tarefa?.responsavel?.id ?? "",
    prazo: tarefa?.prazo ? String(tarefa.prazo).slice(0, 10) : "",
    status: tarefa?.status ?? "NAO_INICIADO",
    motivoAtraso: tarefa?.motivoAtraso ?? "",
  });
  const [enviarEmail, setEnviarEmail] = useState(false);
  const [gruposEmail, setGruposEmail] = useState<string[]>([]);

  useEffect(() => {
    if (!buscaEmpresa || empresaEscolhida) { setResultados([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/empresas?q=${encodeURIComponent(buscaEmpresa)}&pageSize=5`);
      if (res.ok) setResultados((await res.json()).data);
    }, 300);
    return () => clearTimeout(t);
  }, [buscaEmpresa, empresaEscolhida]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!editando && !empresaEscolhida) { setErro("Selecione uma empresa."); return; }
    setSalvando(true);
    setErro(null);

    const res = editando
      ? await fetch(`/api/tarefas/${tarefa.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
        })
      : await fetch("/api/tarefas", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, empresaId: empresaEscolhida.id, enviarEmail, gruposEmail }),
        });

    setSalvando(false);
    if (res.ok) onSalvo();
    else {
      const j = await res.json().catch(() => ({}));
      setErro(j.error ?? "Erro ao salvar tarefa.");
    }
  }

  async function excluir() {
    if (!tarefa || !confirm("Excluir esta tarefa?")) return;
    const res = await fetch(`/api/tarefas/${tarefa.id}`, { method: "DELETE" });
    if (res.ok) onSalvo();
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onFechar}>
      <div className="card w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">{editando ? "Editar tarefa" : "Nova tarefa"}</h3>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>

        <form onSubmit={salvar} className="space-y-3">
          {!editando && (
            <div className="relative">
              <label className="label">Cliente</label>
              <input className="input text-sm" placeholder="Buscar por nome ou código..."
                value={empresaEscolhida ? `${empresaEscolhida.codigoInterno} — ${empresaEscolhida.razaoSocial}` : buscaEmpresa}
                onChange={(e) => { setBuscaEmpresa(e.target.value); setEmpresaEscolhida(null); }} required />
              {resultados.length > 0 && !empresaEscolhida && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {resultados.map((e: any) => (
                    <button key={e.id} type="button" onClick={() => { setEmpresaEscolhida(e); setResultados([]); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                      <span className="font-mono font-bold text-brand-700">{e.codigoInterno}</span> — {e.razaoSocial}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="label">Título</label>
            <input className="input" value={form.titulo} onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Descrição</label>
            <textarea className="input min-h-[60px]" value={form.descricao} onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Setor</label>
              <select className="select" value={form.setorId} onChange={(e) => setForm((p) => ({ ...p, setorId: e.target.value }))}>
                <option value="">Nenhum</option>
                {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Responsável</label>
              <select className="select" value={form.responsavelId} onChange={(e) => setForm((p) => ({ ...p, responsavelId: e.target.value }))}>
                <option value="">Não atribuído</option>
                {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Prazo</label>
              <input className="input" type="date" value={form.prazo} onChange={(e) => setForm((p) => ({ ...p, prazo: e.target.value }))} />
            </div>
            {editando && (
              <div>
                <label className="label">Status</label>
                <select className="select" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                  {Object.entries(STATUS_TAREFA_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            )}
          </div>

          {editando && form.status === "CANCELADO" && (
            <div>
              <label className="label">Motivo (opcional)</label>
              <input className="input" value={form.motivoAtraso} onChange={(e) => setForm((p) => ({ ...p, motivoAtraso: e.target.value }))} />
            </div>
          )}

          {!editando && (
            <SeletorGruposEmail
              enviarEmail={enviarEmail}
              grupos={gruposEmail}
              onMudarEnviar={setEnviarEmail}
              onMudarGrupos={setGruposEmail}
            />
          )}

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <div className="flex justify-between items-center pt-2">
            {editando ? (
              <button type="button" onClick={excluir} className="text-sm text-red-500 hover:underline">Excluir</button>
            ) : <span />}
            <div className="flex gap-2">
              <button type="button" onClick={onFechar} className="btn">Cancelar</button>
              <button type="submit" disabled={salvando} className="btn btn-primary">
                {salvando ? "Salvando..." : editando ? "Salvar" : "Criar tarefa"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
