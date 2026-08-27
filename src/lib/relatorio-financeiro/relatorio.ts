// Montagem do relatório financeiro — porte fiel de gerar_pdf() do
// relatorio_financeiro.py original, mas devolvendo dados estruturados
// (números crus) em vez de montar o PDF diretamente — quem desenha é a
// tela de impressão no navegador.
//
// Duas partes do script original nunca chegavam a ser usadas de verdade
// (definidas mas nunca chamadas dentro de gerar_pdf): os gráficos
// (graf_barras/graf_resultado/graf_pizza) e a análise de IA por seção
// (bloco_ia). Por isso não foram portadas agora — o relatório funcional
// de verdade é só tabelas e texto.
import { agrupar, estruturar, mesIdx, type EstruturaComHelpers } from "./excel";
import { calcularIcf } from "./icf";
import type {
  BlocoTabela, ConfigRelatorioFinanceiro, GrupoTempo, LinhaTabela,
  RelatorioFinanceiroSaida, ResumoExecutivo,
} from "./tipos";

export const TEXTO_INTRO_FIXO =
  "O quadro financeiro apresentado a seguir foi elaborado com base exclusivamente " +
  "nas movimentações bancárias das empresas analisadas. Dessa forma, todas as entradas " +
  "e saídas realizadas por meio de contas bancárias foram consideradas para fins deste " +
  "relatório. Ressalta-se, contudo, que eventuais operações realizadas em espécie " +
  "(dinheiro) não estão refletidas nos dados apresentados, podendo haver divergências " +
  "entre o resultado apurado e a realidade financeira completa das empresas.";

export function fmtCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, "");
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : cnpj;
}

function somaGrupo(estrutura: EstruturaComHelpers, meses: string[], cod: string): number {
  const cat = estrutura.get(cod);
  return meses.reduce((s, m) => s + estrutura.val(cat, m), 0);
}
function somaTotalGrupo(estrutura: EstruturaComHelpers, gruposTempo: GrupoTempo[], cod: string): number {
  return gruposTempo.reduce((s, gt) => s + somaGrupo(estrutura, gt.meses, cod), 0);
}
function somaSeries(...series: number[][]): number[] {
  const len = Math.max(0, ...series.map((s) => s.length));
  const out = new Array(len).fill(0);
  for (const s of series) for (let i = 0; i < s.length; i++) out[i] += s[i] ?? 0;
  return out;
}

interface ComparativoCtx {
  estrutura: EstruturaComHelpers;
  gruposTempo: GrupoTempo[];
}

function construirBloco(
  principal: EstruturaComHelpers,
  gruposTempo: GrupoTempo[],
  grupoCodes: string[],
  comparativo: ComparativoCtx | null
): BlocoTabela {
  const receitaTotal = somaTotalGrupo(principal, gruposTempo, "1") || 1;
  const entradasComp = comparativo?.estrutura.sumario["Entradas"] || 0;
  const linhas: LinhaTabela[] = [];

  for (const gCod of grupoCodes) {
    const cat = principal.get(gCod);
    const valoresG = gruposTempo.map((gt) => somaGrupo(principal, gt.meses, gCod));
    const total1 = valoresG.reduce((a, b) => a + b, 0);
    const pct1 = receitaTotal ? (Math.abs(total1) / Math.abs(receitaTotal)) * 100 : 0;
    const nomeCat = cat ? cat.nome : gCod;

    const linha: LinhaTabela = { label: nomeCat, negrito: true, indentado: false, valores: valoresG, total: total1, pctVendas: pct1 };

    if (comparativo) {
      const valoresG2 = comparativo.gruposTempo.map((gt) => somaGrupo(comparativo.estrutura, gt.meses, gCod));
      const total2 = valoresG2.reduce((a, b) => a + b, 0);
      linha.valoresComp = valoresG2;
      linha.totalComp = total2;
      linha.pctVendasComp = entradasComp ? (total2 / entradasComp) * 100 : 0;
      linha.difPct = total2 ? ((total1 - total2) / Math.abs(total2)) * 100 : 0;
    }
    linhas.push(linha);

    for (const [sCod, sNome] of principal.subcats(gCod)) {
      const sv = gruposTempo.map((gt) => somaGrupo(principal, gt.meses, sCod));
      const st = sv.reduce((a, b) => a + b, 0);
      if (st === 0 && sv.every((v) => v === 0)) continue;
      const pctS = receitaTotal ? (Math.abs(st) / Math.abs(receitaTotal)) * 100 : 0;
      const subLinha: LinhaTabela = { label: sNome, negrito: false, indentado: true, valores: sv, total: st, pctVendas: pctS };
      if (comparativo) {
        const sv2 = comparativo.gruposTempo.map((gt) => somaGrupo(comparativo.estrutura, gt.meses, sCod));
        const st2 = sv2.reduce((a, b) => a + b, 0);
        subLinha.valoresComp = sv2;
        subLinha.totalComp = st2;
        subLinha.pctVendasComp = entradasComp ? (Math.abs(st2) / Math.abs(entradasComp)) * 100 : 0;
        subLinha.difPct = st2 ? ((st - st2) / Math.abs(st2)) * 100 : 0;
      }
      linhas.push(subLinha);
    }
  }

  return { titulo: "", linhas };
}

