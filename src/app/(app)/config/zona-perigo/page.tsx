"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const FRASE = "EXCLUIR TODOS OS CLIENTES";

export default function ZonaPerigoPage() {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [apagando, setApagando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const habilitado = texto === FRASE;

  async function apagarTudo() {
    if (!habilitado) return;
    const certeza = confirm(
      "Última confirmação: isso vai apagar TODOS os clientes cadastrados e todo o histórico ligado a eles " +
      "(obrigações, eventos, tarefas, documentos, acessos). NÃO tem como desfazer. Continuar?"
    );
    if (!certeza) return;

    setApagando(true);
    setErro(null);
    const res = await fetch("/api/empresas/apagar-tudo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmacao: texto }),
    });
    setApagando(false);

    if (res.ok) {
      const json = await res.json();
      setResultado(`${json.apagados} cliente(s) apagado(s) com sucesso.`);
      setTexto("");
    } else {
      const json = await res.json().catch(() => ({}));
      setErro(json.error ?? "Erro ao apagar clientes.");
    }
  }

  return (
    <div className="space-y-5 max-w-xl">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/config" className="hover:text-gray-900">Configurações</Link>
        <span>/</span>
        <span className="text-gray-900">Zona de perigo</span>
      </div>

      <div className="card border-2 border-red-200 bg-red-50/40 space-y-4">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h2 className="text-sm font-semibold text-red-900">Apagar todos os clientes</h2>
            <p className="text-sm text-red-700 mt-1">
              Isso apaga <strong>permanentemente</strong> todos os clientes cadastrados (PJ e PF) e tudo o que está
              ligado a eles: obrigações, eventos, tarefas, documentos e acessos. Usuários e configurações do
              sistema (setores, ramos) não são afetados. <strong>Não tem
              como desfazer.</strong>
            </p>
          </div>
        </div>

        <div>
          <label className="label text-red-900">
            Pra confirmar, digite exatamente: <code className="bg-red-100 px-1.5 py-0.5 rounded text-xs">{FRASE}</code>
          </label>
          <input
            className="input border-red-300 focus:border-red-500"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={FRASE}
          />
        </div>

        {erro && <p className="text-sm text-red-700">{erro}</p>}
        {resultado && <p className="text-sm text-green-700 font-medium">{resultado}</p>}

        <button
          onClick={apagarTudo}
          disabled={!habilitado || apagando}
          className="btn bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {apagando ? "Apagando..." : "Apagar todos os clientes definitivamente"}
        </button>
      </div>
    </div>
  );
}
