"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatCpf } from "@/lib/utils";

interface PessoaResumo {
  id: string;
  nome: string;
  cpf: string;
  telefone: string | null;
  email: string | null;
  _count: { empresas: number; dependentes: number };
  empresas: { empresa: { id: string; razaoSocial: string }; eAdministrador: boolean }[];
}

export default function PessoasPage() {
  const [pessoas, setPessoas] = useState<PessoaResumo[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const buscar = useCallback(async () => {
    setCarregando(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    const res = await fetch(`/api/pessoas?${params}`);
    if (res.ok) {
      const json = await res.json();
      setPessoas(json.data);
      setTotal(json.total);
    }
    setCarregando(false);
  }, [q, page]);

  useEffect(() => {
    const t = setTimeout(buscar, 300);
    return () => clearTimeout(t);
  }, [buscar]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-5">
      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              className="input pl-9 text-sm"
              placeholder="Nome, CPF ou e-mail..."
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
            />
          </div>

          <Link href="/pessoas/nova" className="btn btn-sm btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nova pessoa
          </Link>
        </div>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {carregando ? "Carregando..." : `${total} pessoa${total !== 1 ? "s" : ""}`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="table-auto-fixed">
            <thead>
              <tr>
                <th style={{ width: 220 }}>Nome</th>
                <th style={{ width: 130 }}>CPF</th>
                <th style={{ width: 130 }}>Telefone</th>
                <th style={{ width: 200 }}>Empresas vinculadas</th>
                <th style={{ width: 90 }}>Dependentes</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-400">Carregando...</td>
                </tr>
              ) : pessoas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-400">Nenhuma pessoa encontrada</td>
                </tr>
              ) : pessoas.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/pessoas/${p.id}`} className="block">
                      <div className="font-medium text-gray-900 truncate">{p.nome}</div>
                      {p.email && <div className="text-xs text-gray-400 mt-0.5">{p.email}</div>}
                    </Link>
                  </td>
                  <td className="text-gray-500 text-xs font-mono">{formatCpf(p.cpf)}</td>
                  <td className="text-gray-500 text-xs">{p.telefone ?? "—"}</td>
                  <td>
                    {p.empresas.length === 0 ? (
                      <span className="text-xs text-gray-300">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {p.empresas.map((v) => (
                          <span key={v.empresa.id} className="badge badge-gray text-[10px]">
                            {v.empresa.razaoSocial}{v.eAdministrador ? " · admin" : ""}
                          </span>
                        ))}
                        {p._count.empresas > p.empresas.length && (
                          <span className="text-[10px] text-gray-400">+{p._count.empresas - p.empresas.length}</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="text-gray-500 text-xs">{p._count.dependentes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">Página {page} de {totalPages}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-sm disabled:opacity-40">← Anterior</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-sm disabled:opacity-40">Próxima →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
