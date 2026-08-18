"use client";

import { useState, useRef } from "react";
import Link from "next/link";

interface ResultadoImport {
  criadas: number;
  atualizadas: number;
  ignoradas: number;
  erros: { linha: number; documento: string; motivo: string }[];
}

export default function ImportarEmpresasPage() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImport | null>(null);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function baixarModelo() {
    const XLSX = await import("xlsx");
    const linhas = [
      { codigo_interno: "0001", cnpj: "12.345.678/0001-90", cpf: "", nome_empresarial: "Padaria Central Ltda (EXEMPLO - apague esta linha)", bairro: "Centro", municipio: "Brasília", data_entrada: "2022-03-15", data_saida: "" },
      { codigo_interno: "0002", cnpj: "", cpf: "123.456.789-00", nome_empresarial: "Maria da Silva (EXEMPLO - apague esta linha)", bairro: "Asa Norte", municipio: "Brasília", data_entrada: "2021-07-01", data_saida: "2024-11-30" },
    ];
    const ws = XLSX.utils.json_to_sheet(linhas);
    ws["!cols"] = [{ wch: 16 }, { wch: 22 }, { wch: 18 }, { wch: 45 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    XLSX.writeFile(wb, "modelo-importacao-clientes.xlsx");
  }

  async function enviar() {
    if (!arquivo) return;
    setEnviando(true);
    setResultado(null);
    setErroEnvio(null);

    try {
      const form = new FormData();
      form.append("arquivo", arquivo);

      const res = await fetch("/api/empresas/importar", { method: "POST", body: form });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Erro ao importar arquivo.");
      }
      const json = await res.json();
      setResultado(json);
    } catch (e: any) {
      setErroEnvio(e.message ?? "Erro ao importar arquivo. Verifique se é um Excel/CSV válido.");
    } finally {
      setEnviando(false);
    }
  }

  const temErros = (resultado?.erros?.length ?? 0) > 0;

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/empresas" className="hover:text-gray-900">Clientes</Link>
        <span>/</span>
        <span className="text-gray-900">Importar via planilha</span>
      </div>

      {/* Instruções */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Como importar</h2>
        <p className="text-sm text-gray-600">
          Prepare uma planilha Excel ou CSV com as seguintes colunas. Os nomes das
          colunas são flexíveis — o sistema aceita variações.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Coluna</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Obrigatório</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Exemplo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-3 py-2 font-mono text-brand-700">codigo_interno</td>
                <td className="px-3 py-2 text-gray-500">Recomendado</td>
                <td className="px-3 py-2 text-gray-500">0042</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-brand-700">cnpj</td>
                <td className="px-3 py-2"><span className="badge badge-yellow">Obrigatório se for Pessoa Jurídica</span></td>
                <td className="px-3 py-2 text-gray-500">12.345.678/0001-90 ou 12345678000190</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-brand-700">cpf</td>
                <td className="px-3 py-2"><span className="badge badge-yellow">Obrigatório se for Pessoa Física</span></td>
                <td className="px-3 py-2 text-gray-500">123.456.789-00 ou 12345678900</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-brand-700">nome_empresarial</td>
                <td className="px-3 py-2"><span className="badge badge-red">Obrigatório</span></td>
                <td className="px-3 py-2 text-gray-500">Padaria Central Ltda</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-brand-700">bairro</td>
                <td className="px-3 py-2"><span className="badge badge-gray">Opcional</span></td>
                <td className="px-3 py-2 text-gray-500">Centro</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-brand-700">municipio</td>
                <td className="px-3 py-2"><span className="badge badge-gray">Opcional</span></td>
                <td className="px-3 py-2 text-gray-500">Brasília</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-brand-700">data_entrada</td>
                <td className="px-3 py-2"><span className="badge badge-gray">Opcional</span></td>
                <td className="px-3 py-2 text-gray-500">2022-03-15 ou 15/03/2022</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-brand-700">data_saida</td>
                <td className="px-3 py-2"><span className="badge badge-gray">Opcional — se preenchida, cliente já entra como &quot;Ex-cliente&quot;</span></td>
                <td className="px-3 py-2 text-gray-500">2024-11-30 ou 30/11/2024</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <strong>Comportamento:</strong> preencha <em>ou</em> a coluna cnpj <em>ou</em> a coluna cpf em cada linha —
          o sistema identifica automaticamente se é Pessoa Jurídica ou Pessoa Física por qual das duas está preenchida.
          Clientes novos são criados com status &quot;Cadastro incompleto&quot;. Se o documento já existe no sistema, o
          registro é atualizado apenas se o código interno estiver vazio. Nenhum dado existente é apagado.
        </div>

        <button onClick={baixarModelo} className="btn btn-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Baixar planilha modelo
        </button>
      </div>

      {/* Upload */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Selecionar arquivo</h2>

        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            arquivo ? "border-brand-300 bg-brand-50" : "border-gray-200 hover:border-gray-300"
          }`}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          />
          {arquivo ? (
            <div>
              <div className="text-2xl mb-2">📄</div>
              <div className="text-sm font-medium text-brand-700">{arquivo.name}</div>
              <div className="text-xs text-gray-400 mt-1">
                {(arquivo.size / 1024).toFixed(1)} KB · Clique para trocar
              </div>
            </div>
          ) : (
            <div>
              <div className="text-3xl mb-2">📂</div>
              <div className="text-sm text-gray-600">
                Clique para selecionar ou arraste o arquivo aqui
              </div>
              <div className="text-xs text-gray-400 mt-1">Excel (.xlsx, .xls) ou CSV</div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={enviar}
            disabled={!arquivo || enviando}
            className="btn btn-primary disabled:opacity-50"
          >
            {enviando ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Importando...
              </>
            ) : "Importar agora"}
          </button>
          {arquivo && (
            <button className="btn" onClick={() => { setArquivo(null); setResultado(null); setErroEnvio(null); }}>
              Cancelar
            </button>
          )}
        </div>

        {erroEnvio && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
            <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span className="text-sm text-red-700">{erroEnvio}</span>
          </div>
        )}
      </div>

      {/* Resultado */}
      {resultado && (
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Resultado da importação</h2>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
              <div className="text-2xl font-semibold text-green-700">{resultado.criadas}</div>
              <div className="text-xs text-green-600 mt-0.5">Criadas</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
              <div className="text-2xl font-semibold text-blue-700">{resultado.atualizadas}</div>
              <div className="text-xs text-blue-600 mt-0.5">Atualizadas</div>
            </div>
            <div className={`rounded-xl p-3 text-center border ${
              temErros ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"
            }`}>
              <div className={`text-2xl font-semibold ${temErros ? "text-red-600" : "text-gray-600"}`}>
                {resultado.erros.length}
              </div>
              <div className={`text-xs mt-0.5 ${temErros ? "text-red-500" : "text-gray-500"}`}>Erros</div>
            </div>
          </div>

          {temErros && (
            <div>
              <h3 className="text-xs font-semibold text-red-700 mb-2">
                Linhas com erro — verifique e reimporte:
              </h3>
              <div className="overflow-x-auto border border-red-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-red-50">
                      <th className="px-3 py-2 text-left text-red-700">Linha</th>
                      <th className="px-3 py-2 text-left text-red-700">Documento</th>
                      <th className="px-3 py-2 text-left text-red-700">Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100">
                    {resultado.erros.map((e, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-gray-600">{e.linha}</td>
                        <td className="px-3 py-2 font-mono text-gray-600">{e.documento}</td>
                        <td className="px-3 py-2 text-red-600">{e.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {resultado.criadas > 0 && (
            <Link href="/empresas" className="btn btn-primary inline-flex">
              Ver clientes importados →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
