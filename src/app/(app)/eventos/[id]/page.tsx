"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { BadgeEvento } from "@/components/ui/StatusBadge";
import { STATUS_EVENTO_LABEL } from "@/types";
import { formatData } from "@/lib/utils";

export default function EventoDetalhePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [evento, setEvento] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [setores, setSetores] = useState<{ id: string; nome: string }[]>([]);
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string }[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [form, setForm] = useState<any>(null);

  const buscar = useCallback(async () => {
    setCarregando(true);
    const res = await fetch(`/api/eventos/${params.id}`);
    if (res.ok) {
      const json = await res.json();
      setEvento(json);
      setForm({
        status: json.status,
        setorAtualId: json.setorAtual?.id ?? "",
        respAtualId: json.respAtual?.id ?? "",
        prazo: json.prazo ? String(json.prazo).slice(0, 10) : "",
        observacoes: json.observacoes ?? "",
        comentario: "",
      });
    } else {
      const j = await res.json().catch(() => ({}));
      setErro(j.error ?? "Erro ao carregar evento.");
    }
    setCarregando(false);
  }, [params.id]);

  useEffect(() => { buscar(); }, [buscar]);
  useEffect(() => {
    fetch("/api/setores").then((r) => r.ok ? r.json() : []).then(setSetores).catch(() => {});
    fetch("/api/usuarios").then((r) => r.ok ? r.json() : []).then(setUsuarios).catch(() => {});
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const res = await fetch(`/api/eventos/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: form.status,
        setorAtualId: form.setorAtualId,
        respAtualId: form.respAtualId,
        prazo: form.prazo || null,
        observacoes: form.observacoes,
        comentario: form.comentario || undefined,
      }),
    });
    setSalvando(false);
    if (res.ok) {
      setMsg("Salvo com sucesso!");
      setForm((p: any) => ({ ...p, comentario: "" }));
      buscar();
    } else {
      setMsg("Erro ao salvar.");
    }
    setTimeout(() => setMsg(null), 3000);
  }

  async function excluir() {
    if (!confirm("Excluir este evento? Essa ação não pode ser desfeita.")) return;
    setExcluindo(true);
    const res = await fetch(`/api/eventos/${params.id}`, { method: "DELETE" });
    setExcluindo(false);
    if (res.ok) {
      router.push("/eventos");
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Erro ao excluir evento.");
    }
  }

  if (carregando || !form) return <div className="text-center py-12 text-gray-400">Carregando...</div>;
  if (erro || !evento) return <div className="card text-center py-12 text-red-500">{erro ?? "Evento não encontrado"}</div>;

  const perfil = (session?.user as any)?.perfilGlobal ?? "";
  const meuId = (session?.user as any)?.id;
  const podeExcluir =
    ["DIRETORIA", "COORDENADOR", "LIDER"].includes(perfil) ||
    evento.criadoPor?.id === meuId;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/eventos" className="hover:text-gray-900">Eventos</Link>
        <span>/</span>
        <span className="text-gray-900 truncate flex-1">{evento.tipoEvento?.nome ?? "Evento"}</span>
        {podeExcluir && (
          <button
            onClick={excluir}
            disabled={excluindo}
            className="text-xs text-red-500 hover:text-red-700 hover:underline flex-shrink-0"
          >
            {excluindo ? "Excluindo..." : "Excluir evento"}
          </button>
        )}
      </div>

      {msg && (
        <div className="fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-lg text-sm font-medium bg-gray-900 text-white z-50">
          {msg}
        </div>
      )}

      <div className="card">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono font-bold text-brand-700 text-sm">{evento.empresa.codigoInterno}</span>
              <Link href={`/empresas/${evento.empresa.id}`} className="text-sm text-gray-700 hover:text-brand-700">
                {evento.empresa.razaoSocial}
              </Link>
            </div>
            <h1 className="text-lg font-semibold text-gray-900 mt-1">{evento.tipoEvento?.nome}</h1>
          </div>
          <BadgeEvento status={evento.status} />
        </div>
      </div>

      <form onSubmit={salvar} className="card space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Andamento</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Status</label>
            <select className="select" value={form.status} onChange={(e) => setForm((p: any) => ({ ...p, status: e.target.value }))}>
              {Object.entries(STATUS_EVENTO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Prazo</label>
            <input className="input" type="date" value={form.prazo} onChange={(e) => setForm((p: any) => ({ ...p, prazo: e.target.value }))} />
          </div>
          <div>
            <label className="label">Setor atual</label>
            <select className="select" value={form.setorAtualId} onChange={(e) => setForm((p: any) => ({ ...p, setorAtualId: e.target.value }))}>
              <option value="">Não definido</option>
              {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Responsável atual</label>
            <select className="select" value={form.respAtualId} onChange={(e) => setForm((p: any) => ({ ...p, respAtualId: e.target.value }))}>
              <option value="">Não atribuído</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Observações</label>
          <textarea className="input min-h-[70px]" value={form.observacoes} onChange={(e) => setForm((p: any) => ({ ...p, observacoes: e.target.value }))} />
        </div>
        <div>
          <label className="label">Comentário desta atualização (opcional, fica no histórico)</label>
          <input className="input" placeholder="Ex: Aguardando documento do cliente"
            value={form.comentario} onChange={(e) => setForm((p: any) => ({ ...p, comentario: e.target.value }))} />
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={salvando} className="btn btn-primary">
            {salvando ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </form>

      <div className="card">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Histórico</h2>
        {evento.historico.length === 0 ? (
          <p className="text-xs text-gray-400">Nenhum histórico ainda.</p>
        ) : (
          <div className="space-y-2">
            {evento.historico.map((h: any) => (
              <div key={h.id} className="text-xs border-b border-gray-100 pb-2 last:border-0">
                <div className="flex items-center justify-between text-gray-400">
                  <span>{h.usuario?.nome ?? "Sistema"}</span>
                  <span>{formatData(h.dataHora)}</span>
                </div>
                <p className="text-gray-700 mt-0.5">{h.descricao}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
