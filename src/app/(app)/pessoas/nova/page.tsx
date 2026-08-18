"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NovaPessoaPage() {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    dataNascimento: "",
    estadoCivil: "",
    telefone: "",
    email: "",
  });

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);

    const res = await fetch("/api/pessoas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      const pessoa = await res.json();
      router.push(`/pessoas/${pessoa.id}`);
    } else {
      const json = await res.json();
      setErro(json.error ?? "Erro ao cadastrar pessoa.");
      setSalvando(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/pessoas" className="hover:text-gray-900">Pessoas</Link>
        <span>/</span>
        <span className="text-gray-900">Nova pessoa</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Dados pessoais</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Nome completo <span className="text-red-500">*</span></label>
              <input className="input" value={form.nome} onChange={(e) => set("nome", e.target.value)} required />
            </div>
            <div>
              <label className="label">CPF <span className="text-red-500">*</span></label>
              <input className="input font-mono" placeholder="000.000.000-00"
                value={form.cpf} onChange={(e) => set("cpf", e.target.value)} required />
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
            <div className="md:col-span-2">
              <label className="label">E-mail</label>
              <input className="input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
          </div>
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
          <Link href="/pessoas" className="btn">Cancelar</Link>
          <button type="submit" disabled={salvando} className="btn btn-primary">
            {salvando ? "Salvando..." : "Criar pessoa"}
          </button>
        </div>
      </form>
    </div>
  );
}
