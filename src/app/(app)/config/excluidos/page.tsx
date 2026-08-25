"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatCnpj, formatCpf, formatData } from "@/lib/utils";

interface Excluida {
  id: string;
  codigoInterno: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  tipoPessoa: "PJ" | "PF";
  cnpj: string | null;
  cpf: string | null;
  deletedAt: string;
}

export default function ClientesExcluidosPage() {
  const [lista, setLista] = useState<Excluida[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [q, setQ] = useState("");
  const [processando, setProcessando] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const buscar = useCallback(async () => {
    setCarregando(true);
    const res = await fetch(`/api/empresas/excluidas?q=${encodeURIComponent(q)}`);
    if (res.ok) setLista(await res.json());
    setCarregando(false);
  }, [q]);

  useEffect(() => {
    const t = setTimeout(buscar, 250);
    return () => clearTimeout(t);
  }, [buscar]);

  async function restaurar(e: Excluida) {
    if (!confirm(`Restaurar "${e.razaoSocial}"? Ela volta a aparecer normalmente em Clientes.`)) return;
    setProcessando(e.id);
    setMsg(null);
    const res = await fetch(`/api/empresas/excluidas/${e.id}/restaurar`, { method: "POST" });
    setProcessando(null);
    if (res.ok) {
      setMsg({ tipo: "ok", texto: `"${e.razaoSocial}" foi restaurada.` });
      buscar();
    } else {
      const json = await res.json().catch(() => ({}));
      setMsg({ tipo: "erro", texto: json.error ?? "Erro ao restaurar." });
    }
  }

  async function apagarDefinitivo(e: Excluida) {
    const certeza = confirm(
      `Apagar "${e.razaoSocial}" DEFINITIVAMENTE? Isso apaga o histórico ligado a ela (obrigações, eventos, tarefas, ` +
      `documentos, acessos) e libera o CNPJ/CPF/código pra reuso imediato. NÃO tem como desfazer.`
    );
    if (!certeza) return;
    setProcessando(e.id);
    setMsg(null);
    const res = await fetch(`/api/empresas/excluidas/${e.id}/apagar`, { method: "POST" });
    setProcessando(null);
    if (res.ok) {
      setMsg({ tipo: "ok", texto: `"${e.razaoSocial}" foi apagada definitivamente.` });
      buscar();
    } else {
      const json = await res.json().catch(() => ({}));
      setMsg({ tipo: "erro", texto: json.error ?? "Erro ao apagar." });
    }
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/config" className="hover:text-gray-900">Configurações</Link>
        <span>/</span>
        <span className="text-gray-900">Clientes excluídos</span>
      </div>

      <div>
        <h1 className="text-lg font-semibold text-gray-900">Clientes excluídos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Clientes excluídos ficam guardados aqui, não somem do banco na hora. Se o cadastro de um cliente
          novo recusar o CNPJ/CPF/código dizendo que já existe, é porque um cliente excluído com esse mesmo
          dado ainda está aqui — restaure ele ou apague definitivamente pra liberar.
        </p>
      </div>

      <input
        className="input"
        placeholder="Buscar por nome, código, CNPJ ou CPF..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {msg && (
        <div className={`flex items-center gap-2 p-3 rounded-lg border ${msg.tipo === "ok" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          <span className={`text-sm ${msg.tipo === "ok" ? "text-green-700" : "text-red-700"}`}>{msg.texto}</span>
        </div>
      )}

      <div className="card !p-0 overflow-hidden">
        {carregando ? (
          <p className="text-center py-10 text-gray-400 text-sm">Carregando...</p>
        ) : lista.length === 0 ? (
          <p className="text-center py-10 text-gray-400 text-sm">
            {q ? "Nenhum cliente excluído encontrado com essa busca." : "Nenhum cliente excluído no momento."}
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {lista.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-brand-700 text-sm">{e.codigoInterno}</span>
                    <span className="text-sm font-medium text-gray-900 truncate">{e.razaoSocial}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {e.tipoPessoa === "PF" ? formatCpf(e.cpf ?? "") : formatCnpj(e.cnpj ?? "")}
                    {" · "}Excluída em {formatData(e.deletedAt)}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => restaurar(e)}
                    disabled={processando === e.id}
                    className="btn btn-sm"
                  >
                    Restaurar
                  </button>
                  <button
                    onClick={() => apagarDefinitivo(e)}
                    disabled={processando === e.id}
                    className="btn btn-sm text-red-600 border-red-200 hover:bg-red-50"
                  >
                    Apagar definitivamente
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