function somaPeriodo(estrutura: EstruturaComHelpers, mesIni: string, mesFim: string, label: string): number {
  const vals = estrutura.sumarioMensal[label];
  if (vals && Object.keys(vals).length) {
    const total = Object.entries(vals)
      .filter(([m]) => mesIdx(mesIni) <= mesIdx(m) && mesIdx(m) <= mesIdx(mesFim))
      .reduce((s, [, v]) => s + v, 0);
    return total !== 0 ? total : estrutura.sumario[label] ?? 0;
  }
  return estrutura.sumario[label] ?? 0;
}
function saldoPeriodo(estrutura: EstruturaComHelpers, mesIni: string, mesFim: string, label: string): number {
  const vals = estrutura.sumarioMensal[label];
  if (vals && Object.keys(vals).length) {
    const filtrados = Object.entries(vals)
      .filter(([m]) => mesIdx(mesIni) <= mesIdx(m) && mesIdx(m) <= mesIdx(mesFim))
      .sort((a, b) => mesIdx(a[0]) - mesIdx(b[0]));
    if (filtrados.length) return filtrados[0][1];
  }
  return estrutura.sumario[label] ?? 0;
}

const MODO_LABEL: Record<string, string> = { mensal: "Mensal", trimestral: "Trimestral", anual: "Anual" };

