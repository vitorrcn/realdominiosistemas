"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Destinatario {
  id: string;
  nome: string;
  email: string;
}

export default function ComunicadosPage() {
  const [tipo, setTipo] = useState<"colaboradores" | "clientes">("colaboradores");
  const [q, setQ] = useState("");
  const [lista, setLista] = useState<Destinatario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [selecionados, setSelecionados] = useState<Record<string, Destinatario>>({});
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const primeiraCargaRef = useRef(true);

  const buscar = useCallback(async () => {
    if (primeiraCargaRef.current) setCarregando(true);
    const res = await fetch(`/api/comunicados/destinatarios?tipo=${tipo}&q=${encodeURIComponent(q)}`);
    if (res.ok) setLista(await res.json());
    setCarregando(false);
    primeiraCargaRef.current = false;
  }, [tipo, q]);

  useEffect(() => {
    const t = setTimeout(buscar, 250);
    return () => clearTimeout(t);
  }, [buscar]);

  // Colaborador e cliente são universos diferentes — trocar de aba limpa
  // a seleção pra não misturar destinatários de tipos diferentes.
  useEffect(() => { setSelecionados({}); }, [tipo]);

  function alternar(d: Destinatario) {
    setSelecionados((prev) => {
      const novo = { ...prev };
      if (novo[d.id]) delete novo[d.id];
      else novo[d.id] = d;
      return novo;
    });
  }

  function selecionarTodosVisiveis() {
    setSelecionados((prev) => {
      const novo = { ...prev };
      for (const d of lista) novo[d.id] = d;
      return novo;
    });
  }

  const selecionadosArr = Object.values(selecionados);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (selecionadosArr.length === 0 || !assunto.trim() || !mensagem.trim()) return;
    if (!confirm(`Enviar esse comunicado pra ${selecionadosArr.length} destinatário(s)?`)) return;

    setEnviando(true);
    setResultado(null);
    const res = await fetch("/api/comunicados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo,
        destinatarios: selecionadosArr.map((d) => ({ email: d.email, nome: d.nome })),
        assunto,
        mensagem,
      }),
    });
    setEnviando(false);

    if (res.ok) {
      const json = await res.json();
      setResultado({
        tipo: "ok",
        texto: `Enviado pra ${json.enviados} de ${json.total} destinatário(s).${
          json.falhas?.length ? ` Falhou pra: ${json.falhas.join(", ")}` : ""
        }`,
      });
      setAssunto("");
      setMensagem("");
      setSelecionados({});
    } else {
      const json = await res.json().catch(() => ({}));
      setResultado({ tipo: "erro", texto: json.error ?? "Erro ao enviar." });
    }
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Comunicados</h1>
        <p className="text-sm text-gray-500 mt-1">
          Mande um e-mail livre pra colaboradores ou clientes. Cada destinatário recebe individualmente
          (sem ver quem mais recebeu), e a cópia fixa configurada em Automações entra em todos.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Destinatários */}
        <div className="card space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTipo("colaboradores")}
              className={`badge cursor-pointer ${tipo === "colaboradores" ? "bg-brand-100 text-brand-700" : "badge-gray"}`}
            >
              Colaboradores
            </button>
            <button
              type="button"
              onClick={() => setTipo("clientes")}
              className={`badge cursor-pointer ${tipo === "clientes" ? "bg-brand-100 text-brand-700" : "badge-gray"}`}
            >
              Clientes
            </button>
          </div>

          <input
            className="input text-sm"
            placeholder={tipo === "colaboradores" ? "Buscar colaborador por nome ou e-mail..." : "Buscar cliente por nome, código ou e-mail..."}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{selecionadosArr.length} selecionado(s)</span>
            <div className="flex gap-3">
              <button type="button" onClick={selecionarTodosVisiveis} className="text-brand-600 hover:underline">
                Selecionar todos visíveis
              </button>
              {selecionadosArr.length > 0 && (
                <button type="button" onClick={() => setSelecionados({})} className="text-gray-400 hover:underline">
                  Limpar
                </button>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-100">
            {carregando ? (
              <p className="text-xs text-gray-400 p-3">Carregando...</p>
            ) : lista.length === 0 ? (
              <p className="text-xs text-gray-400 p-3">
                Nenhum {tipo === "colaboradores" ? "colaborador" : "cliente"} com e-mail cadastrado encontrado.
              </p>
            ) : (
              lista.map((d) => (
                <label key={d.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded text-brand-600 flex-shrink-0"
                    checked={!!selecionados[d.id]}
                    onChange={() => alternar(d)}
                  />
                  <div className="min-w-0">
                    <div className="text-sm text-gray-800 truncate">{d.nome}</div>
                    <div className="text-xs text-gray-400 truncate">{d.email}</div>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Mensagem */}
        <form onSubmit={enviar} className="card space-y-3">
          <div>
            <label className="label">Assunto</label>
            <input className="input" value={assunto} onChange={(e) => setAssunto(e.target.value)} required />
          </div>
          <div>
            <label className="label">Mensagem</label>
            <textarea
              className="input min-h-[220px]"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Escreva o comunicado... (parágrafos separados por linha em branco)"
              required
            />
          </div>

          {resultado && (
            <div className={`flex items-start gap-2 p-3 rounded-lg border ${resultado.tipo === "ok" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              <span className={`text-sm ${resultado.tipo === "ok" ? "text-green-700" : "text-red-700"}`}>{resultado.texto}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={enviando || selecionadosArr.length === 0}
            className="btn btn-primary w-full justify-center"
          >
            {enviando ? "Enviando..." : `Enviar pra ${selecionadosArr.length} destinatário${selecionadosArr.length === 1 ? "" : "s"}`}
          </button>
        </form>
      </div>
    </div>
  );
}
