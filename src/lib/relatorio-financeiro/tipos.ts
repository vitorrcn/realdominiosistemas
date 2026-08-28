// Tipos do "Relatório Financeiro" — porte do relatorio_financeiro.py
// original (Python + pandas + reportlab). O relatório é montado a partir
// de uma planilha "Banco de Dados" com uma aba de nome contendo "relat"
// (ex.: "Relatório"), no formato:
//   Código | Categorias | 01/2026 | 02/2026 | ... | Total
//   1      | Vendas     | 726791,12 | ...
//   1.1    | Pix/Transferência | ...
//   ...
// Códigos inteiros (1, 2, 3...) são grupos principais; códigos com ponto
// (1.1, 13.2...) são subcategorias do grupo antes do ponto. Linhas sem
// código (só com texto na coluna Categorias) formam o bloco de sumário
// ("Entradas", "Saídas", "Resultado", "Saldo Anterior (Banco)" etc.).

export interface CategoriaEncontrada {
  codigo: string;
  nome: string;
  valoresPorMes: Record<string, number>; // "MM/AAAA" -> valor
}

export interface EstruturaRelatorio {
  mesesDisp: string[]; // meses dentro do período selecionado, na ordem da planilha
  todosMeses: string[]; // todos os meses que existem na planilha
  catMap: Map<string, CategoriaEncontrada>; // código normalizado -> categoria
  gruposPrincipais: { codigo: number; codigoStr: string; nome: string }[]; // ordenados
  sumario: Record<string, number>; // label -> total no período
  sumarioMensal: Record<string, Record<string, number>>; // label -> {mes: valor}
}

export type ModoVisao = "mensal" | "trimestral" | "anual";

// Tipo de relatório a gerar:
// - completo: resumo + tabelas por categoria + resultado consolidado, sem ICF (o padrão de sempre)
// - resumo: só o Resumo Executivo, com base na planilha importada
// - indicador: só o ICF — nem precisa de planilha, só dos 10 campos manuais
// - resumo_indicador: Resumo Executivo + ICF, sem as tabelas por categoria
// - tudo: completo + ICF
export type ModoGeracao = "completo" | "resumo" | "indicador" | "resumo_indicador" | "tudo";

export interface GrupoTempo {
  label: string; // "01/2026", "T1/2026" ou "2026"
  meses: string[];
}

export interface ConfigRelatorioFinanceiro {
  empresa: string;
  cnpj: string;
  responsavel: string;
  textoIntro: string;
  textoConclusao: string;
  mesIni: string; // MM/AAAA
  mesFim: string; // MM/AAAA
  modo: ModoVisao;
  modoGeracao?: ModoGeracao; // default "completo" quando ausente
  compEmpresa?: string;
  compMesIni?: string;
  compMesFim?: string;
  icf?: IcfEntradaDados | null;
}

export interface IcfEntradaDados {
  faturamento: string;
  compras: string;
  servicos: string;
  impostos: string;
  folha: string;
  retiradas: string;
  amortizacao: string;
  ativos: string;
  aquisicaoEmprestimos: string;
  saldoInicial: string;
  saldoFinal: string;
}

export type IcfClassificacao = "saudavel" | "atencao" | "risco" | "critico";

export interface IcfResultado {
  faturamento: number;
  compras: number;
  servicos: number;
  impostos: number;
  folha: number;
  retiradas: number;
  amortizacao: number;
  ativos: number;
  aquisicaoEmprestimos: number;
  saldoInicial: number;
  saldoFinal: number;
  resultadoDocumentado: number;
  variacaoSaldo: number;
  aplicacoes: number;
  icfValor: number;
  icfPctFaturamento: number;
  icfPctResultado: number;
  classificacao: IcfClassificacao;
  texto: string;
}

// ── Estrutura de saída pronta pra renderizar ────────────────────────────

export interface LinhaTabela {
  label: string;
  negrito: boolean;
  indentado: boolean; // subcategoria
  valores: number[]; // um por grupoTempo
  total: number;
  pctVendas: number;
  // Quando há comparativo:
  valoresComp?: number[];
  totalComp?: number;
  pctVendasComp?: number;
  difPct?: number;
}

export interface BlocoTabela {
  titulo: string;
  linhas: LinhaTabela[];
}

export interface ResumoExecutivo {
  entradas: number;
  saidas: number;
  societario: number;
  resultado: number;
  saldoInicial: number;
  saldoFinal: number;
}

export interface RelatorioFinanceiroSaida {
  empresa: string;
  cnpjFormatado: string;
  responsavel: string;
  periodoStr: string;
  modoLabel: string;
  modoGeracao: ModoGeracao;
  dataEmissao: string;
  temComparativo: boolean;
  comparativoEmpresa?: string;
  colLabels: string[]; // rótulos de coluna (meses/trimestres/anos)
  colLabelsComp?: string[];
  temTotal: boolean; // false quando modo=anual (1 grupo só)

  textoIntroFixo: string;
  textoIntroCustom: string;
  textoConclusao: string;

  // null quando o modo de geração não inclui essa seção
  resumo: ResumoExecutivo | null;

  vendas: BlocoTabela | null;
  custos: BlocoTabela | null;
  despesas: BlocoTabela | null;
  societarioInvestimentos: BlocoTabela | null;
  transferencias: BlocoTabela | null;
  resultadoConsolidado: BlocoTabela | null;

  icf: IcfResultado | null;
}
