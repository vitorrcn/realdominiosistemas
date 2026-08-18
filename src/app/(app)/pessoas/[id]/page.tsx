"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatCpf, formatData } from "@/lib/utils";

interface EmpresaBusca {
  id: string;
  razaoSocial: string;
  cnpj: string;
  codigoInterno: string;
}

export default function PessoaPage({ params }: { params: { id: string } }) {
  const [pessoa, setPessoa] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const buscar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch(`/api/pessoas/${params.id}`);
      if (!res.ok) throw new Error("Pessoa não encontrada");
      setPessoa(await res.json());
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [params.id]);

  useEffect(() => { buscar(); }, [buscar]);

  // ── Formulário de dados pessoais ──────────────────────────────
  const [form, setForm] = useState<Record<string, any> | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (pessoa && !form) {
      setForm({
        nome: pessoa.nome ?? "",
        dataNascimento: pessoa.dataNascimento ? String(pessoa.dataNascimento).slice(0, 10) : "",
        estadoCivil: pessoa.estadoCivil ?? "",
        telefone: pessoa.telefone ?? "",
        email: pessoa.email ?? "",
      });
    }
  }, [pessoa, form]);

  const set = (k: string, v: any) => setForm((p) => ({ ...(p as any), [k]: v }));

  async function salvarDados(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSalvando(true);
    const res = await fetch(`/api/pessoas/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, dataNascimento: form.dataNascimento || null }),
    });
    setSalvando(false);
    if (res.ok) {
      setMsg({ tipo: "ok", texto: "Dados salvos!" });
      buscar();
    } else {
      setMsg({ tipo: "erro", texto: "Erro ao salvar." });
    }
    setTimeout(() => setMsg(null), 3000);
  }

  // ── Vincular sócio a empresa ───────────────────────────────────
  const [buscaEmpresa, setBuscaEmpresa] = useState("");
  const [resultadosEmpresa, setResultadosEmpresa] = useState<EmpresaBusca[]>([]);
  const [empresaEscolhida, setEmpresaEscolhida] = useState<EmpresaBusca | null>(null);
  const [percentual, setPercentual] = useState("");
  const [eAdmin, setEAdmin] = useState(false);
  const [vinculando, setVinculando] = useState(false);

  useEffect(() => {
    if (!buscaEmpresa || empresaEscolhida) { setResultadosEmpresa([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/empresas?q=${encodeURIComponent(buscaEmpresa)}&pageSize=5`);
      if (res.ok) {
        const json = await res.json();
        setResultadosEmpresa(json.data);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [buscaEmpresa, empresaEscolhida]);

  async function vincularSocio() {
    if (!empresaEscolhida) return;
    setVinculando(true);
    const res = await fetch(`/api/empresas/${empresaEscolhida.id}/socios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pessoaId: params.id,
        percentualParticipacao: percentual || null,
        eAdministrador: eAdmin,
      }),
    });
    setVinculando(false);
    if (res.ok) {
      setBuscaEmpresa(""); setEmpresaEscolhida(null); setPercentual(""); setEAdmin(false);
      setMsg({ tipo: "ok", texto: "Sócio vinculado à empresa!" });
      buscar();
    } else {
      setMsg({ tipo: "erro", texto: "Erro ao vincular sócio." });
    }
    setTimeout(() => setMsg(null), 3000);
  }

  async function desvincular(empresaId: string) {
    if (!confirm("Encerrar o vínculo dessa pessoa com essa empresa?")) return;
    const res = await fetch(`/api/empresas/${empresaId}/socios?pessoaId=${params.id}`, { method: "DELETE" });
    if (res.ok) buscar();
  }

  if (carregando) return (
    <div className="flex items-center justify-center h-64 text-gray-400">Carregando pessoa...</div>
  );

  if (erro || !pessoa) return (
    <div className="card text-center py-12 text-red-500">{erro ?? "Pessoa não encontrada"}</div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/pessoas" className="hover:text-gray-900">Pessoas</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium truncate max-w-xs">{pessoa.nome}</span>
      </div>

      <div className="card">
        <h1 className="text-xl font-semibold text-gray-900">{pessoa.nome}</h1>
        <div className="text-xs text-gray-400 font-mono mt-1">{formatCpf(pessoa.cpf)}</div>
      </div>

      {msg && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-lg text-sm font-medium z-50 ${
          msg.tipo === "ok" ? "bg-green-600 text-white" : "bg-red-600 text-white"
        }`}>
          {msg.texto}
        </div>
      )}

      {/* Dados pessoais */}
      {form && (
        <form onSubmit={salvarDados} className="card space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Dados pessoais</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Nome completo</label>
              <input className="input" value={form.nome} onChange={(e) => set("nome", e.target.value)} />
            </div>
            <div>
              <label className="label">Data de nascimento</label>
              <input className="input" type="date" value={form.dataNascimento} onChange={(e) => set("dataNascimento", e.target.value)} />
            </div>
            <div>
              <label className="label">Estado civil</label>
              <select className="select" value={form.estadoCivil} onChange={(e) => set("estadoCivil", e.target.value)}>
                <option value="">Selecione...</option>
                <option value="SOLTEIRO">Solteiro(a)</option>
                <option value="CASADO">Casado(a)</option>
                <option value="DIVORCIADO">Divorciado(a)</option>
                <option value="VIUVO">Viúvo(a)</option>
                <option value="UNIAO_ESTAVEL">União estável</option>
              </select>
            </div>
            <div>
              <label className="label">Telefone</label>
              <input className="input" value={form.telefone} onChange={(e) => set("telefone", e.target.value)} />
            </div>
            <div>
              <label className="label">E-mail</label>
              <input className="input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={salvando} className="btn btn-primary">
              {salvando ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </form>
      )}

      {/* Empresas vinculadas (sócio/administrador) */}
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Empresas vinculadas (sócio/administrador)</h3>

        {pessoa.empresas.length === 0 ? (
          <p className="text-xs text-gray-400">Nenhuma empresa vinculada ainda.</p>
        ) : (
          <div className="space-y-1.5">
            {pessoa.empresas.map((v: any) => (
              <div key={v.empresa.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                <Link href={`/empresas/${v.empresa.id}`} className="text-sm text-gray-800 hover:text-brand-700 flex-1">
                  {v.empresa.razaoSocial}
                </Link>
                {v.eAdministrador && <span className="badge badge-blue text-[10px]">Administrador</span>}
                {v.percentualParticipacao != null && (
                  <span className="text-xs text-gray-500">{Number(v.percentualParticipacao)}%</span>
                )}
                <button onClick={() => desvincular(v.empresa.id)} className="text-xs text-red-500 hover:underline">
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Adicionar vínculo */}
        <div className="pt-3 border-t border-gray-100 space-y-3">
          <label className="label">Vincular a uma nova empresa</label>
          <div className="relative">
            <input
              className="input text-sm"
              placeholder="Buscar empresa por nome ou CNPJ..."
              value={empresaEscolhida ? empresaEscolhida.razaoSocial : buscaEmpresa}
              onChange={(e) => { setBuscaEmpresa(e.target.value); setEmpresaEscolhida(null); }}
            />
            {resultadosEmpresa.length > 0 && !empresaEscolhida && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {resultadosEmpresa.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => { setEmpresaEscolhida(e); setResultadosEmpresa([]); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    {e.razaoSocial} <span className="text-xs text-gray-400">#{e.codigoInterno}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {empresaEscolhida && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <label className="label">% de participação</label>
                <input className="input" type="number" step="0.01" min={0} max={100}
                  value={percentual} onChange={(e) => setPercentual(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer pb-2">
                <input type="checkbox" className="w-4 h-4 rounded text-brand-600"
                  checked={eAdmin} onChange={(e) => setEAdmin(e.target.checked)} />
                <span className="text-sm text-gray-700">É administrador</span>
              </label>
              <button type="button" onClick={vincularSocio} disabled={vinculando} className="btn btn-primary btn-sm">
                {vinculando ? "Vinculando..." : "Vincular"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Dependentes */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Dependentes</h3>
        {pessoa.dependentes.length === 0 ? (
          <p className="text-xs text-gray-400">Nenhum dependente cadastrado.</p>
        ) : (
          <div className="space-y-1.5">
            {pessoa.dependentes.map((d: any) => (
              <div key={d.dependente.id} className="flex items-center gap-3 py-1.5 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-800 flex-1">{d.dependente.nome}</span>
                <span className="text-xs text-gray-400">{d.parentesco ?? "—"}</span>
                {d.dependente.dataNascimento && (
                  <span className="text-xs text-gray-400">{formatData(d.dependente.dataNascimento)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