export function gerarRelatorio(
  linhasExcel: any[][],
  linhasExcelComparativo: any[][] | null,
  config: ConfigRelatorioFinanceiro
): RelatorioFinanceiroSaida {
  const estrutura = estruturar(linhasExcel, config.mesIni, config.mesFim);
  if (estrutura.mesesDisp.length === 0) {
    throw new Error(
      `Nenhum dado para ${config.mesIni}–${config.mesFim}. Disponíveis: ${estrutura.todosMeses.join(", ")}`
    );
  }

  let comparativo: ComparativoCtx | null = null;
  if (linhasExcelComparativo) {
    const estruturaComp = estruturar(
      linhasExcelComparativo,
      config.compMesIni || config.mesIni,
      config.compMesFim || config.mesFim
    );
    comparativo = { estrutura: estruturaComp, gruposTempo: agrupar(estruturaComp.mesesDisp, config.modo) };
  }

  const gruposTempo = agrupar(estrutura.mesesDisp, config.modo);
  const colLabels = gruposTempo.map((g) => g.label);
  const temTotal = gruposTempo.length > 1 && config.modo !== "anual";
  const receitaTotal = somaTotalGrupo(estrutura, gruposTempo, "1") || 1;

  // ── Resumo executivo ────────────────────────────────────────────────
  const resumo: ResumoExecutivo = {
    entradas: somaPeriodo(estrutura, config.mesIni, config.mesFim, "Entradas"),
    saidas: Math.abs(somaPeriodo(estrutura, config.mesIni, config.mesFim, "Saídas")),
    societario: somaPeriodo(estrutura, config.mesIni, config.mesFim, "Societário"),
    resultado: somaPeriodo(estrutura, config.mesIni, config.mesFim, "Resultado"),
    saldoInicial: saldoPeriodo(estrutura, config.mesIni, config.mesFim, "Saldo Anterior (Banco)"),
    saldoFinal: saldoPeriodo(estrutura, config.mesIni, config.mesFim, "Saldo Final (Banco)"),
  };

  // ── Blocos por categoria ─────────────────────────────────────────────
  const vendas = construirBloco(estrutura, gruposTempo, ["1"], comparativo);
  const custos = construirBloco(estrutura, gruposTempo, ["2"], comparativo);

  const despesasCods = estrutura.gruposPrincipais.filter((g) => g.codigo >= 3 && g.codigo <= 12).map((g) => g.codigoStr);
  const despesas = construirBloco(estrutura, gruposTempo, despesasCods, comparativo);

  const socInvCods = estrutura.gruposPrincipais.filter((g) => [13, 14].includes(g.codigo)).map((g) => g.codigoStr);
  const societarioInvestimentos = socInvCods.length ? construirBloco(estrutura, gruposTempo, socInvCods, comparativo) : null;

  const transfCods = estrutura.gruposPrincipais.filter((g) => [0, 94, 95, 98, 99].includes(g.codigo)).map((g) => g.codigoStr);
  const transferencias = transfCods.length ? construirBloco(estrutura, gruposTempo, transfCods, comparativo) : null;

  // ── Resultado consolidado (DRE + fluxo de caixa) — nunca tem
  // comparativo, igual no app original (só as tabelas por categoria acima
  // mostram a empresa comparativa lado a lado). ───────────────────────
  function linhaRes(rotulo: string, cods: string[], negrito: boolean): { linha: LinhaTabela; serie: number[] } {
    const serie = gruposTempo.map((gt) => cods.reduce((s, c) => s + somaGrupo(estrutura, gt.meses, c), 0));
    const tot = serie.reduce((a, b) => a + b, 0);
    const pct = receitaTotal ? (Math.abs(tot) / Math.abs(receitaTotal)) * 100 : 0;
    return { linha: { label: rotulo, negrito, indentado: false, valores: serie, total: tot, pctVendas: pct }, serie };
  }
  function linhaSubtotal(rotulo: string, serie: number[]): LinhaTabela {
    const tot = serie.reduce((a, b) => a + b, 0);
    const pct = receitaTotal ? (Math.abs(tot) / Math.abs(receitaTotal)) * 100 : 0;
    return { label: `= ${rotulo}`, negrito: true, indentado: false, valores: serie, total: tot, pctVendas: pct };
  }

  const resLinhas: LinhaTabela[] = [];
  const { linha: c1, serie: s1 } = linhaRes(estrutura.nome("1"), ["1"], false); resLinhas.push(c1);
  const { linha: c2, serie: s2 } = linhaRes(estrutura.nome("2"), ["2"], false); resLinhas.push(c2);
  const { linha: c3, serie: s3 } = linhaRes(estrutura.nome("3"), ["3"], false); resLinhas.push(c3);
  const { linha: c4, serie: s4 } = linhaRes(estrutura.nome("4"), ["4"], false); resLinhas.push(c4);
  const { linha: c5, serie: s5 } = linhaRes(estrutura.nome("5"), ["5"], false); resLinhas.push(c5);
  const { linha: c6, serie: s6 } = linhaRes(estrutura.nome("6"), ["6"], false); resLinhas.push(c6);
  const { linha: c7, serie: s7 } = linhaRes(estrutura.nome("7"), ["7"], false); resLinhas.push(c7);
  const { linha: c8, serie: s8 } = linhaRes(estrutura.nome("8"), ["8"], false); resLinhas.push(c8);
  const { linha: c9, serie: s9 } = linhaRes(estrutura.nome("9"), ["9"], false); resLinhas.push(c9);
  const opSerie = somaSeries(s1, s2, s3, s4, s5, s6, s7, s8, s9);
  resLinhas.push(linhaSubtotal("Resultado Operacional", opSerie));

  const { linha: c12, serie: s12 } = linhaRes(estrutura.nome("12"), ["12"], false); resLinhas.push(c12);
  const { linha: c10, serie: s10 } = linhaRes(estrutura.nome("10"), ["10"], false); resLinhas.push(c10);
  const { linha: c11, serie: s11 } = linhaRes(estrutura.nome("11"), ["11"], false); resLinhas.push(c11);
  const finSerie = somaSeries(opSerie, s12, s10, s11);
  resLinhas.push(linhaSubtotal("Resultado Financeiro", finSerie));

  const { linha: ca1, serie: sa1 } = linhaRes(estrutura.nome("13.1"), ["13.1"], false); resLinhas.push(ca1);
  const { linha: ca2, serie: sa2 } = linhaRes(estrutura.nome("13.2"), ["13.2"], false); resLinhas.push(ca2);
  const { linha: ca3, serie: sa3 } = linhaRes(estrutura.nome("14"), ["14"], false); resLinhas.push(ca3);
  const { linha: ca4, serie: sa4 } = linhaRes(estrutura.nome("0"), ["0"], false); resLinhas.push(ca4);
  const fcSerie = somaSeries(finSerie, sa1, sa2, sa3, sa4);
  resLinhas.push(linhaSubtotal("Fluxo de Caixa Final", fcSerie));

  const resultadoConsolidado: BlocoTabela = { titulo: "Resultado Consolidado", linhas: resLinhas };

  const icf = config.icf ? calcularIcf({
    faturamento: config.icf.faturamento, compras: config.icf.compras, servicos: config.icf.servicos,
    impostos: config.icf.impostos, folha: config.icf.folha, retiradas: config.icf.retiradas,
    amortizacao: config.icf.amortizacao, ativos: config.icf.ativos,
    saldoInicial: config.icf.saldoInicial, saldoFinal: config.icf.saldoFinal,
  }) : null;

  const hoje = new Date();
  const dataEmissao = hoje.toLocaleDateString("pt-BR");

  return {
    empresa: config.empresa,
    cnpjFormatado: config.cnpj.trim() ? fmtCnpj(config.cnpj) : "",
    responsavel: config.responsavel || "—",
    periodoStr: `${config.mesIni} a ${config.mesFim}`,
    modoLabel: MODO_LABEL[config.modo],
    dataEmissao,
    temComparativo: !!comparativo,
    comparativoEmpresa: comparativo ? config.compEmpresa || "Comparativo" : undefined,
    colLabels,
    colLabelsComp: comparativo ? comparativo.gruposTempo.map((g) => g.label) : undefined,
    temTotal,
    textoIntroFixo: TEXTO_INTRO_FIXO,
    textoIntroCustom: config.textoIntro || "",
    textoConclusao: config.textoConclusao || "",
    resumo,
    vendas,
    custos,
    despesas,
    societarioInvestimentos,
    transferencias,
    resultadoConsolidado,
    icf,
  };
}
