"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { fmtMoeda, fmtPct, fmtPctJaEmPercentual } from "@/lib/tributario/formatadores";
import { DESCRICAO_ANEXOS, type NomeAnexo } from "@/lib/tributario/anexos";
import { TIPOS_ATIVIDADE, type ChaveAtividade } from "@/lib/tributario/lucroPresumido";
import { calcularSimples, projetarSimples12Meses, type MesProjetado } from "@/lib/tributario/calculadoraSimples";
import { calcularLucroPresumido } from "@/lib/tributario/calculadoraLucroPresumido";
import { compararMultiplo } from "@/lib/tributario/comparador";
import type { Simulacao, SimulacaoLucroPresumido, ComparativoMultiplo, Regime } from "@/lib/tributario/tipos";

type SlotKey = "A" | "B" | "C";
const SLOTS: SlotKey[] = ["A", "B", "C"];

type Relatorio =
  | { tipo: "simples"; rotulo: string; sim: Simulacao }
  | { tipo: "lp"; rotulo: string; sim: SimulacaoLucroPresumido }
  | { tipo: "comparativo"; comp: ComparativoMultiplo };

export default function SimuladorTributarioPage() {
  const [regime, setRegime] = useState<"simples" | "lp" | "comparativo">("simples");
  const [resultadosSimples, setResultadosSimples] = useState<Record<SlotKey, Simulacao | null>>({ A: null, B: null, C: null });
  const [resultadosLp, setResultadosLp] = useState<Record<SlotKey, SimulacaoLucroPresumido | null>>({ A: null, B: null, C: null });
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/aplicacoes" className="hover:text-gray-900">Aplicações</Link>
        <span>/</span>
        <span className="text-gray-900">Simulador Tributário</span>
      </div>

      <div>
        <h1 className="text-lg font-semibold text-gray-900">🧮 Simulador Tributário</h1>
        <p className="text-sm text-gray-500 mt-1">
          Simples Nacional, Lucro Presumido e comparativo entre cenários — ferramenta de apoio, de caráter
          informativo. Os resultados são estimativas e não substituem o PGDAS-D nem a apuração contábil oficial.
        </p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-1">
          {[
            { key: "simples", label: "Simples Nacional" },
            { key: "lp", label: "Lucro Presumido" },
            { key: "comparativo", label: "Comparativo" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setRegime(t.key as any)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                regime === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className={regime === "simples" ? "" : "hidden"}>
        <AbaComSubTabs>
          {(slot) => (
            <SlotSimples
              key={slot}
              slot={slot}
              resultado={resultadosSimples[slot]}
              onCalculado={(sim) => setResultadosSimples((p) => ({ ...p, [slot]: sim }))}
              onVerRelatorio={(sim) => setRelatorio({ tipo: "simples", rotulo: `Simulação ${slot}`, sim })}
            />
          )}
        </AbaComSubTabs>
      </div>

      <div className={regime === "lp" ? "" : "hidden"}>
        <AbaComSubTabs>
          {(slot) => (
            <SlotLucroPresumido
              key={slot}
              slot={slot}
              resultado={resultadosLp[slot]}
              onCalculado={(sim) => setResultadosLp((p) => ({ ...p, [slot]: sim }))}
              onVerRelatorio={(sim) => setRelatorio({ tipo: "lp", rotulo: `Simulação ${slot}`, sim })}
            />
          )}
        </AbaComSubTabs>
      </div>

      <div className={regime === "comparativo" ? "" : "hidden"}>
        <AbaComparativo
          resultadosSimples={resultadosSimples}
          resultadosLp={resultadosLp}
          onVerRelatorio={(comp) => setRelatorio({ tipo: "comparativo", comp })}
        />
      </div>

      {relatorio && <RelatorioOverlay relatorio={relatorio} onFechar={() => setRelatorio(null)} />}
    </div>
  );
}

// ── Sub-abas A/B/C (3 slots independentes, sempre montados) ────────────────
function AbaComSubTabs({ children }: { children: (slot: SlotKey) => React.ReactNode }) {
  const [subAba, setSubAba] = useState<SlotKey>("A");
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {SLOTS.map((s) => (
          <button
            key={s}
            onClick={() => setSubAba(s)}
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-lg border",
              subAba === s ? "bg-brand-600 text-white border-brand-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            )}
          >
            Simulação {s}
          </button>
        ))}
      </div>
      {SLOTS.map((s) => (
        <div key={s} className={subAba === s ? "" : "hidden"}>
          {children(s)}
        </div>
      ))}
    </div>
  );
}

// ── Campo (label + input) ───────────────────────────────────────────────────
function Campo({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function BlocoDetalheGrande({ label, valor, cor }: { label: string; valor: string; cor?: string }) {
  return (
    <div className="flex-1 text-center py-2.5">
      <div className="text-[10px] tracking-wider text-gray-400 uppercase">{label}</div>
      <div className={cn("text-sm font-bold mt-0.5", cor ?? "text-gray-800")}>{valor}</div>
    </div>
  );
}

function LinhaDetalhe({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between py-1.5 text-sm", destaque && "pt-2 mt-1 border-t border-gray-200")}>
      <span className={destaque ? "font-semibold text-green-700" : "text-gray-500"}>{label}</span>
      <span className={destaque ? "font-bold text-green-700" : "font-medium text-gray-800"}>{valor}</span>
    </div>
  );
}

// ── Simulação individual: Simples Nacional ──────────────────────────────────
interface FormSimplesState {
  nomeEmpresa: string;
  cnpj: string;
  atividade: string;
  anexo: NomeAnexo;
  rbt12: string;
  receitaMes: string;
  usaFatorR: boolean;
  folha12m: string;
  proLabore: string;
  folhaParaCpp: string;
  aliquotaCppPatronal: string;
  aliquotaRat: string;
  aliquotaTerceiros: string;
  honorarioContabil: string;
  custoLegalizacao: string;
  observacoes: string;
}

const FORM_SIMPLES_VAZIO: FormSimplesState = {
  nomeEmpresa: "", cnpj: "", atividade: "", anexo: "Anexo III", rbt12: "", receitaMes: "",
  usaFatorR: false, folha12m: "", proLabore: "", folhaParaCpp: "",
  aliquotaCppPatronal: "20", aliquotaRat: "2", aliquotaTerceiros: "5,8",
  honorarioContabil: "", custoLegalizacao: "", observacoes: "",
};

const num = (v: string) => parseFloat(v.replace(",", ".")) || 0;

function SlotSimples({ slot, resultado, onCalculado, onVerRelatorio }: {
  slot: SlotKey;
  resultado: Simulacao | null;
  onCalculado: (sim: Simulacao) => void;
  onVerRelatorio: (sim: Simulacao) => void;
}) {
  const [form, setForm] = useState<FormSimplesState>(FORM_SIMPLES_VAZIO);
  const set = (k: keyof FormSimplesState, v: any) => setForm((p) => ({ ...p, [k]: v }));
  const [projecao, setProjecao] = useState<MesProjetado[] | null>(null);

  function calcular() {
    const sim = calcularSimples({
      anexo: form.anexo,
      rbt12: num(form.rbt12),
      receitaMes: num(form.receitaMes),
      folha12m: form.usaFatorR ? num(form.folha12m) : null,
      nomeEmpresa: form.nomeEmpresa,
      cnpj: form.cnpj,
      atividade: form.atividade,
      proLabore: num(form.proLabore),
      folhaParaCpp: num(form.folhaParaCpp),
      aliquotaCppPatronal: num(form.aliquotaCppPatronal) / 100,
      aliquotaRat: num(form.aliquotaRat) / 100,
      aliquotaTerceiros: num(form.aliquotaTerceiros) / 100,
      observacoes: form.observacoes,
    });
    sim.rotuloCenario = `Simples Nacional ${slot}`;
    sim.honorarioContabil = num(form.honorarioContabil);
    sim.custoLegalizacao = num(form.custoLegalizacao);
    onCalculado(sim);
    setProjecao(sim.sucesso ? projetarSimples12Meses(sim) : null);
  }

  function limpar() {
    setForm(FORM_SIMPLES_VAZIO);
    setProjecao(null);
    onCalculado(null as any);
  }

  const custoTotal = resultado?.sucesso
    ? resultado.dasEstimado + resultado.cppCompletoTotal + resultado.inssProLabore
    : 0;

  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Dados da empresa</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Campo label="Razão social / Nome" className="md:col-span-2">
            <input className="input" placeholder="Nome da empresa ou empresário" value={form.nomeEmpresa} onChange={(e) => set("nomeEmpresa", e.target.value)} />
          </Campo>
          <Campo label="CNPJ">
            <input className="input" placeholder="00.000.000/0000-00" value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} />
          </Campo>
          <Campo label="Atividade">
            <input className="input" placeholder="Atividade principal" value={form.atividade} onChange={(e) => set("atividade", e.target.value)} />
          </Campo>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Dados da simulação</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Campo label="Anexo do Simples Nacional *">
            <select className="select" value={form.anexo} onChange={(e) => set("anexo", e.target.value as NomeAnexo)}>
              {Object.entries(DESCRICAO_ANEXOS).map(([k, v]) => <option key={k} value={k}>{k} — {v}</option>)}
            </select>
          </Campo>
          <div />
          <Campo label="Receita Bruta 12 Meses (RBT12) *">
            <input className="input" type="number" step="0.01" min={0} placeholder="Ex: 350000,00" value={form.rbt12} onChange={(e) => set("rbt12", e.target.value)} />
          </Campo>
          <Campo label="Receita do Mês de Apuração *">
            <input className="input" type="number" step="0.01" min={0} placeholder="Ex: 30000,00" value={form.receitaMes} onChange={(e) => set("receitaMes", e.target.value)} />
          </Campo>
        </div>

        <label className="flex items-center gap-2 cursor-pointer mt-4">
          <input type="checkbox" className="w-4 h-4 rounded text-orange-500" checked={form.usaFatorR} onChange={(e) => set("usaFatorR", e.target.checked)} />
          <span className="text-sm text-orange-700 font-medium">Aplicar Fator R nesta simulação</span>
        </label>

        {form.usaFatorR && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 items-end">
            <Campo label="Folha de pagamento 12 meses *">
              <input className="input" type="number" step="0.01" min={0} placeholder="Ex: 90000,00" value={form.folha12m} onChange={(e) => set("folha12m", e.target.value)} />
            </Campo>
            <p className="text-[11px] text-gray-400 pb-2.5">
              Fator R = Folha 12M ÷ RBT12 — ≥ 28% vai pro Anexo III, {"<"} 28% vai pro Anexo V
            </p>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Encargos adicionais (opcional)</h3>
        <Campo label="Pró-labore mensal">
          <input className="input" type="number" step="0.01" min={0} placeholder="Gera INSS 11% sobre este valor" value={form.proLabore} onChange={(e) => set("proLabore", e.target.value)} />
        </Campo>

        {form.anexo === "Anexo IV" && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <p className="text-xs text-orange-600 mb-3">
              ⚠ O Anexo IV recolhe a Contribuição Patronal (CPP) por fora do DAS — informe a folha abaixo.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Campo label="Folha (p/ CPP)">
                <input className="input" type="number" step="0.01" min={0} value={form.folhaParaCpp} onChange={(e) => set("folhaParaCpp", e.target.value)} />
              </Campo>
              <Campo label="INSS Patronal %">
                <input className="input" type="number" step="0.01" min={0} value={form.aliquotaCppPatronal} onChange={(e) => set("aliquotaCppPatronal", e.target.value)} />
              </Campo>
              <Campo label="RAT %">
                <input className="input" type="number" step="0.01" min={0} value={form.aliquotaRat} onChange={(e) => set("aliquotaRat", e.target.value)} />
              </Campo>
              <Campo label="Terceiros %">
                <input className="input" type="number" step="0.01" min={0} value={form.aliquotaTerceiros} onChange={(e) => set("aliquotaTerceiros", e.target.value)} />
              </Campo>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Custos para apresentação ao cliente (opcional)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Campo label="Honorário contábil mensal">
            <input className="input" type="number" step="0.01" min={0} placeholder="Soma ao custo total mensal" value={form.honorarioContabil} onChange={(e) => set("honorarioContabil", e.target.value)} />
          </Campo>
          <Campo label="Custo de legalização (valor único)">
            <input className="input" type="number" step="0.01" min={0} placeholder="Não entra no custo mensal recorrente" value={form.custoLegalizacao} onChange={(e) => set("custoLegalizacao", e.target.value)} />
          </Campo>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Observações (opcional)</h3>
        <textarea className="input min-h-[70px]" placeholder="Ressalvas ou comentários que devem constar no relatório..." value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
      </div>

      <div className="flex gap-2">
        <button onClick={calcular} className="btn btn-primary flex-1">⚙ Calcular DAS</button>
        {resultado?.sucesso && (
          <button onClick={() => onVerRelatorio(resultado)} className="btn flex-1">↓ Relatório para o cliente</button>
        )}
        <button onClick={limpar} className="btn">Limpar</button>
      </div>

      {resultado && !resultado.sucesso && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{resultado.erro}</div>
      )}

      {resultado?.sucesso && (
        <>
          <div className="card !p-0 overflow-hidden bg-ink-900 text-white">
            <div className="text-center pt-4 pb-3">
              <div className="text-xs text-gray-300 uppercase tracking-wide">DAS estimado do mês</div>
              <div className="text-3xl font-bold mt-1">{fmtMoeda(resultado.dasEstimado)}</div>
            </div>
            <div className="flex divide-x divide-white/10 border-t border-white/10">
              <BlocoDetalheGrande label="Alíquota efetiva" valor={fmtPct(resultado.aliquotaEfetiva)} cor="text-white" />
              <BlocoDetalheGrande label="Anexo de tributação" valor={resultado.anexoFinal} cor="text-white" />
              <BlocoDetalheGrande label="Faixa" valor={String(resultado.faixa)} cor="text-white" />
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Custo total mensal da empresa</h3>
            <LinhaDetalhe label="DAS (Simples Nacional)" valor={fmtMoeda(resultado.dasEstimado)} />
            {resultado.cppForaDoDas && (
              <>
                <LinhaDetalhe label="CPP s/ folha (Anexo IV)" valor={resultado.folhaParaCpp > 0 ? fmtMoeda(resultado.cppPatronalTotal + resultado.ratTotal + resultado.terceirosTotal) : "Não informado"} />
                <LinhaDetalhe label="CPP patronal s/ pró-labore (Anexo IV, 20%)" valor={resultado.proLabore > 0 ? fmtMoeda(resultado.cppPatronalProLabore) : "Não aplicável"} />
              </>
            )}
            <LinhaDetalhe label="INSS sobre pró-labore (sócio, 11%)" valor={resultado.proLabore > 0 ? fmtMoeda(resultado.inssProLabore) : "Não aplicável"} />
            <LinhaDetalhe label="Custo total mensal" valor={fmtMoeda(custoTotal)} destaque />
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Detalhes do cálculo</h3>
            <LinhaDetalhe label="Alíquota nominal" valor={fmtPct(resultado.aliquotaNominal)} />
            <LinhaDetalhe label="Parcela dedutível" valor={fmtMoeda(resultado.parcelaDedutivel)} />
            {resultado.usaFatorR && (
              <>
                <LinhaDetalhe label="Fator R" valor={`${(resultado.fatorRPercentual ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%`} />
                <LinhaDetalhe label="Enquadramento pelo Fator R" valor={resultado.anexoFinal} />
              </>
            )}
          </div>

          {projecao && (
            <div className="card !p-0 overflow-hidden">
              <h3 className="text-sm font-semibold text-gray-900 px-5 pt-4 pb-2">Projeção — próximos 12 meses (faturamento constante)</h3>
              <div className="overflow-x-auto">
                <table className="table-auto-fixed">
                  <thead>
                    <tr>
                      <th>Mês</th><th>RBT12</th><th>Faixa</th><th>Alíq. nominal</th><th>Alíq. efetiva</th><th>DAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projecao.map((p, i) => (
                      <tr key={i}>
                        <td className="text-center">{p.mes}</td>
                        <td className="text-center">{fmtMoeda(p.rbt12)}</td>
                        <td className={cn("text-center", p.faixa !== resultado.faixa && "text-orange-600 font-semibold")}>{p.faixa === "—" ? "—" : `Faixa ${p.faixa}`}</td>
                        <td className="text-center">{fmtPct(p.aliquotaNominal)}</td>
                        <td className="text-center">{fmtPct(p.aliquotaEfetiva)}</td>
                        <td className="text-center">{fmtMoeda(p.das)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Comparativo multi-cenário ───────────────────────────────────────────────
interface OpcaoCenario {
  chave: string;
  rotulo: string;
  regime: Regime;
  sim: Simulacao | SimulacaoLucroPresumido | null;
}

function AbaComparativo({ resultadosSimples, resultadosLp, onVerRelatorio }: {
  resultadosSimples: Record<SlotKey, Simulacao | null>;
  resultadosLp: Record<SlotKey, SimulacaoLucroPresumido | null>;
  onVerRelatorio: (comp: ComparativoMultiplo) => void;
}) {
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [comparativo, setComparativo] = useState<ComparativoMultiplo | null>(null);

  const opcoes: OpcaoCenario[] = [
    ...SLOTS.map((s) => ({ chave: `simples-${s}`, rotulo: `Simples Nacional ${s}`, regime: "Simples Nacional" as Regime, sim: resultadosSimples[s] })),
    ...SLOTS.map((s) => ({ chave: `lp-${s}`, rotulo: `Lucro Presumido ${s}`, regime: "Lucro Presumido" as Regime, sim: resultadosLp[s] })),
  ];

  function alternar(chave: string) {
    setSelecionados((prev) => {
      if (prev.includes(chave)) return prev.filter((c) => c !== chave);
      if (prev.length >= 3) return prev;
      return [...prev, chave];
    });
  }

  function comparar() {
    const entradas = selecionados
      .map((chave) => opcoes.find((o) => o.chave === chave)!)
      .filter((o) => o.sim?.sucesso)
      .map((o) => ({ rotulo: o.rotulo, regime: o.regime, simulacao: o.sim! }));
    setComparativo(compararMultiplo(entradas));
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Calcule simulações nas sub-abas A/B/C de &quot;Simples Nacional&quot; e/ou &quot;Lucro Presumido&quot;.
        Depois, marque de 2 a 3 cenários abaixo para comparar — em qualquer combinação, inclusive comparando
        dois ou três cenários do mesmo regime.
      </p>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Cenários disponíveis (selecione de 2 a 3)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {opcoes.map((o) => {
            const calculado = o.sim?.sucesso;
            const marcado = selecionados.includes(o.chave);
            const custo = calculado
              ? o.regime === "Simples Nacional"
                ? (o.sim as Simulacao).dasEstimado + (o.sim as Simulacao).cppCompletoTotal + (o.sim as Simulacao).inssProLabore
                : (o.sim as SimulacaoLucroPresumido).custoTotalMes
              : 0;
            return (
              <label
                key={o.chave}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm",
                  !calculado && "opacity-40 cursor-not-allowed",
                  marcado ? "border-brand-400 bg-brand-50" : "border-gray-200"
                )}
              >
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded text-brand-600"
                  checked={marcado}
                  disabled={!calculado}
                  onChange={() => alternar(o.chave)}
                />
                <span className="flex-1 min-w-0">
                  <span className="font-medium text-gray-800">{o.rotulo}</span>
                  {calculado ? (
                    <span className="text-gray-500"> — {fmtMoeda(custo)}/mês</span>
                  ) : (
                    <span className="text-gray-400"> — não calculado</span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={comparar} disabled={selecionados.length < 2} className="btn btn-primary flex-1">
          ⚖ Comparar cenários selecionados
        </button>
        {comparativo?.sucesso && (
          <button onClick={() => onVerRelatorio(comparativo)} className="btn flex-1">↓ Relatório comparativo</button>
        )}
      </div>

      {comparativo && !comparativo.sucesso && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{comparativo.erro}</div>
      )}

      {comparativo?.sucesso && (
        <>
          <div className="card !p-0 overflow-hidden bg-ink-900 text-white text-center py-4">
            <div className="text-xs text-gray-300 uppercase tracking-wide">Cenário mais vantajoso</div>
            <div className="text-2xl font-bold mt-1">{comparativo.rotuloMaisVantajoso}</div>
            <div className="text-sm text-gray-300 mt-0.5">{fmtMoeda(comparativo.custoMaisVantajoso)}/mês</div>
          </div>

          {comparativo.observacoes && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">{comparativo.observacoes}</div>
          )}

          <TabelaComparativo comp={comparativo} />
        </>
      )}
    </div>
  );
}

function TabelaComparativo({ comp }: { comp: ComparativoMultiplo }) {
  const linhas: { label: string; get: (c: ComparativoMultiplo["cenarios"][number]) => string }[] = [
    { label: "Regime", get: (c) => c.regime },
    { label: "Identificação", get: (c) => c.identificacao },
    { label: "Tributos/encargos mensais", get: (c) => fmtMoeda(c.custoTributarioMes) },
    { label: "Honorário contábil", get: (c) => c.honorarioContabil > 0 ? fmtMoeda(c.honorarioContabil) : "—" },
    { label: "Custo total mensal", get: (c) => fmtMoeda(c.custoTotalApresentacao) },
    { label: "Alíquota efetiva", get: (c) => fmtPctJaEmPercentual(c.aliquotaEfetivaTotal) },
    { label: "Legalização (valor único)", get: (c) => c.custoLegalizacao > 0 ? fmtMoeda(c.custoLegalizacao) : "—" },
  ];

  return (
    <div className="card !p-0 overflow-hidden">
      <h3 className="text-sm font-semibold text-gray-900 px-5 pt-4 pb-2">Comparativo detalhado</h3>
      <div className="overflow-x-auto">
        <table className="table-auto-fixed">
          <thead>
            <tr>
              <th style={{ width: "22%" }}></th>
              {comp.cenarios.map((c) => (
                <th key={c.rotulo} className={c.rotulo === comp.rotuloMaisVantajoso ? "text-green-700" : ""}>
                  {c.rotulo}
                  {c.rotulo === comp.rotuloMaisVantajoso && " 🏆"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={linha.label}>
                <td className="text-gray-500 font-medium">{linha.label}</td>
                {comp.cenarios.map((c) => (
                  <td key={c.rotulo} className={cn("text-center", c.rotulo === comp.rotuloMaisVantajoso && "font-semibold text-green-700")}>
                    {linha.get(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Simulação individual: Lucro Presumido ───────────────────────────────────
interface FormLpState {
  nomeEmpresa: string;
  cnpj: string;
  atividade: string;
  tipoAtividade: ChaveAtividade;
  receitaMes: string;
  possuiIss: boolean;
  aliquotaIss: string;
  municipio: string;
  possuiIcms: boolean;
  aliquotaIcms: string;
  estado: string;
  possuiInssPatronal: boolean;
  folhaPagamentoMes: string;
  aliquotaInssPatronal: string;
  aliquotaRat: string;
  aliquotaTerceiros: string;
  proLabore: string;
  honorarioContabil: string;
  custoLegalizacao: string;
  observacoes: string;
}

const FORM_LP_VAZIO: FormLpState = {
  nomeEmpresa: "", cnpj: "", atividade: "", tipoAtividade: "demais", receitaMes: "",
  possuiIss: false, aliquotaIss: "", municipio: "",
  possuiIcms: false, aliquotaIcms: "", estado: "",
  possuiInssPatronal: false, folhaPagamentoMes: "", aliquotaInssPatronal: "20", aliquotaRat: "2", aliquotaTerceiros: "5,8",
  proLabore: "", honorarioContabil: "", custoLegalizacao: "", observacoes: "",
};

function SlotLucroPresumido({ slot, resultado, onCalculado, onVerRelatorio }: {
  slot: SlotKey;
  resultado: SimulacaoLucroPresumido | null;
  onCalculado: (sim: SimulacaoLucroPresumido) => void;
  onVerRelatorio: (sim: SimulacaoLucroPresumido) => void;
}) {
  const [form, setForm] = useState<FormLpState>(FORM_LP_VAZIO);
  const set = (k: keyof FormLpState, v: any) => setForm((p) => ({ ...p, [k]: v }));

  function calcular() {
    const sim = calcularLucroPresumido({
      tipoAtividade: form.tipoAtividade,
      receitaMes: num(form.receitaMes),
      nomeEmpresa: form.nomeEmpresa,
      cnpj: form.cnpj,
      atividade: form.atividade,
      possuiIss: form.possuiIss,
      aliquotaIss: num(form.aliquotaIss) / 100,
      municipio: form.municipio,
      possuiIcms: form.possuiIcms,
      aliquotaIcms: num(form.aliquotaIcms) / 100,
      estado: form.estado,
      possuiInssPatronal: form.possuiInssPatronal,
      folhaPagamentoMes: num(form.folhaPagamentoMes),
      aliquotaInssPatronal: num(form.aliquotaInssPatronal) / 100,
      aliquotaRat: num(form.aliquotaRat) / 100,
      aliquotaTerceiros: num(form.aliquotaTerceiros) / 100,
      proLabore: num(form.proLabore),
      observacoes: form.observacoes,
    });
    sim.rotuloCenario = `Lucro Presumido ${slot}`;
    sim.honorarioContabil = num(form.honorarioContabil);
    sim.custoLegalizacao = num(form.custoLegalizacao);
    onCalculado(sim);
  }

  function limpar() {
    setForm(FORM_LP_VAZIO);
    onCalculado(null as any);
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Dados da empresa</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Campo label="Razão social / Nome" className="md:col-span-2">
            <input className="input" placeholder="Nome da empresa ou empresário" value={form.nomeEmpresa} onChange={(e) => set("nomeEmpresa", e.target.value)} />
          </Campo>
          <Campo label="CNPJ">
            <input className="input" placeholder="00.000.000/0000-00" value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} />
          </Campo>
          <Campo label="Atividade">
            <input className="input" placeholder="Atividade principal" value={form.atividade} onChange={(e) => set("atividade", e.target.value)} />
          </Campo>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Classificação e receita</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Campo label="Tipo de atividade *">
            <select className="select" value={form.tipoAtividade} onChange={(e) => set("tipoAtividade", e.target.value as ChaveAtividade)}>
              {Object.entries(TIPOS_ATIVIDADE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Campo>
          <Campo label="Receita do mês *">
            <input className="input" type="number" step="0.01" min={0} placeholder="Ex: 40000,00" value={form.receitaMes} onChange={(e) => set("receitaMes", e.target.value)} />
          </Campo>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">
          Presunção IRPJ {fmtPct(TIPOS_ATIVIDADE[form.tipoAtividade].irpjPresuncao)} · Presunção CSLL {fmtPct(TIPOS_ATIVIDADE[form.tipoAtividade].csllPresuncao)}
        </p>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">ISS / ICMS</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input type="checkbox" className="w-4 h-4 rounded text-brand-600" checked={form.possuiIss} onChange={(e) => set("possuiIss", e.target.checked)} />
              <span className="text-sm text-gray-700">Possui ISS (serviços)</span>
            </label>
            {form.possuiIss && (
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Município"><input className="input" value={form.municipio} onChange={(e) => set("municipio", e.target.value)} /></Campo>
                <Campo label="Alíquota ISS %"><input className="input" type="number" step="0.01" min={0} value={form.aliquotaIss} onChange={(e) => set("aliquotaIss", e.target.value)} /></Campo>
              </div>
            )}
          </div>
          <div>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input type="checkbox" className="w-4 h-4 rounded text-brand-600" checked={form.possuiIcms} onChange={(e) => set("possuiIcms", e.target.checked)} />
              <span className="text-sm text-gray-700">Possui ICMS (comércio/indústria)</span>
            </label>
            {form.possuiIcms && (
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Estado"><input className="input" value={form.estado} onChange={(e) => set("estado", e.target.value)} /></Campo>
                <Campo label="Alíquota ICMS %"><input className="input" type="number" step="0.01" min={0} value={form.aliquotaIcms} onChange={(e) => set("aliquotaIcms", e.target.value)} /></Campo>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Folha de pagamento e pró-labore (opcional)</h3>
        <label className="flex items-center gap-2 cursor-pointer mb-3">
          <input type="checkbox" className="w-4 h-4 rounded text-brand-600" checked={form.possuiInssPatronal} onChange={(e) => set("possuiInssPatronal", e.target.checked)} />
          <span className="text-sm text-gray-700">Possui funcionários (INSS Patronal)</span>
        </label>
        {form.possuiInssPatronal && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Campo label="Folha de pagamento do mês"><input className="input" type="number" step="0.01" min={0} value={form.folhaPagamentoMes} onChange={(e) => set("folhaPagamentoMes", e.target.value)} /></Campo>
            <Campo label="INSS Patronal %"><input className="input" type="number" step="0.01" min={0} value={form.aliquotaInssPatronal} onChange={(e) => set("aliquotaInssPatronal", e.target.value)} /></Campo>
            <Campo label="RAT %"><input className="input" type="number" step="0.01" min={0} value={form.aliquotaRat} onChange={(e) => set("aliquotaRat", e.target.value)} /></Campo>
            <Campo label="Terceiros %"><input className="input" type="number" step="0.01" min={0} value={form.aliquotaTerceiros} onChange={(e) => set("aliquotaTerceiros", e.target.value)} /></Campo>
          </div>
        )}
        <Campo label="Pró-labore mensal">
          <input className="input" type="number" step="0.01" min={0} placeholder="Gera INSS 11% (sócio) + CPP 20% (empresa)" value={form.proLabore} onChange={(e) => set("proLabore", e.target.value)} />
        </Campo>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Custos para apresentação ao cliente (opcional)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Campo label="Honorário contábil mensal">
            <input className="input" type="number" step="0.01" min={0} value={form.honorarioContabil} onChange={(e) => set("honorarioContabil", e.target.value)} />
          </Campo>
          <Campo label="Custo de legalização (valor único)">
            <input className="input" type="number" step="0.01" min={0} value={form.custoLegalizacao} onChange={(e) => set("custoLegalizacao", e.target.value)} />
          </Campo>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Observações (opcional)</h3>
        <textarea className="input min-h-[70px]" value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
      </div>

      <div className="flex gap-2">
        <button onClick={calcular} className="btn btn-primary flex-1">⚙ Calcular tributos</button>
        {resultado?.sucesso && (
          <button onClick={() => onVerRelatorio(resultado)} className="btn flex-1">↓ Relatório para o cliente</button>
        )}
        <button onClick={limpar} className="btn">Limpar</button>
      </div>

      {resultado && !resultado.sucesso && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{resultado.erro}</div>
      )}

      {resultado?.sucesso && (
        <>
          <div className="card !p-0 overflow-hidden bg-ink-900 text-white">
            <div className="text-center pt-4 pb-3">
              <div className="text-xs text-gray-300 uppercase tracking-wide">Custo total mensal (tributos + encargos)</div>
              <div className="text-3xl font-bold mt-1">{fmtMoeda(resultado.custoTotalMes)}</div>
            </div>
            <div className="flex divide-x divide-white/10 border-t border-white/10">
              <BlocoDetalheGrande label="Carga efetiva" valor={fmtPctJaEmPercentual(resultado.cargaEfetivaPercentual)} cor="text-white" />
              <BlocoDetalheGrande label="Tipo de atividade" valor={resultado.labelAtividade} cor="text-white" />
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Detalhamento dos tributos</h3>
            <LinhaDetalhe label="IRPJ (normal + adicional)" valor={fmtMoeda(resultado.irpjTotal)} />
            <LinhaDetalhe label="CSLL" valor={fmtMoeda(resultado.csllTotal)} />
            <LinhaDetalhe label="PIS (0,65%)" valor={fmtMoeda(resultado.pisTotal)} />
            <LinhaDetalhe label="COFINS (3,00%)" valor={fmtMoeda(resultado.cofinsTotal)} />
            {resultado.possuiIss && <LinhaDetalhe label="ISS" valor={fmtMoeda(resultado.issTotal)} />}
            {resultado.possuiIcms && <LinhaDetalhe label="ICMS" valor={fmtMoeda(resultado.icmsTotal)} />}
            {resultado.possuiInssPatronal && <LinhaDetalhe label="INSS Patronal + RAT + Terceiros" valor={fmtMoeda(resultado.inssPatronalCompleto)} />}
            {resultado.proLabore > 0 && (
              <>
                <LinhaDetalhe label="INSS pró-labore (sócio, 11%)" valor={fmtMoeda(resultado.inssProLabore)} />
                <LinhaDetalhe label="CPP patronal s/ pró-labore (20%)" valor={fmtMoeda(resultado.cppPatronalProLabore)} />
              </>
            )}
            <LinhaDetalhe label="Custo total mensal" valor={fmtMoeda(resultado.custoTotalMes)} destaque />
          </div>
        </>
      )}
    </div>
  );
}

// ── Relatório para impressão / salvar como PDF ──────────────────────────────
// A ideia: uma tela formatada (id="relatorio-impressao"), com um botão que
// chama window.print() — o CSS de impressão em globals.css esconde o resto
// da página (menu, filtros etc.) e mostra só esse container. O navegador
// oferece "Salvar como PDF" no próprio diálogo de impressão.
function RelatorioOverlay({ relatorio, onFechar }: { relatorio: Relatorio; onFechar: () => void }) {
  return (
    <div className="relatorio-overlay fixed inset-0 bg-black/40 z-50 overflow-y-auto py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-3">
        <div className="flex justify-end gap-2 print:hidden">
          <button onClick={() => window.print()} className="btn btn-primary">🖨 Imprimir / Salvar PDF</button>
          <button onClick={onFechar} className="btn bg-white">Fechar</button>
        </div>

        <div id="relatorio-impressao" className="bg-white rounded-xl p-8 space-y-5">
          <CabecalhoRelatorio />
          {relatorio.tipo === "simples" && <CorpoRelatorioSimples rotulo={relatorio.rotulo} sim={relatorio.sim} />}
          {relatorio.tipo === "lp" && <CorpoRelatorioLp rotulo={relatorio.rotulo} sim={relatorio.sim} />}
          {relatorio.tipo === "comparativo" && <CorpoRelatorioComparativo comp={relatorio.comp} />}
          <RodapeAvisoLegal />
        </div>
      </div>
    </div>
  );
}

function CabecalhoRelatorio() {
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "UTC" });
  return (
    <div className="flex items-center justify-between border-b-2 border-ink-900 pb-4">
      <div className="flex items-center gap-3">
        <img src="/logo.jpg" alt="" className="w-10 h-10 rounded-lg object-cover" />
        <div>
          <div className="text-base font-bold text-gray-900">Grupo Real Domínio</div>
          <div className="text-xs text-gray-500">Simulação Tributária</div>
        </div>
      </div>
      <div className="text-xs text-gray-400">Gerado em {hoje}</div>
    </div>
  );
}

function LinhaRelatorio({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between py-1.5 text-sm border-b border-gray-100", destaque && "border-t-2 border-gray-800 border-b-0 pt-2.5 mt-1")}>
      <span className={destaque ? "font-bold text-gray-900" : "text-gray-600"}>{label}</span>
      <span className={destaque ? "font-bold text-gray-900 text-base" : "font-medium text-gray-800"}>{valor}</span>
    </div>
  );
}

function DadosEmpresaRelatorio({ nome, cnpj, atividade }: { nome: string; cnpj: string; atividade: string }) {
  if (!nome && !cnpj && !atividade) return null;
  return (
    <div className="text-sm text-gray-600 space-y-0.5">
      {nome && <div><span className="font-semibold text-gray-800">{nome}</span></div>}
      <div className="flex gap-4 text-xs">
        {cnpj && <span>CNPJ: {cnpj}</span>}
        {atividade && <span>{atividade}</span>}
      </div>
    </div>
  );
}

function CorpoRelatorioSimples({ rotulo, sim }: { rotulo: string; sim: Simulacao }) {
  const custoTotal = sim.dasEstimado + sim.cppCompletoTotal + sim.inssProLabore;
  const custoApresentacao = custoTotal + sim.honorarioContabil;
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs uppercase tracking-wide text-gray-400">{rotulo} — Simples Nacional</div>
        <DadosEmpresaRelatorio nome={sim.nomeEmpresa} cnpj={sim.cnpj} atividade={sim.atividade} />
      </div>

      <div className="bg-gray-50 rounded-lg p-4 text-center">
        <div className="text-xs uppercase tracking-wide text-gray-400">DAS estimado do mês</div>
        <div className="text-2xl font-bold text-gray-900 mt-1">{fmtMoeda(sim.dasEstimado)}</div>
        <div className="text-xs text-gray-500 mt-1">{sim.anexoFinal} · Faixa {sim.faixa} · Alíquota efetiva {fmtPct(sim.aliquotaEfetiva)}</div>
      </div>

      <div>
        <LinhaRelatorio label="DAS (Simples Nacional)" valor={fmtMoeda(sim.dasEstimado)} />
        {sim.cppForaDoDas && (
          <>
            <LinhaRelatorio label="CPP s/ folha (Anexo IV)" valor={fmtMoeda(sim.cppPatronalTotal + sim.ratTotal + sim.terceirosTotal)} />
            <LinhaRelatorio label="CPP patronal s/ pró-labore (20%)" valor={fmtMoeda(sim.cppPatronalProLabore)} />
          </>
        )}
        {sim.proLabore > 0 && <LinhaRelatorio label="INSS sobre pró-labore (sócio, 11%)" valor={fmtMoeda(sim.inssProLabore)} />}
        {sim.honorarioContabil > 0 && <LinhaRelatorio label="Honorário contábil mensal" valor={fmtMoeda(sim.honorarioContabil)} />}
        <LinhaRelatorio label="Custo total mensal" valor={fmtMoeda(custoApresentacao)} destaque />
        {sim.custoLegalizacao > 0 && <LinhaRelatorio label="Custo de legalização (valor único)" valor={fmtMoeda(sim.custoLegalizacao)} />}
      </div>

      {sim.observacoes && (
        <div className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800">{sim.observacoes}</div>
      )}
    </div>
  );
}

function CorpoRelatorioLp({ rotulo, sim }: { rotulo: string; sim: SimulacaoLucroPresumido }) {
  const custoApresentacao = sim.custoTotalMes + sim.honorarioContabil;
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs uppercase tracking-wide text-gray-400">{rotulo} — Lucro Presumido</div>
        <DadosEmpresaRelatorio nome={sim.nomeEmpresa} cnpj={sim.cnpj} atividade={sim.atividade} />
      </div>

      <div className="bg-gray-50 rounded-lg p-4 text-center">
        <div className="text-xs uppercase tracking-wide text-gray-400">Custo total mensal (tributos + encargos)</div>
        <div className="text-2xl font-bold text-gray-900 mt-1">{fmtMoeda(sim.custoTotalMes)}</div>
        <div className="text-xs text-gray-500 mt-1">{sim.labelAtividade} · Carga efetiva {fmtPctJaEmPercentual(sim.cargaEfetivaPercentual)}</div>
      </div>

      <div>
        <LinhaRelatorio label="IRPJ (normal + adicional)" valor={fmtMoeda(sim.irpjTotal)} />
        <LinhaRelatorio label="CSLL" valor={fmtMoeda(sim.csllTotal)} />
        <LinhaRelatorio label="PIS (0,65%)" valor={fmtMoeda(sim.pisTotal)} />
        <LinhaRelatorio label="COFINS (3,00%)" valor={fmtMoeda(sim.cofinsTotal)} />
        {sim.possuiIss && <LinhaRelatorio label="ISS" valor={fmtMoeda(sim.issTotal)} />}
        {sim.possuiIcms && <LinhaRelatorio label="ICMS" valor={fmtMoeda(sim.icmsTotal)} />}
        {sim.possuiInssPatronal && <LinhaRelatorio label="INSS Patronal + RAT + Terceiros" valor={fmtMoeda(sim.inssPatronalCompleto)} />}
        {sim.proLabore > 0 && (
          <>
            <LinhaRelatorio label="INSS pró-labore (sócio, 11%)" valor={fmtMoeda(sim.inssProLabore)} />
            <LinhaRelatorio label="CPP patronal s/ pró-labore (20%)" valor={fmtMoeda(sim.cppPatronalProLabore)} />
          </>
        )}
        {sim.honorarioContabil > 0 && <LinhaRelatorio label="Honorário contábil mensal" valor={fmtMoeda(sim.honorarioContabil)} />}
        <LinhaRelatorio label="Custo total mensal" valor={fmtMoeda(custoApresentacao)} destaque />
        {sim.custoLegalizacao > 0 && <LinhaRelatorio label="Custo de legalização (valor único)" valor={fmtMoeda(sim.custoLegalizacao)} />}
      </div>

      {sim.observacoes && (
        <div className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800">{sim.observacoes}</div>
      )}
    </div>
  );
}

function CorpoRelatorioComparativo({ comp }: { comp: ComparativoMultiplo }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs uppercase tracking-wide text-gray-400">Comparativo entre cenários</div>
        <DadosEmpresaRelatorio nome={comp.nomeEmpresa} cnpj={comp.cnpj} atividade={comp.atividade} />
      </div>

      <div className="bg-gray-50 rounded-lg p-4 text-center">
        <div className="text-xs uppercase tracking-wide text-gray-400">Cenário mais vantajoso</div>
        <div className="text-2xl font-bold text-gray-900 mt-1">{comp.rotuloMaisVantajoso}</div>
        <div className="text-sm text-gray-500 mt-1">{fmtMoeda(comp.custoMaisVantajoso)}/mês</div>
      </div>

      {comp.observacoes && (
        <div className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800">{comp.observacoes}</div>
      )}

      <TabelaComparativo comp={comp} />
    </div>
  );
}

function RodapeAvisoLegal() {
  return (
    <div className="text-[11px] text-gray-400 border-t border-gray-200 pt-3 leading-relaxed print:break-inside-avoid">
      Este material é uma simulação tributária de caráter informativo, elaborada pelo Grupo Real Domínio. Os
      resultados são estimativas e não substituem o PGDAS-D da Receita Federal nem a apuração contábil oficial
      do Lucro Presumido. Consulte sempre um contador habilitado antes de decidir sobre o regime tributário.
    </div>
  );
}
