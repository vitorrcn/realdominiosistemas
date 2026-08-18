"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface EmpresaExtraida {
  codigoInterno: string | null;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  cnpj: string | null;
  municipio: string | null;
  bairro: string | null;
  estado: string | null;
  endereco: string | null;
  complemento: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
  inscricaoMunicipal: string | null;
  inscricaoEstadual: string | null;
  capitalSocial: string | null;
  cnae: string | null;
  dataAbertura: string | null;
  dataEntrada: string | null;
  dataSaida: string | null;
  regimeTributario: string | null;
}

const REGIMES: Record<string, string> = {
  MEI: "MEI",
  SIMPLES_NACIONAL: "Simples Nacional",
  LUCRO_PRESUMIDO: "Lucro Presumido",
  LUCRO_REAL: "Lucro Real",
  CARNE_LEAO: "Carnê-Leão",
  ISENTO: "Isento",
  OUTRO: "Outro",
};

export default function ImportarPdfPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [lendo, setLendo] = useState(false);
  const [erroLeitura, setErroLeitura] = useState<string | null>(null);
  const [empresas, setEmpresas] = useState<EmpresaExtraida[]>([]);
  const [status, setStatus] = useState<Record<number, "pendente" | "criando" | "criada" | "erro">>({});
  const [erros, setErros] = useState<Record<number, string>>({});

  async function lerArquivo(file: File) {
    setLendo(true);
    setErroLeitura(null);
    setEmpresas([]);
    const form = new FormData();
    form.append("arquivo", file);

    const res = await fetch("/api/empresas/importar-pdf", { method: "POST", body: form });
    setLendo(false);

    if (res.ok) {
      const json = await res.json();
      setEmpresas(json.empresas);
      const statusInicial: Record<number, "pendente"> = {};
      json.empresas.forEach((_: any, i: number) => { statusInicial[i] = "pendente"; });
      setStatus(statusInicial);
    } else {
      const json = await res.json().catch(() => ({}));
      setErroLeitura(json.error ?? "Erro ao ler o PDF.");
    }
  }

  function atualizarCampo(index: number, campo: keyof EmpresaExtraida, valor: string) {
    setEmpresas((prev) => prev.map((e, i) => i === index ? { ...e, [campo]: valor } : e));
  }

  async function criarUm(index: number) {
    const e = empresas[index];
    setStatus((p) => ({ ...p, [index]: "criando" }));

    const res = await fetch("/api/empresas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipoPessoa: "PJ",
        codigoInterno: e.codigoInterno || `IMP-${Date.now()}-${index}`,
        cnpj: e.cnpj,
        razaoSocial: e.razaoSocial,
        nomeFantasia: e.nomeFantasia,
        municipio: e.municipio,
        bairro: e.bairro,
        estado: e.estado,
        endereco: e.endereco,
        complemento: e.complemento,
        cep: e.cep,
        telefone: e.telefone,
        email: e.email,
        inscricaoMunicipal: e.inscricaoMunicipal,
        inscricaoEstadual: e.inscricaoEstadual,
        capitalSocial: e.capitalSocial,
        cnae: e.cnae,
        dataAbertura: e.dataAbertura,
        dataEntrada: e.dataEntrada,
        dataSaida: e.dataSaida,
        regimeTributario: e.regimeTributario,
      }),
    });

    if (res.ok) {
      setStatus((p) => ({ ...p, [index]: "criada" }));
    } else {
      const json = await res.json().catch(() => ({}));
      setErros((p) => ({ ...p, [index]: json.error ?? "Erro ao criar" }));
      setStatus((p) => ({ ...p, [index]: "erro" }));
    }
  }

  async function criarTodos() {
    for (let i = 0; i < empresas.length; i++) {
      if (status[i] === "pendente" || status[i] === "erro") {
        await criarUm(i);
      }
    }
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/empresas" className="hover:text-gray-900">Clientes</Link>
        <span>/</span>
        <span className="text-gray-900">Importar por PDF</span>
      </div>

      <div className="card space-y-3">
        <h1 className="text-lg font-semibold text-gray-900">Importar por PDF</h1>
        <p className="text-sm text-gray-500">
          Envie o &quot;Relatório de Empresas&quot; (o modelo padrão do escritório). O sistema lê os dados
          automaticamente — confira e ajuste o que precisar antes de confirmar a criação de cada cliente.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          onChange={(e) => e.target.files?.[0] && lerArquivo(e.target.files[0])}
          className="input text-sm"
        />
        {lendo && <p className="text-sm text-gray-400">Lendo o PDF...</p>}
        {erroLeitura && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
            <span className="text-sm text-red-700">{erroLeitura}</span>
          </div>
        )}
      </div>

      {empresas.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{empresas.length} empresa(s) encontrada(s) no PDF</p>
            <button onClick={criarTodos} className="btn btn-primary btn-sm">
              Criar todos os clientes pendentes
            </button>
          </div>

          <div className="space-y-4">
            {empresas.map((e, i) => (
              <div key={i} className="card space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono font-bold text-brand-700 text-sm">{e.codigoInterno || "—"}</span>
                    <span className="text-sm font-medium text-gray-800">{e.razaoSocial || "(nome não identificado)"}</span>
                  </div>
                  {status[i] === "criada" && <span className="badge badge-green">Criado</span>}
                  {status[i] === "erro" && <span className="badge badge-red">{erros[i]}</span>}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div>
                    <label className="label">Código</label>
                    <input className="input text-xs" value={e.codigoInterno ?? ""} onChange={(ev) => atualizarCampo(i, "codigoInterno", ev.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Razão Social</label>
                    <input className="input text-xs" value={e.razaoSocial ?? ""} onChange={(ev) => atualizarCampo(i, "razaoSocial", ev.target.value)} />
                  </div>
                  <div>
                    <label className="label">CNPJ</label>
                    <input className="input text-xs font-mono" value={e.cnpj ?? ""} onChange={(ev) => atualizarCampo(i, "cnpj", ev.target.value)} />
                  </div>
                  <div>
                    <label className="label">Nome Fantasia</label>
                    <input className="input text-xs" value={e.nomeFantasia ?? ""} onChange={(ev) => atualizarCampo(i, "nomeFantasia", ev.target.value)} />
                  </div>
                  <div>
                    <label className="label">Cidade</label>
                    <input className="input text-xs" value={e.municipio ?? ""} onChange={(ev) => atualizarCampo(i, "municipio", ev.target.value)} />
                  </div>
                  <div>
                    <label className="label">Bairro</label>
                    <input className="input text-xs" value={e.bairro ?? ""} onChange={(ev) => atualizarCampo(i, "bairro", ev.target.value)} />
                  </div>
                  <div>
                    <label className="label">UF</label>
                    <input className="input text-xs" value={e.estado ?? ""} onChange={(ev) => atualizarCampo(i, "estado", ev.target.value)} />
                  </div>
                  <div>
                    <label className="label">Regime tributário</label>
                    <select className="select text-xs" value={e.regimeTributario ?? ""} onChange={(ev) => atualizarCampo(i, "regimeTributario", ev.target.value)}>
                      <option value="">Não identificado</option>
                      {Object.entries(REGIMES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Data abertura</label>
                    <input className="input text-xs" type="date" value={e.dataAbertura ?? ""} onChange={(ev) => atualizarCampo(i, "dataAbertura", ev.target.value)} />
                  </div>
                  <div>
                    <label className="label">Data entrada</label>
                    <input className="input text-xs" type="date" value={e.dataEntrada ?? ""} onChange={(ev) => atualizarCampo(i, "dataEntrada", ev.target.value)} />
                  </div>
                  <div>
                    <label className="label">Telefone</label>
                    <input className="input text-xs" value={e.telefone ?? ""} onChange={(ev) => atualizarCampo(i, "telefone", ev.target.value)} />
                  </div>
                  <div>
                    <label className="label">E-mail</label>
                    <input className="input text-xs" value={e.email ?? ""} onChange={(ev) => atualizarCampo(i, "email", ev.target.value)} />
                  </div>
                </div>

                {status[i] !== "criada" && (
                  <div className="flex justify-end">
                    <button onClick={() => criarUm(i)} disabled={status[i] === "criando"} className="btn btn-sm btn-primary">
                      {status[i] === "criando" ? "Criando..." : "Criar este cliente"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
