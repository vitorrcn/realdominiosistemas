// Indicador de Compatibilidade Financeira (ICF) — porte fiel da classe
// IndicadorCompatibilidadeFinanceira do relatorio_financeiro.py original.
import type { IcfClassificacao, IcfEntradaDados, IcfResultado } from "./tipos";

function paraFloat(v: string | undefined): number {
  if (!v) return 0;
  const s = v.trim().replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function classificar(pctFat: number): IcfClassificacao {
  const p = Math.abs(pctFat);
  if (p <= 0.03) return "saudavel";
  if (p <= 0.07) return "atencao";
  if (p <= 0.15) return "risco";
  return "critico";
}

function gerarTexto(classificacao: IcfClassificacao): string {
  const base =
    "O Indicador de Compatibilidade Financeira (ICF) tem como objetivo avaliar se o " +
    "resultado gerado pela empresa é compatível com a movimentação financeira observada " +
    "no período. Quanto mais próximo de zero estiver o indicador, maior tende a ser a " +
    "coerência entre os dados analisados.\n\n";

  switch (classificacao) {
    case "saudavel":
      return (
        base +
        "O indicador demonstra alta compatibilidade entre o resultado estimado e a " +
        "utilização dos recursos financeiros. Isso indica que o lucro gerado é suficiente " +
        "para sustentar retiradas, investimentos e evolução do saldo bancário. O cenário " +
        "sugere bom nível de organização financeira e rastreabilidade das operações."
      );
    case "atencao":
      return (
        base +
        "O indicador apresenta pequena variação em relação ao ponto de equilíbrio. " +
        "Apesar de existir coerência geral, há diferenças não totalmente explicadas. " +
        "Recomenda-se maior controle das movimentações financeiras para aumentar a " +
        "precisão das informações."
      );
    case "risco":
      return (
        base +
        "O indicador evidencia diferença relevante entre o resultado estimado e a " +
        "movimentação financeira. Parte das operações não está devidamente sustentada " +
        "por documentação ou controle adequado. Esse cenário aumenta o risco fiscal e " +
        "compromete a confiabilidade das informações."
      );
    default:
      return (
        base +
        "O indicador demonstra incompatibilidade significativa entre o resultado e a " +
        "movimentação financeira. O volume de recursos utilizados não é suportado pelo " +
        "resultado estimado. Esse cenário indica ausência de controle financeiro adequado " +
        "e pode gerar impactos fiscais relevantes."
      );
  }
}

export function calcularIcf(dados: IcfEntradaDados): IcfResultado {
  const faturamento = paraFloat(dados.faturamento);
  const compras = paraFloat(dados.compras);
  const servicos = paraFloat(dados.servicos);
  const impostos = paraFloat(dados.impostos);
  const folha = paraFloat(dados.folha);
  const retiradas = paraFloat(dados.retiradas);
  const amortizacao = paraFloat(dados.amortizacao);
  const ativos = paraFloat(dados.ativos);
  const saldoInicial = paraFloat(dados.saldoInicial);
  const saldoFinal = paraFloat(dados.saldoFinal);

  const resultadoDocumentado = faturamento - compras - servicos - impostos - folha;
  const variacaoSaldo = saldoFinal - saldoInicial;
  const aplicacoes = retiradas + amortizacao + ativos + variacaoSaldo;
  const icfValor = resultadoDocumentado - aplicacoes;
  const icfPctFaturamento = faturamento !== 0 ? icfValor / faturamento : 0;
  const icfPctResultado = resultadoDocumentado !== 0 ? icfValor / resultadoDocumentado : 0;
  const classificacao = classificar(icfPctFaturamento);

  return {
    faturamento, compras, servicos, impostos, folha, retiradas, amortizacao, ativos,
    saldoInicial, saldoFinal, resultadoDocumentado, variacaoSaldo, aplicacoes, icfValor,
    icfPctFaturamento, icfPctResultado, classificacao,
    texto: gerarTexto(classificacao),
  };
}
