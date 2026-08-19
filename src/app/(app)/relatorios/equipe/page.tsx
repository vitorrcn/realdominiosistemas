"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const PERFIS: Record<string, string> = {
  DIRETORIA:    "Diretoria",
  COORDENADOR:  "Coordenador",
  LIDER:        "Mordomo(a)",
  OPERADOR:     "Operador",
  CONSULTA:     "Estagiário",
};

interface LinhaEquipe {
  id: string;
  nome: string;
  funcao: string;
  empresasCarteira: number;
  empresasLidera: number;
  empresasSupervisiona: number;
}

type Ordem = "nome" | "empresasCarteira" | "empresasLidera" | "empresasSupervisiona";

export default function RelatorioEquipePage() {
  const [equipe, setEquipe] = useState<LinhaEquipe[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [ordem, setOrdem] = useState<Ordem>("nome");

  useEffect(() => {
    fetch("/api/relatorios/equipe")
      .then((r) => (r.ok ? r.json() : { equipe: [] }))
      .then((json) => setEquipe(json.equipe ?? []))
      .finally(() => setCarregando(false));
  }, []);

  const linhas = [...equipe].sort((a, b) =>
    ordem === "nome" ? a.nome.localeCompare(b.nome) : b[ordem] - a[ordem]
  );

  function Th({ campo, label, alinhamento = "right" }: { campo: Ordem; label: string; alinhamento?: "left" | "right" }) {
    return (
      <th
        className={`cursor-pointer select-none hover:text-gray-700 ${alinhamento === "right" ? "text-right" : ""}`}
        onClick={() => setOrdem(campo)}
        title="Clique pra ordenar"
      >
        {label}{ordem === campo && " ▾"}
      </th>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/dashboard" className="hover:text-gray-900">Dashboard</Link>
        <span>/</span>
        <span className="text-gray-900">Estatísticas da equipe</span>
      </div>

      <div>
        <h1 className="text-lg font-semibold text-gray-900">Estatísticas da equipe</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Empresas ativas por funcionário. Como líder, supervisor e responsável de setor são papéis
          independentes por empresa, a mesma pessoa pode aparecer com números nas três colunas.
        </p>
      </div>

      <div className="card !p-0 overflow-hidden">
        {carregando ? (
          <p className="text-center py-8 text-gray-400 text-sm">Carregando...</p>
        ) : linhas.length === 0 ? (
          <p className="text-center py-8 text-gray-400 text-sm">Nenhum usuário ativo encontrado.</p>
        ) : (
          <table className="table-auto-fixed">
            <thead>
              <tr>
                <Th campo="nome" label="Funcionário" alinhamento="left" />
                <th className="text-left">Função</th>
                <Th campo="empresasCarteira" label="Opera (carteira)" />
                <Th campo="empresasLidera" label="Lidera" />
                <Th campo="empresasSupervisiona" label="Supervisiona" />
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id}>
                  <td className="font-medium text-gray-900">{l.nome}</td>
                  <td className="text-gray-500">{PERFIS[l.funcao] ?? l.funcao}</td>
                  <td className="text-right">{l.empresasCarteira}</td>
                  <td className="text-right">{l.empresasLidera}</td>
                  <td className="text-right">{l.empresasSupervisiona}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
