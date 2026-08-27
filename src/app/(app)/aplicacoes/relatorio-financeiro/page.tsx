"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { fmtMoeda, fmtPct, fmtPctJaEmPercentual } from "@/lib/tributario/formatadores";
import type { IcfEntradaDados, ModoGeracao, ModoVisao, RelatorioFinanceiroSaida } from "@/lib/relatorio-financeiro/tipos";

// Paleta do relatório em PDF original (relatorio_financeiro.py), mantida
// aqui pra o relatório impresso continuar com a cara que o cliente já
// conhece — em vez do visual "app" do resto do sistema.
const COR = {
  az1: "#1B2A4A", // navy escuro — cabeçalho
  az2: "#2C4A7C", // navy médio — títulos de seção
  az3: "#4A90D9", // azul claro — detalhes
  vrd: "#27AE60", // verde — valores positivos
  vrm: "#E74C3C", // vermelho — valores negativos
  czc: "#F5F7FA", // cinza claro — fundo de tabela
  czm: "#BDC3C7", // cinza médio — bordas
  lar: "#E67E22", // laranja — Societário/Investimentos
  rxa: "#8E44AD", // roxo — Transferências
};

const CAMPOS_ICF: { key: keyof IcfEntradaDados; label: string }[] = [
  { key: "faturamento", label: "Faturamento" },
  { key: "compras", label: "Compras" },
  { key: "servicos", label: "Serviços Tomados" },
  { key: "impostos", label: "Impostos" },
  { key: "folha", label: "Folha de Pagamento" },
  { key: "retiradas", label: "Retiradas de Sócios" },
  { key: "amortizacao", label: "Amortização de Empréstimos" },
  { key: "ativos", label: "Aquisição de Ativos" },
  { key: "saldoInicial", label: "Saldo Bancário Inicial" },
  { key: "saldoFinal", label: "Saldo Bancário Final" },
];

const ICF_VAZIO: IcfEntradaDados = {
  faturamento: "", compras: "", servicos: "", impostos: "", folha: "",
  retiradas: "", amortizacao: "", ativos: "", saldoInicial: "", saldoFinal: "",
};

const OPCOES_MODO_GERACAO: { valor: ModoGeracao; titulo: string; desc: string }[] = [
  { valor: "completo", titulo: "Completo, sem indicador", desc: "Resumo, tabelas por categoria e resultado consolidado — como já era." },
  { valor: "resumo", titulo: "Apenas o resumo", desc: "Só o Resumo Executivo, com base na planilha importada." },
  { valor: "indicador", titulo: "Apenas o indicador (ICF)", desc: "Só o cálculo do ICF — nem precisa da planilha." },
  { valor: "resumo_indicador", titulo: "Resumo + indicador", desc: "Resumo Executivo e o ICF, sem as tabelas por categoria." },
  { valor: "tudo", titulo: "Tudo", desc: "Completo + o Indicador de Compatibilidade Financeira." },
];

