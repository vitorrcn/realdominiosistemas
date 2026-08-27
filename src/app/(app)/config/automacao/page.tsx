"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const DIAS_SEMANA = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

export default function ConfigAutomacaoPage() {
  const [form, setForm] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  useEffect(() => {
    fetch("/api/config/automacao")
      .then((r) => r.json())
      .then(setForm)
      .finally(() => setCarregando(false));
  }, []);

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setMsg(null);
    const res = await fetch("/api/config/automacao", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSalvando(false);
    if (res.ok) {
      setMsg({ tipo: "ok", texto: "Salvo com sucesso!" });
    } else {
      const json = await res.json().catch(() => ({}));
      setMsg({ tipo: "erro", texto: json.error ?? "Erro ao salvar." });
    }
  }

  if (carregando || !form) return <div className="text-center py-12 text-gray-400">Carregando...</div>;

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/config" className="hover:text-gray-900">Configurações</Link>
        <span>/</span>
        <span className="text-gray-900">Automações e alertas</span>
      </div>

      <div>
        <h1 className="text-lg font-semibold text-gray-900">Automações e alertas por e-mail</h1>
        <p className="text-sm text-gray-500 mt-1">
          Controla os e-mails automáticos disparados todo dia pelo sistema — obrigações pendentes,
          carteira sem responsável e relatórios semanais de horas. Use o botão abaixo pra desligar tudo
          de uma vez (útil enquanto você estiver mexendo no sistema).
        </p>
      </div>

      <form onSubmit={salvar} className="space-y-4">
        <div className={`card flex items-center justify-between gap-4 border-2 ${form.pausadoGeral ? "border-amber-300 bg-amber-50" : "border-green-200 bg-green-50"}`}>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              {form.pausadoGeral ? "🔕 E-mails automáticos DESLIGADOS" : "🔔 E-mails automáticos LIGADOS"}
            </h3>
            <p className="text-xs text-gray-600 mt-0.5">
              {form.pausadoGeral
                ? "Nenhum e-mail automático vai sair (obrigações, carteira sem responsável, relatórios de horas), mesmo com os itens abaixo marcados. Útil enquanto você mexe no sistema."
                : "Os e-mails automáticos abaixo saem normalmente, conforme cada um estiver configurado."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!form.pausadoGeral}
            onClick={() => set("pausadoGeral", !form.pausadoGeral)}
            className={`relative flex-shrink-0 w-14 h-8 rounded-full transition-colors ${form.pausadoGeral ? "bg-gray-300" : "bg-green-500"}`}
          >
            <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${form.pausadoGeral ? "" : "translate-x-6"}`} />
          </button>
        </div>

        <div className={`card space-y-4 ${form.pausadoGeral ? "opacity-50 pointer-events-none" : ""}`}>
          <h3 className="text-sm font-semibold text-gray-900">Obrigações pendentes</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded text-brand-600"
              checked={form.alertaObrigacoesAtivo} onChange={(e) => set("alertaObrigacoesAtivo", e.target.checked)} />
            <span className="text-sm text-gray-700">
              Enviar e-mail diário com a listagem de todas as empresas pendentes, pra todo mundo do setor
            </span>
          </label>
          <div>
            <label className="label">Dias de antecedência antes do vencimento</label>
            <input className="input max-w-[140px]" type="number" min={0} max={90}
              value={form.diasAntecedenciaVencimento}
              onChange={(e) => set("diasAntecedenciaVencimento", Number(e.target.value))} />
            <p className="text-xs text-gray-400 mt-1">
              Obrigações que vencem dentro desse número de dias (e todas as que já estão em atraso) entram
              na listagem enviada pra todo mundo do setor.
            </p>
          </div>
        </div>

        <div className={`card space-y-3 ${form.pausadoGeral ? "opacity-50 pointer-events-none" : ""}`}>
          <h3 className="text-sm font-semibold text-gray-900">Carteira sem responsável</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded text-brand-600"
              checked={form.alertaCarteiraSemRespAtivo} onChange={(e) => set("alertaCarteiraSemRespAtivo", e.target.checked)} />
            <span className="text-sm text-gray-700">
              Avisar os supervisores de cada setor quando existir empresa ativa sem ninguém atribuído
              naquele setor
            </span>
          </label>
        </div>

        <div className={`card space-y-4 ${form.pausadoGeral ? "opacity-50 pointer-events-none" : ""}`}>
          <h3 className="text-sm font-semibold text-gray-900">Relatórios semanais de horas</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded text-brand-600"
              checked={form.relatorioIndividualAtivo} onChange={(e) => set("relatorioIndividualAtivo", e.target.checked)} />
            <span className="text-sm text-gray-700">Relatório individual (pra cada operador, com suas próprias horas)</span>
          </label>
          {form.relatorioIndividualAtivo && (
            <div>
              <label className="label">Dia do envio</label>
              <select className="select max-w-[200px]" value={form.relatorioIndividualDiaSemana}
                onChange={(e) => set("relatorioIndividualDiaSemana", Number(e.target.value))}>
                {DIAS_SEMANA.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded text-brand-600"
              checked={form.relatorioComparativoAtivo} onChange={(e) => set("relatorioComparativoAtivo", e.target.checked)} />
            <span className="text-sm text-gray-700">Relatório comparativo (pra Diretoria e supervisores de cada setor)</span>
          </label>
          {form.relatorioComparativoAtivo && (
            <div>
              <label className="label">Dia do envio</label>
              <select className="select max-w-[200px]" value={form.relatorioComparativoDiaSemana}
                onChange={(e) => set("relatorioComparativoDiaSemana", Number(e.target.value))}>
                {DIAS_SEMANA.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="card space-y-2">
          <h3 className="text-sm font-semibold text-gray-900">Cópia fixa em todos os e-mails</h3>
          <label className="label">E-mails (separados por vírgula)</label>
          <textarea className="input min-h-[70px]" placeholder="alessandro@realdominio.com.br, heid@realdominio.com.br"
            value={form.copiaEmailsFixos ?? ""} onChange={(e) => set("copiaEmailsFixos", e.target.value)} />
          <p className="text-xs text-gray-400">
            Todo e-mail automático do sistema vai em cópia (CC) pra esses endereços. Deixe em branco pra
            não copiar ninguém.
          </p>
        </div>

        {msg && (
          <div className={`flex items-center gap-2 p-3 rounded-lg border ${msg.tipo === "ok" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
            <span className={`text-sm ${msg.tipo === "ok" ? "text-green-700" : "text-red-700"}`}>{msg.texto}</span>
          </div>
        )}

        <div className="flex justify-end">
          <button type="submit" disabled={salvando} className="btn btn-primary">
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
