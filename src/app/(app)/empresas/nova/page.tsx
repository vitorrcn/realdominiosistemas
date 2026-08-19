"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { STATUS_EMPRESA_LABEL } from "@/types";

export default function NovaEmpresaPage() {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    fetch("/api/usuarios").then((r) => r.ok ? r.json() : []).then(setUsuarios).catch(() => {});
  }, []);

  const [form, setForm] = useState({
    codigoInterno: "",
    tipoPessoa: "PJ" as "PJ" | "PF",
    cnpj: "",
    cpf: "",
    razaoSocial: "",
    nomeFantasia: "",
    municipio: "",
    bairro: "",
    estado: "",
    dataAbertura: "",
    dataEntrada: new Date().toISOString().slice(0, 10),
    respLiderId: "",
    supervisorIds: [] as string[],
  });

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const alternarSupervisor = (id: string) =>
    setForm((p) => ({
      ...p,
      supervisorIds: p.supervisorIds.includes(id)
        ? p.supervisorIds.filter((x) => x !== id)
        : [...p.supervisorIds, id],
    }));
  const ehPF = form.tipoPessoa === "PF";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);

    const res = await fetch("/api/empresas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      const empresa = await res.json();
      router.push(`/empresas/${empresa.id}`);
    } else {
      const json = await res.json();
      setErro(json.detalhe ? `${json.error} (${json.detalhe})` : (json.error ?? "Erro ao cadastrar cliente."));
      setSalvando(false);
    }
  }

  const ESTADOS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/empresas" className="hover:text-gray-900">Clientes</Link>
        <span>/</span>
        <span className="text-gray-900">Novo cliente</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Tipo de cliente</h2>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={!ehPF} onChange={() => set("tipoPessoa", "PJ")} />
              <span className="text-sm text-gray-700">Pessoa Jurídica (CNPJ)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={ehPF} onChange={() => set("tipoPessoa", "PF")} />
              <span className="text-sm text-gray-700">Pessoa Física (CPF) — prestação de serviço avulsa</span>
            </label>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Dados básicos</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Código interno <span className="text-red-500">*</span></label>
              <input className="input" placeholder="Ex: 0042"
                value={form.codigoInterno} onChange={(e) => set("codigoInterno", e.target.value)} required />
            </div>
            {ehPF ? (
              <div>
                <label className="label">CPF <span className="text-red-500">*</span></label>
                <input className="input font-mono" placeholder="000.000.000-00"
                  value={form.cpf} onChange={(e) => set("cpf", e.target.value)} required />
              </div>
            ) : (
              <div>
                <label className="label">CNPJ <span className="text-red-500">*</span></label>
                <input className="input font-mono" placeholder="00.000.000/0000-00"
                  value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} required />
              </div>
            )}
            <div className="md:col-span-2">
              <label className="label">{ehPF ? "Nome completo" : "Razão Social / Nome Empresarial"} <span className="text-red-500">*</span></label>
              <input className="input" placeholder={ehPF ? "Nome completo da pessoa" : "Nome completo conforme CNPJ"}
                value={form.razaoSocial} onChange={(e) => set("razaoSocial", e.target.value)} required />
            </div>
            <div className="md:col-span-2">
              <label className="label">{ehPF ? "Como é conhecido (apelido)" : "Nome Fantasia"}</label>
              <input className="input" placeholder="Opcional"
                value={form.nomeFantasia} onChange={(e) => set("nomeFantasia", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Localização</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="label">Município</label>
              <input className="input" value={form.municipio} onChange={(e) => set("municipio", e.target.value)} />
            </div>
            <div>
              <label className="label">Estado</label>
              <select className="select" value={form.estado} onChange={(e) => set("estado", e.target.value)}>
                <option value="">UF</option>
                {ESTADOS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Bairro</label>
              <input className="input" value={form.bairro} onChange={(e) => set("bairro", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Datas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">{ehPF ? "Data de nascimento" : "Data de abertura da empresa"}</label>
              <input className="input" type="date" value={form.dataAbertura} onChange={(e) => set("dataAbertura", e.target.value)} />
            </div>
            <div>
              <label className="label">Data de entrada no escritório</label>
              <input className="input" type="date" value={form.dataEntrada} onChange={(e) => set("dataEntrada", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Responsáveis</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Líder responsável</label>
              <select className="select" value={form.respLiderId} onChange={(e) => set("respLiderId", e.target.value)}>
                <option value="">Não atribuído</option>
                {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Supervisor(es) responsável(is)</label>
              <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-gray-100">
                {usuarios.length === 0 ? (
                  <p className="text-xs text-gray-400 px-3 py-2">Nenhum usuário cadastrado.</p>
                ) : usuarios.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={form.supervisorIds.includes(u.id)} onChange={() => alternarSupervisor(u.id)} />
                    {u.nome}
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">Pode marcar mais de um.</p>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Os responsáveis por setor (Fiscal, Contábil, DP, Societário) são definidos depois, em &quot;Editar cadastro&quot;.
          </p>
        </div>

        {erro && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
            <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span className="text-sm text-red-700">{erro}</span>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Link href="/empresas" className="btn">Cancelar</Link>
          <button type="submit" disabled={salvando} className="btn btn-primary">
            {salvando ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Salvando...
              </>
            ) : "Criar cliente"}
          </button>
        </div>
      </form>
    </div>
  );
}
