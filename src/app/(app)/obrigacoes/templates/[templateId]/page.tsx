"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Celula { instanciaId: string; status: string; dataConclusao: string | null } 
interface Linha {
  empresaId: string;
  codigoInterno: string;
  razaoSocial: string;
  obrigacaoEmpresaId: string;
  celulas: Record<string, Celula | null>;
}

const NOMES_MES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function nomeCompetencia(comp: string): string {
  const [ano, mes] = comp.split("-").map(Number);
  return `${NOMES_MES[mes - 1]}/${String(ano).slice(2)}`;
}

function competenciaMaisMeses(base: string, delta: number): string {
  const [ano, mes] = base.split("-").map(Number);
  const d = new Date(ano, mes - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function competenciaAtual(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

export default function PlanilhaObrigacaoPage({ params }: { params: { templateId: string } }) {
  const router = useRouter();
  const [mesBase, setMesBase] = useState(competenciaAtual());
  const [nomeTemplate, setNomeTemplate] = useState("");
  const [competencias, setCompetencias] = useState<string[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [celulaAberta, setCelulaAberta] = useState<{ linha: Linha; competencia: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [carteiraId, setCarteiraId] = useState("");
  const [carteiraTravada, setCarteiraTravada] = useState(false);
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    fetch("/api/usuarios").then((r) => r.ok ? r.json() : []).then(setUsuarios).catch(() => {});
  }, []);

  const buscar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const params2 = new URLSearchParams({ mesBase });
    if (carteiraId) params2.set("carteiraId", carteiraId);
    const res = await fetch(`/api/obrigacoes/templates/${params.templateId}/planilha?${params2}`);
    if (res.ok) {
      const json = await res.json();
      setNomeTemplate(json.template.nome);
      setCompetencias(json.competencias);
      setLinhas(json.linhas);
      setCarteiraTravada(json.carteiraTravada);
      if (json.carteiraTravada) setCarteiraId(json.carteiraSelecionada ?? "");
    } else {
      const j = await res.json().catch(() => ({}));
      setErro(j.error ?? "Erro ao carregar planilha.");
    }
    setCarregando(false);
  }, [params.templateId, mesBase, carteiraId]);

  useEffect(() => { buscar(); }, [buscar]);

  async function salvarCelula(dataStr: string | null) {
    if (!celulaAberta) return;
    setSalvando(true);
    const res = await fetch(`/api/obrigacoes/templates/${params.templateId}/planilha`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        obrigacaoEmpresaId: celulaAberta.linha.obrigacaoEmpresaId,
        competencia: celulaAberta.competencia,
        dataConclusao: dataStr,
      }),
    });
    setSalvando(false);
    if (res.ok) {
      setCelulaAberta(null);
      buscar();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/obrigacoes" className="hover:text-gray-900">Obrigações</Link>
        <span>/</span>
        <span className="text-gray-900">{nomeTemplate || "Planilha"}</span>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg font-semibold text-gray-900">{nomeTemplate}</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setMesBase((m) => competenciaMaisMeses(m, -1))} className="btn btn-sm">← 1 mês</button>
          <button onClick={() => setMesBase(competenciaAtual())} className="btn btn-sm">Hoje</button>
          <button onClick={() => setMesBase((m) => competenciaMaisMeses(m, 1))} className="btn btn-sm">1 mês →</button>
        </div>
      </div>

      <div className="card flex items-center gap-3">
        <label className="label mb-0">Carteira</label>
        {carteiraTravada ? (
          <span className="text-sm text-gray-500">
            Mostrando só a sua carteira ({usuarios.find((u) => u.id === carteiraId)?.nome ?? "você"})
          </span>
        ) : (
          <select className="select text-sm w-64" value={carteiraId} onChange={(e) => setCarteiraId(e.target.value)}>
            <option value="">Todas as carteiras</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        )}
      </div>

      {erro ? (
        <div className="card text-center py-10 text-red-500">{erro}</div>
      ) : carregando ? (
        <div className="text-center py-10 text-gray-400">Carregando...</div>
      ) : linhas.length === 0 ? (
        <div className="card text-center py-10 text-gray-400">
          Nenhum cliente vinculado a essa obrigação ainda. Volte na tela do setor e use &quot;Gerenciar clientes&quot;.
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="sticky left-0 bg-gray-50 text-left px-4 py-2.5 font-semibold text-gray-700 border-r border-gray-200 min-w-[260px]">
                    Cliente
                  </th>
                  {competencias.map((c) => (
                    <th key={c} className="text-center px-3 py-2.5 font-semibold text-gray-700 min-w-[120px] border-l border-gray-100">
                      {nomeCompetencia(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr key={l.empresaId} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                    <td className="sticky left-0 bg-inherit px-4 py-2 border-r border-gray-200">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono font-bold text-brand-700 text-sm">{l.codigoInterno}</span>
                        <span className="text-gray-600 truncate">{l.razaoSocial}</span>
                      </div>
                    </td>
                    {competencias.map((c) => {
                      const cel = l.celulas[c];
                      const concluido = cel?.status === "CONCLUIDO";
                      return (
                        <td key={c} className="text-center px-2 py-1.5 border-l border-gray-100">
                          <button
                            onClick={() => setCelulaAberta({ linha: l, competencia: c })}
                            className={`w-full rounded-md px-2 py-1.5 text-xs font-medium transition ${
                              concluido
                                ? "bg-green-100 text-green-800 hover:bg-green-200"
                                : "bg-gray-50 text-gray-300 hover:bg-brand-50 hover:text-brand-600 border border-dashed border-gray-200"
                            }`}
                          >
                            {concluido && cel?.dataConclusao
                              ? new Date(cel.dataConclusao).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })
                              : "—"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {celulaAberta && (
        <ModalMarcarEntrega
          linha={celulaAberta.linha}
          competencia={celulaAberta.competencia}
          salvando={salvando}
          onFechar={() => setCelulaAberta(null)}
          onSalvar={salvarCelula}
        />
      )}
    </div>
  );
}

function ModalMarcarEntrega({ linha, competencia, salvando, onFechar, onSalvar }: {
  linha: Linha;
  competencia: string;
  salvando: boolean;
  onFechar: () => void;
  onSalvar: (data: string | null) => void;
}) {
  const celAtual = linha.celulas[competencia];
  const [data, setData] = useState(
    celAtual?.dataConclusao ? celAtual.dataConclusao.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onFechar}>
      <div className="card w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono font-bold text-brand-700 text-sm">{linha.codigoInterno}</span>
            <span className="text-sm text-gray-700">{linha.razaoSocial}</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Competência {nomeCompetencia(competencia)}</p>
        </div>

        <div>
          <label className="label">Data da entrega</label>
          <input className="input" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>

        <div className="flex justify-between items-center pt-1">
          {celAtual?.status === "CONCLUIDO" ? (
            <button onClick={() => onSalvar(null)} disabled={salvando} className="text-sm text-red-500 hover:underline">
              Remover marcação
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onFechar} className="btn">Cancelar</button>
            <button onClick={() => onSalvar(data)} disabled={salvando} className="btn btn-primary">
              {salvando ? "Salvando..." : "Marcar entregue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
