"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface LinhaRelatorio {
  id: string;
  nome: string;
  quantidade: number;
}

export default function RelatorioRamosPage() {
  const [dados, setDados] = useState<LinhaRelatorio[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    fetch("/api/relatorios/ramos")
      .then((r) => r.json())
      .then((json) => { setDados(json.dados); setTotal(json.total); })
      .finally(() => setCarregando(false));
  }, []);

  const maiorQuantidade = Math.max(1, ...dados.map((d) => d.quantidade));

  async function exportarExcel() {
    setExportando(true);
    try {
      const XLSX = await import("xlsx");
      const linhas = dados.map((d) => ({
        "Ramo": d.nome,
        "Quantidade de empresas": d.quantidade,
        "% do total": total > 0 ? `${((d.quantidade / total) * 100).toFixed(1)}%` : "0%",
      }));
      const ws = XLSX.utils.json_to_sheet(linhas);
      ws["!cols"] = [{ wch: 55 }, { wch: 22 }, { wch: 14 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Empresas por ramo");
      XLSX.writeFile(wb, `empresas-por-ramo-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/empresas" className="hover:text-gray-900">Clientes</Link>
        <span>/</span>
        <span className="text-gray-900">Relatório por ramo</span>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Empresas por ramo</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {carregando ? "Carregando..." : `${total} empresa${total !== 1 ? "s" : ""} ativa${total !== 1 ? "s" : ""} no total`}
          </p>
        </div>
        <button onClick={exportarExcel} disabled={carregando || exportando || dados.length === 0} className="btn btn-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          {exportando ? "Gerando..." : "Exportar Excel"}
        </button>
      </div>

      <div className="card space-y-3">
        {carregando ? (
          <p className="text-center py-8 text-gray-400 text-sm">Carregando...</p>
        ) : dados.length === 0 ? (
          <p className="text-center py-8 text-gray-400 text-sm">
            Nenhuma empresa com ramo cadastrado ainda.
          </p>
        ) : (
          dados.map((d) => (
            <div key={d.id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className={d.id === "sem-ramo" ? "text-gray-400 italic" : "text-gray-800"}>{d.nome}</span>
                <span className="text-gray-500 font-medium">
                  {d.quantidade} {total > 0 && <span className="text-gray-400 font-normal">({((d.quantidade / total) * 100).toFixed(0)}%)</span>}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${d.id === "sem-ramo" ? "bg-gray-300" : "bg-brand-500"}`}
                  style={{ width: `${(d.quantidade / maiorQuantidade) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