export default function RelatorioFinanceiroPage() {
  const [modoGeracao, setModoGeracao] = useState<ModoGeracao>("completo");
  const precisaExcel = modoGeracao !== "indicador";
  const mostrarTabelas = modoGeracao === "completo" || modoGeracao === "tudo";
  const mostrarIcf = modoGeracao === "indicador" || modoGeracao === "resumo_indicador" || modoGeracao === "tudo";

  function mudarModoGeracao(m: ModoGeracao) {
    setModoGeracao(m);
    if (m !== "completo" && m !== "tudo") setComparativoAtivo(false);
  }

  // Arquivo principal
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [mesesDisp, setMesesDisp] = useState<string[]>([]);
  const [mesIni, setMesIni] = useState("");
  const [mesFim, setMesFim] = useState("");
  const [carregandoMeses, setCarregandoMeses] = useState(false);

  const [modo, setModo] = useState<ModoVisao>("mensal");
  const [empresa, setEmpresa] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [textoIntro, setTextoIntro] = useState("");
  const [textoConclusao, setTextoConclusao] = useState("");

  // Comparativo
  const [comparativoAtivo, setComparativoAtivo] = useState(false);
  const [arquivoComp, setArquivoComp] = useState<File | null>(null);
  const [mesesDispComp, setMesesDispComp] = useState<string[]>([]);
  const [compEmpresa, setCompEmpresa] = useState("");
  const [compMesIni, setCompMesIni] = useState("");
  const [compMesFim, setCompMesFim] = useState("");
  const [carregandoMesesComp, setCarregandoMesesComp] = useState(false);

  // ICF
  const [icf, setIcf] = useState<IcfEntradaDados>(ICF_VAZIO);

  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [relatorio, setRelatorio] = useState<RelatorioFinanceiroSaida | null>(null);

  async function detectarMeses(file: File): Promise<string[]> {
    const fd = new FormData();
    fd.append("excel", file);
    const resp = await fetch("/api/relatorio-financeiro/meses", { method: "POST", body: fd });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.error || "Não foi possível ler os meses do arquivo.");
    return data.meses as string[];
  }

  async function onArquivoPrincipal(file: File | null) {
    setArquivo(file);
    setMesesDisp([]);
    setMesIni("");
    setMesFim("");
    if (!file) return;
    setCarregandoMeses(true);
    setErro(null);
    try {
      const meses = await detectarMeses(file);
      setMesesDisp(meses);
      if (meses.length) {
        setMesIni(meses[0]);
        setMesFim(meses[meses.length - 1]);
      }
    } catch (e: any) {
      setErro(e?.message || "Não foi possível ler os meses do arquivo.");
    } finally {
      setCarregandoMeses(false);
    }
  }

  async function onArquivoComparativo(file: File | null) {
    setArquivoComp(file);
    setMesesDispComp([]);
    if (!file) return;
    setCarregandoMesesComp(true);
    setErro(null);
    try {
      const meses = await detectarMeses(file);
      setMesesDispComp(meses);
      if (meses.length) {
        setCompMesIni(meses.includes(mesIni) ? mesIni : meses[0]);
        setCompMesFim(meses.includes(mesFim) ? mesFim : meses[meses.length - 1]);
      }
    } catch (e: any) {
      setErro(e?.message || "Não foi possível ler os meses do arquivo comparativo.");
    } finally {
      setCarregandoMesesComp(false);
    }
  }

  async function gerar() {
    setErro(null);
    if (precisaExcel && !arquivo) return setErro("Selecione o arquivo Excel principal (Banco de Dados).");
    if (!empresa.trim()) return setErro("Informe o nome da empresa.");
    if (!mesIni || !mesFim) return setErro("Informe o período do relatório.");
    if (comparativoAtivo && !arquivoComp) return setErro("Selecione o arquivo Excel da empresa comparativa.");
    if (mostrarIcf && !icf.faturamento.trim()) return setErro("Preencha ao menos o faturamento do indicador (ICF).");

    setGerando(true);
    try {
      const fd = new FormData();
      if (arquivo) fd.append("excel", arquivo);
      if (comparativoAtivo && arquivoComp) fd.append("excelComparativo", arquivoComp);
      fd.append(
        "config",
        JSON.stringify({
          empresa, cnpj, responsavel, textoIntro, textoConclusao, mesIni, mesFim, modo, modoGeracao,
          compEmpresa: comparativoAtivo ? compEmpresa : undefined,
          compMesIni: comparativoAtivo ? compMesIni || mesIni : undefined,
          compMesFim: comparativoAtivo ? compMesFim || mesFim : undefined,
          icf: mostrarIcf ? icf : undefined,
        })
      );
      const resp = await fetch("/api/relatorio-financeiro/gerar", { method: "POST", body: fd });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Erro ao gerar o relatório.");
      setRelatorio(data as RelatorioFinanceiroSaida);
    } catch (e: any) {
      setErro(e?.message || "Erro ao gerar o relatório.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/aplicacoes" className="hover:text-gray-900">Aplicações</Link>
        <span>/</span>
        <span className="text-gray-900">Relatório Financeiro</span>
      </div>

      <div>
        <h1 className="text-lg font-semibold text-gray-900">📊 Relatório Financeiro</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gera o relatório financeiro em PDF a partir da planilha &quot;Banco de Dados&quot; (aba Relatório) — com resumo
          executivo, tabelas por categoria, comparativo entre empresas e o Indicador de Compatibilidade
          Financeira (ICF).
        </p>
      </div>

      <div className="card space-y-5">
        <div>
          <label className="label">Tipo de relatório</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
            {OPCOES_MODO_GERACAO.map((o) => (
              <button
                key={o.valor}
                type="button"
                onClick={() => mudarModoGeracao(o.valor)}
                className={cn(
                  "text-left px-3 py-2.5 rounded-lg border transition-colors",
                  modoGeracao === o.valor ? "bg-brand-50 border-brand-400" : "bg-white border-gray-200 hover:bg-gray-50"
                )}
              >
                <div className={cn("text-sm font-semibold", modoGeracao === o.valor ? "text-brand-700" : "text-gray-800")}>{o.titulo}</div>
                <div className="text-xs text-gray-500 mt-0.5">{o.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">
            Planilha &quot;Banco de Dados&quot; (.xlsx){!precisaExcel && " (opcional nesse tipo de relatório)"}
          </label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => onArquivoPrincipal(e.target.files?.[0] || null)}
            className="input"
          />
          {carregandoMeses && <p className="text-xs text-gray-400 mt-1">Lendo meses disponíveis…</p>}
          {!carregandoMeses && mesesDisp.length > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              {mesesDisp.length} meses disponíveis: {mesesDisp[0]} a {mesesDisp[mesesDisp.length - 1]}
            </p>
          )}
        </div>

        <div className={cn("grid grid-cols-1 gap-3", mostrarTabelas ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
          <div>
            <label className="label">Período — de</label>
            <SeletorMes valor={mesIni} onMudar={setMesIni} opcoes={mesesDisp} />
          </div>
          <div>
            <label className="label">Período — até</label>
            <SeletorMes valor={mesFim} onMudar={setMesFim} opcoes={mesesDisp} />
          </div>
          {mostrarTabelas && (
            <div>
              <label className="label">Visão</label>
              <div className="flex gap-1.5 pt-1">
                {(["mensal", "trimestral", "anual"] as ModoVisao[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModo(m)}
                    className={cn(
                      "flex-1 px-2 py-2 text-xs font-medium rounded-lg border capitalize",
                      modo === m ? "bg-brand-600 text-white border-brand-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="label">Empresa</label>
            <input className="input" value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Razão social" />
          </div>
          <div>
            <label className="label">CNPJ</label>
            <input className="input" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
          </div>
        </div>

        <div>
          <label className="label">Responsável</label>
          <input className="input" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Nome de quem está elaborando o relatório" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Texto de introdução (opcional)</label>
            <textarea className="input min-h-[80px]" value={textoIntro} onChange={(e) => setTextoIntro(e.target.value)} placeholder="Complementa o texto padrão do relatório" />
          </div>
          <div>
            <label className="label">Texto de conclusão (opcional)</label>
            <textarea className="input min-h-[80px]" value={textoConclusao} onChange={(e) => setTextoConclusao(e.target.value)} placeholder="Considerações finais" />
          </div>
        </div>

        {/* Comparativo — só faz sentido nos tipos com tabelas por categoria */}
        {mostrarTabelas && (
          <div className="border-t border-gray-100 pt-4">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
              <input type="checkbox" checked={comparativoAtivo} onChange={(e) => setComparativoAtivo(e.target.checked)} className="rounded" />
              Comparar com outra empresa
            </label>
            {comparativoAtivo && (
              <div className="mt-3 space-y-3 pl-1">
                <div>
                  <label className="label">Planilha &quot;Banco de Dados&quot; da empresa comparativa (.xlsx)</label>
                  <input type="file" accept=".xlsx,.xls" onChange={(e) => onArquivoComparativo(e.target.files?.[0] || null)} className="input" />
                  {carregandoMesesComp && <p className="text-xs text-gray-400 mt-1">Lendo meses disponíveis…</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label">Nome da empresa comparativa</label>
                    <input className="input" value={compEmpresa} onChange={(e) => setCompEmpresa(e.target.value)} placeholder="Razão social" />
                  </div>
                  <div>
                    <label className="label">Período comparativo — de</label>
                    <SeletorMes valor={compMesIni} onMudar={setCompMesIni} opcoes={mesesDispComp} />
                  </div>
                  <div>
                    <label className="label">Período comparativo — até</label>
                    <SeletorMes valor={compMesFim} onMudar={setCompMesFim} opcoes={mesesDispComp} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ICF — aparece automaticamente quando o tipo de relatório escolhido inclui o indicador */}
        {mostrarIcf && (
          <div className="border-t border-gray-100 pt-4">
            <div className="text-sm font-medium text-gray-700">Indicador de Compatibilidade Financeira (ICF)</div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-3">
              {CAMPOS_ICF.map((c) => (
                <div key={c.key}>
                  <label className="label">{c.label}</label>
                  <input
                    className="input"
                    value={icf[c.key]}
                    onChange={(e) => setIcf((p) => ({ ...p, [c.key]: e.target.value }))}
                    placeholder="0,00"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {erro && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</div>}

        <div className="flex justify-end">
          <button onClick={gerar} disabled={gerando} className="btn btn-primary">
            {gerando ? "Gerando…" : "Gerar Relatório"}
          </button>
        </div>
      </div>

      {relatorio && <RelatorioOverlay relatorio={relatorio} onFechar={() => setRelatorio(null)} />}
    </div>
  );
}

function SeletorMes({ valor, onMudar, opcoes }: { valor: string; onMudar: (v: string) => void; opcoes: string[] }) {
  if (opcoes.length === 0) {
    return <input className="input" value={valor} onChange={(e) => onMudar(e.target.value)} placeholder="MM/AAAA" />;
  }
  return (
    <select className="select" value={valor} onChange={(e) => onMudar(e.target.value)}>
      {opcoes.map((m) => (
        <option key={m} value={m}>{m}</option>
      ))}
    </select>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Relatório imprimível
// ─────────────────────────────────────────────────────────────────────────

function RelatorioOverlay({ relatorio, onFechar }: { relatorio: RelatorioFinanceiroSaida; onFechar: () => void }) {
  // Com muitas colunas (12 meses + total + % vendas) o relatório fica
  // largo demais pra retrato — força paisagem só enquanto essa tela de
  // impressão está aberta, sem mexer na orientação de outros relatórios.
  const paisagem = relatorio.colLabels.length > 3;
  return (
    <div className="fixed inset-0 bg-black/40 z-50 overflow-y-auto py-8 px-4">
      {paisagem && <style>{"@media print { @page { size: landscape; margin: 10mm; } }"}</style>}
      <div className="max-w-4xl mx-auto space-y-3">
        <div className="flex justify-end gap-2 print:hidden">
          <button onClick={() => window.print()} className="btn btn-primary">🖨 Imprimir / Salvar PDF</button>
          <button onClick={onFechar} className="btn bg-white">Fechar</button>
        </div>
        <div id="relatorio-impressao" className="bg-white rounded-xl overflow-hidden">
          <CabecalhoRelatorio relatorio={relatorio} />
          <div className="p-8 space-y-6">
            <BoxIntroducao relatorio={relatorio} />
            {relatorio.resumo && <ResumoExecutivoView resumo={relatorio.resumo} />}
            {relatorio.vendas && <BlocoView titulo="Vendas" cor={COR.az2} bloco={relatorio.vendas} relatorio={relatorio} />}
            {relatorio.custos && <BlocoView titulo="Custos" cor={COR.az2} bloco={relatorio.custos} relatorio={relatorio} />}
            {relatorio.despesas && <BlocoView titulo="Despesas Operacionais" cor={COR.az2} bloco={relatorio.despesas} relatorio={relatorio} />}
            {relatorio.societarioInvestimentos && (
              <BlocoView titulo="Societário e Investimentos" cor={COR.lar} bloco={relatorio.societarioInvestimentos} relatorio={relatorio} />
            )}
            {relatorio.transferencias && (
              <BlocoView titulo="Transferências" cor={COR.rxa} bloco={relatorio.transferencias} relatorio={relatorio} />
            )}
            {relatorio.resultadoConsolidado && <ResultadoConsolidadoView relatorio={relatorio} bloco={relatorio.resultadoConsolidado} />}
            {relatorio.icf && <IcfSection icf={relatorio.icf} />}
            {relatorio.textoConclusao && (
              <div>
                <TituloSecao texto="Conclusão" cor={COR.az2} />
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line mt-2">{relatorio.textoConclusao}</p>
              </div>
            )}
            <RodapeRelatorio relatorio={relatorio} />
          </div>
        </div>
      </div>
    </div>
  );
}

function CabecalhoRelatorio({ relatorio }: { relatorio: RelatorioFinanceiroSaida }) {
  return (
    <div className="px-8 py-6 text-white" style={{ background: `linear-gradient(135deg, ${COR.az1}, ${COR.az2})` }}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest opacity-70">Grupo Real Domínio</div>
          <div className="text-xl font-bold mt-0.5">Relatório Financeiro</div>
        </div>
        <div className="text-right text-xs opacity-80">
          <div>Emitido em {relatorio.dataEmissao}</div>
          {relatorio.colLabels.length > 0 && <div>Visão {relatorio.modoLabel}</div>}
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-white/20 flex flex-wrap gap-x-8 gap-y-1 text-sm">
        <div><span className="opacity-70">Empresa: </span><span className="font-semibold">{relatorio.empresa}</span></div>
        {relatorio.cnpjFormatado && <div><span className="opacity-70">CNPJ: </span>{relatorio.cnpjFormatado}</div>}
        <div><span className="opacity-70">Responsável: </span>{relatorio.responsavel}</div>
        <div><span className="opacity-70">Período: </span>{relatorio.periodoStr}</div>
        {relatorio.temComparativo && (
          <div><span className="opacity-70">Comparativo com: </span><span className="font-semibold">{relatorio.comparativoEmpresa}</span></div>
        )}
      </div>
    </div>
  );
}

function BoxIntroducao({ relatorio }: { relatorio: RelatorioFinanceiroSaida }) {
  if (!relatorio.textoIntroFixo && !relatorio.textoIntroCustom) return null;
  return (
    <div className="rounded-lg p-4 text-sm text-gray-700 leading-relaxed space-y-3" style={{ background: COR.czc, border: `1px solid ${COR.czm}` }}>
      {relatorio.textoIntroFixo && <p>{relatorio.textoIntroFixo}</p>}
      {relatorio.textoIntroCustom && <p className="whitespace-pre-line">{relatorio.textoIntroCustom}</p>}
    </div>
  );
}

function TituloSecao({ texto, cor }: { texto: string; cor: string }) {
  return (
    <div className="text-sm font-bold uppercase tracking-wide pb-1.5 border-b-2" style={{ color: cor, borderColor: cor }}>
      {texto}
    </div>
  );
}

function ResumoExecutivoView({ resumo: r }: { resumo: NonNullable<RelatorioFinanceiroSaida["resumo"]> }) {
  const kpis: { label: string; valor: number; cor?: "pos" | "neg" | "auto" }[] = [
    { label: "Entradas", valor: r.entradas, cor: "pos" },
    { label: "Saídas", valor: r.saidas, cor: "neg" },
    { label: "Societário", valor: r.societario, cor: "auto" },
    { label: "Resultado", valor: r.resultado, cor: "auto" },
    { label: "Saldo Inicial", valor: r.saldoInicial },
    { label: "Saldo Final", valor: r.saldoFinal },
  ];
  return (
    <div>
      <TituloSecao texto="Resumo Executivo" cor={COR.az2} />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg p-3 text-center" style={{ background: COR.czc, border: `1px solid ${COR.czm}` }}>
            <div className="text-[11px] uppercase tracking-wide text-gray-500">{k.label}</div>
            <div className="text-base font-bold mt-1" style={{ color: corValor(k.valor, k.cor) }}>
              {fmtMoeda(k.valor)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function corValor(v: number, modo?: "pos" | "neg" | "auto"): string {
  if (modo === "pos") return v < 0 ? COR.vrm : COR.vrd;
  if (modo === "neg") return v > 0 ? COR.vrm : COR.vrd;
  if (modo === "auto") return v < 0 ? COR.vrm : COR.vrd;
  return "#111827";
}

function BlocoView({
  titulo, cor, bloco, relatorio,
}: {
  titulo: string; cor: string;
  bloco: NonNullable<RelatorioFinanceiroSaida["vendas"]>;
  relatorio: RelatorioFinanceiroSaida;
}) {
  if (bloco.linhas.length === 0) return null;
  const comp = relatorio.temComparativo;
  return (
    <div className="print:break-inside-avoid">
      <TituloSecao texto={titulo} cor={cor} />
      <div className="overflow-x-auto mt-2">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr style={{ background: cor }} className="text-white">
              <th className="text-left px-2 py-1.5 font-semibold">Categoria</th>
              {relatorio.colLabels.map((c) => (
                <th key={c} className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">{c}</th>
              ))}
              {relatorio.temTotal && <th className="text-right px-2 py-1.5 font-semibold">Total</th>}
              <th className="text-right px-2 py-1.5 font-semibold">% Vendas</th>
              {comp && (
                <>
                  <th className="text-right px-2 py-1.5 font-semibold border-l border-white/30">{relatorio.comparativoEmpresa}</th>
                  <th className="text-right px-2 py-1.5 font-semibold">% Vendas</th>
                  <th className="text-right px-2 py-1.5 font-semibold">Dif. %</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {bloco.linhas.map((l, i) => (
              <tr key={i} className={cn("border-b border-gray-100", i % 2 === 1 && "bg-gray-50/60")}>
                <td className={cn("px-2 py-1.5", l.indentado ? "pl-6 text-gray-600" : "font-semibold text-gray-800")}>{l.label}</td>
                {l.valores.map((v, j) => (
                  <td key={j} className="text-right px-2 py-1.5 whitespace-nowrap" style={{ color: v < 0 ? COR.vrm : undefined }}>{fmtMoeda(v)}</td>
                ))}
                {relatorio.temTotal && (
                  <td className="text-right px-2 py-1.5 font-medium whitespace-nowrap" style={{ color: l.total < 0 ? COR.vrm : undefined }}>{fmtMoeda(l.total)}</td>
                )}
                <td className="text-right px-2 py-1.5 text-gray-500 whitespace-nowrap">{fmtPctJaEmPercentual(l.pctVendas)}</td>
                {comp && (
                  <>
                    <td className="text-right px-2 py-1.5 border-l border-gray-100 whitespace-nowrap" style={{ color: (l.totalComp ?? 0) < 0 ? COR.vrm : undefined }}>{fmtMoeda(l.totalComp)}</td>
                    <td className="text-right px-2 py-1.5 text-gray-500 whitespace-nowrap">{fmtPctJaEmPercentual(l.pctVendasComp)}</td>
                    <td className="text-right px-2 py-1.5 whitespace-nowrap" style={{ color: (l.difPct ?? 0) < 0 ? COR.vrm : COR.vrd }}>{fmtPctJaEmPercentual(l.difPct)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResultadoConsolidadoView({ relatorio, bloco }: { relatorio: RelatorioFinanceiroSaida; bloco: NonNullable<RelatorioFinanceiroSaida["resultadoConsolidado"]> }) {
  return (
    <div className="print:break-inside-avoid">
      <TituloSecao texto="Resultado Consolidado" cor={COR.az1} />
      <div className="overflow-x-auto mt-2">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr style={{ background: COR.az1 }} className="text-white">
              <th className="text-left px-2 py-1.5 font-semibold">Descrição</th>
              {relatorio.colLabels.map((c) => (
                <th key={c} className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">{c}</th>
              ))}
              {relatorio.temTotal && <th className="text-right px-2 py-1.5 font-semibold">Total</th>}
              <th className="text-right px-2 py-1.5 font-semibold">% Vendas</th>
            </tr>
          </thead>
          <tbody>
            {bloco.linhas.map((l, i) => (
              <tr
                key={i}
                className="border-b border-gray-100"
                style={l.negrito ? { background: COR.czc } : undefined}
              >
                <td className={cn("px-2 py-1.5", l.negrito ? "font-bold text-gray-900" : "text-gray-700")}>{l.label}</td>
                {l.valores.map((v, j) => (
                  <td key={j} className={cn("text-right px-2 py-1.5 whitespace-nowrap", l.negrito && "font-bold")} style={{ color: v < 0 ? COR.vrm : (l.negrito ? undefined : undefined) }}>{fmtMoeda(v)}</td>
                ))}
                {relatorio.temTotal && (
                  <td className={cn("text-right px-2 py-1.5 whitespace-nowrap", l.negrito && "font-bold")} style={{ color: l.total < 0 ? COR.vrm : undefined }}>{fmtMoeda(l.total)}</td>
                )}
                <td className="text-right px-2 py-1.5 text-gray-500 whitespace-nowrap">{fmtPctJaEmPercentual(l.pctVendas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const ICF_LABEL: Record<string, { titulo: string; cor: string }> = {
  saudavel: { titulo: "Saudável", cor: COR.vrd },
  atencao: { titulo: "Atenção", cor: "#F1C40F" },
  risco: { titulo: "Risco", cor: COR.lar },
  critico: { titulo: "Crítico", cor: COR.vrm },
};

// Faixas de classificação do ICF (ver classificar() em icf.ts) — mostradas
// como regra/legenda no relatório, igual pedido pelo usuário, pra deixar
// claro por que o resultado caiu em cada classificação.
const ICF_FAIXAS: { classificacao: string; titulo: string; faixa: string; desc: string }[] = [
  { classificacao: "saudavel", titulo: "Saudável", faixa: "resultado documentado ≥ aplicações", desc: "O resultado documentado sustenta (ou sobra em relação a) tudo que foi retirado/investido — sem déficit, não importa o tamanho da sobra." },
  { classificacao: "atencao", titulo: "Atenção", faixa: "déficit de 3% a 7% do faturamento", desc: "Aplicações passam o resultado documentado; pequena diferença, recomenda-se maior controle." },
  { classificacao: "risco", titulo: "Risco", faixa: "déficit de 7% a 15% do faturamento", desc: "Aplicações passam bastante o resultado documentado; diferença não totalmente sustentada." },
  { classificacao: "critico", titulo: "Crítico", faixa: "déficit acima de 15% do faturamento", desc: "Aplicações muito acima do resultado documentado; incompatibilidade significativa." },
];

function IcfLegenda({ classificacaoAtual }: { classificacaoAtual: string }) {
  return (
    <div className="rounded-lg overflow-hidden border mt-3" style={{ borderColor: COR.czm }}>
      <div className="px-3 py-1.5 text-xs font-semibold text-white" style={{ background: COR.az2 }}>
        Regras de classificação — déficit = (Aplicações − Resultado Documentado) ÷ Faturamento
      </div>
      <table className="w-full text-xs">
        <tbody>
          {ICF_FAIXAS.map((f) => {
            const atual = f.classificacao === classificacaoAtual;
            const cor = ICF_LABEL[f.classificacao].cor;
            return (
              <tr key={f.classificacao} className="border-t border-gray-100" style={atual ? { background: COR.czc } : undefined}>
                <td className="pl-3 py-1.5 w-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: cor }} />
                </td>
                <td className={cn("px-2 py-1.5 whitespace-nowrap", atual ? "font-bold text-gray-900" : "text-gray-700")}>{f.titulo}</td>
                <td className={cn("px-2 py-1.5 whitespace-nowrap", atual ? "font-semibold" : "text-gray-600")}>{f.faixa}</td>
                <td className="px-2 py-1.5 text-gray-500">{f.desc}</td>
                <td className="px-3 py-1.5 text-right whitespace-nowrap">{atual && <span className="text-[11px] font-bold" style={{ color: cor }}>◄ resultado atual</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function IcfSection({ icf }: { icf: NonNullable<RelatorioFinanceiroSaida["icf"]> }) {
  const badge = ICF_LABEL[icf.classificacao];
  const linhas: { label: string; valor: number }[] = [
    { label: "Faturamento", valor: icf.faturamento },
    { label: "(-) Compras", valor: -icf.compras },
    { label: "(-) Serviços Tomados", valor: -icf.servicos },
    { label: "(-) Impostos", valor: -icf.impostos },
    { label: "(-) Folha de Pagamento", valor: -icf.folha },
    { label: "= Resultado Documentado", valor: icf.resultadoDocumentado },
  ];
  const aplicacoes: { label: string; valor: number }[] = [
    { label: "Retiradas de Sócios", valor: icf.retiradas },
    { label: "Amortização de Empréstimos", valor: icf.amortizacao },
    { label: "Aquisição de Ativos", valor: icf.ativos },
    { label: "Variação de Saldo Bancário", valor: icf.variacaoSaldo },
    { label: "= Total de Aplicações", valor: icf.aplicacoes },
  ];
  return (
    <div className="print:break-inside-avoid">
      <TituloSecao texto="Indicador de Compatibilidade Financeira (ICF)" cor={COR.az2} />
      <div className="mt-3 flex items-center gap-3">
        <span className="px-3 py-1 rounded-full text-xs font-bold text-white" style={{ background: badge.cor }}>
          {badge.titulo}
        </span>
        <span className="text-sm text-gray-600">
          ICF: {fmtMoeda(icf.icfValor)} ({fmtPct(icf.icfPctFaturamento)} do faturamento)
        </span>
      </div>

      <IcfLegenda classificacaoAtual={icf.classificacao} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
        <TabelaSimples titulo="Resultado Documentado" linhas={linhas} />
        <TabelaSimples titulo="Aplicação dos Recursos" linhas={aplicacoes} />
      </div>

      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line mt-4">{icf.texto}</p>
    </div>
  );
}

function TabelaSimples({ titulo, linhas }: { titulo: string; linhas: { label: string; valor: number }[] }) {
  return (
    <div className="rounded-lg overflow-hidden border" style={{ borderColor: COR.czm }}>
      <div className="px-3 py-1.5 text-xs font-semibold text-white" style={{ background: COR.az2 }}>{titulo}</div>
      <table className="w-full text-xs">
        <tbody>
          {linhas.map((l, i) => {
            const destaque = l.label.startsWith("=");
            return (
              <tr key={i} className="border-t border-gray-100" style={destaque ? { background: COR.czc } : undefined}>
                <td className={cn("px-3 py-1.5", destaque ? "font-bold text-gray-900" : "text-gray-600")}>{l.label}</td>
                <td className={cn("px-3 py-1.5 text-right whitespace-nowrap", destaque && "font-bold")} style={{ color: l.valor < 0 ? COR.vrm : undefined }}>
                  {fmtMoeda(l.valor)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RodapeRelatorio({ relatorio }: { relatorio: RelatorioFinanceiroSaida }) {
  return (
    <div className="text-[11px] text-gray-400 border-t border-gray-200 pt-3 leading-relaxed print:break-inside-avoid">
      Relatório elaborado pelo Grupo Real Domínio para {relatorio.empresa}
      {relatorio.cnpjFormatado ? ` (CNPJ ${relatorio.cnpjFormatado})` : ""} — período de {relatorio.periodoStr}. Este
      material tem caráter informativo e gerencial, elaborado a partir das movimentações bancárias informadas, e
      não substitui a apuração contábil e fiscal oficial da empresa.
    </div>
  );
}
