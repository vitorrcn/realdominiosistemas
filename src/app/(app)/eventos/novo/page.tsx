"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SeletorGruposEmail } from "@/components/ui/SeletorGruposEmail";

export default function NovoEventoPage() {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [setores, setSetores] = useState<{ id: string; nome: string }[]>([]);
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string }[]>([]);

  const [buscaEmpresa, setBuscaEmpresa] = useState("");
  const [resultados, setResultados] = useState<any[]>([]);
  const [empresaEscolhida, setEmpresaEscolhida] = useState<any>(null);

  const [form, setForm] = useState({
    tipoEventoNome: "",
    setorAtualId: "",
    respAtualId: "",
    prazo: "",
    observacoes: "",
  });
  const [enviarEmail, setEnviarEmail] = useState(false);
  const [gruposEmail, setGruposEmail] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/setores").then((r) => r.ok ? r.json() : []).then(setSetores).catch(() => {});
    fetch("/api/usuarios").then((r) => r.ok ? r.json() : []).then(setUsuarios).catch(() => {});
  }, []);

  useEffect(() => {
    if (!buscaEmpresa || empresaEscolhida) { setResultados([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/empresas?q=${encodeURIComponent(buscaEmpresa)}&pageSize=5`);
      if (res.ok) setResultados((await res.json()).data);
    }, 300);
    return () => clearTimeout(t);
  }, [buscaEmpresa, empresaEscolhida]);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!empresaEscolhida) { setErro("Selecione uma empresa."); return; }
    setErro(null);
    setSalvando(true);

    const res = await fetch("/api/eventos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, empresaId: empresaEscolhida.id, enviarEmail, gruposEmail }),
    });

    if (res.ok) {
      const evento = await res.json();
      router.push(`/eventos/${evento.id}`);
    } else {
      const json = await res.json().catch(() => ({}));
      setErro(json.error ?? "Erro ao criar evento.");
      setSalvando(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/eventos" className="hover:text-gray-900">Eventos</Link>
        <span>/</span>
        <span className="text-gray-900">Novo evento</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Cliente</h2>
          <div className="relative">
            <input
              className="input"
              placeholder="Buscar cliente por nome ou código..."
              value={empresaEscolhida ? `${empresaEscolhida.codigoInterno} — ${empresaEscolhida.razaoSocial}` : buscaEmpresa}
              onChange={(e) => { setBuscaEmpresa(e.target.value); setEmpresaEscolhida(null); }}
              required
            />
            {resultados.length > 0 && !empresaEscolhida && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {resultados.map((e: any) => (
                  <button key={e.id} type="button" onClick={() => { setEmpresaEscolhida(e); setResultados([]); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                    <span className="font-mono font-bold text-brand-700">{e.codigoInterno}</span> — {e.razaoSocial}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Dados do evento</h2>
          <div>
            <label className="label">Tipo de evento</label>
            <input className="input" placeholder="Ex: Abertura de filial, Alteração contratual..."
              value={form.tipoEventoNome} onChange={(e) => set("tipoEventoNome", e.target.value)} required />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Setor responsável</label>
              <select className="select" value={form.setorAtualId} onChange={(e) => set("setorAtualId", e.target.value)}>
                <option value="">Selecione...</option>
                {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Responsável</label>
              <select className="select" value={form.respAtualId} onChange={(e) => set("respAtualId", e.target.value)}>
                <option value="">Não atribuído</option>
                {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Prazo</label>
              <input className="input" type="date" value={form.prazo} onChange={(e) => set("prazo", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Observações</label>
            <textarea className="input min-h-[80px]" value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
          </div>
        </div>

        <SeletorGruposEmail
          enviarEmail={enviarEmail}
          grupos={gruposEmail}
          onMudarEnviar={setEnviarEmail}
          onMudarGrupos={setGruposEmail}
        />

        {erro && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
            <span className="text-sm text-red-700">{erro}</span>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Link href="/eventos" className="btn">Cancelar</Link>
          <button type="submit" disabled={salvando} className="btn btn-primary">
            {salvando ? "Criando..." : "Criar evento"}
          </button>
        </div>
      </form>
    </div>
  );
}
