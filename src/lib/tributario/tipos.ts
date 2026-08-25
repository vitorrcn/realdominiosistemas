// Tipos compartilhados entre os simuladores (equivalentes aos dataclasses
// Python de models/simulacao.py e models/simulacao_lp.py).
import type { ChaveAtividade } from "./lucroPresumido";

export interface Simulacao {
  // Dados da empresa
  nomeEmpresa: string;
  cnpj: string;
  atividade: string;

  anexo: string;
  descricaoAnexo: string;
  rbt12: number;
  receitaMes: number;
  folha12m: number | null;

  // Resultados calculados
  faixa: number;
  aliquotaNominal: number;
  parcelaDedutivel: number;
  aliquotaEfetiva: number;
  dasEstimado: number;

  // Fator R
  fatorR: number | null;
  fatorRPercentual: number | null;
  usaFatorR: boolean;
  anexoOriginal: string;
  anexoFinal: string;
  tributadoPeloAnexoIii: boolean | null;

  // INSS Patronal (CPP) - apenas Anexo IV recolhe por fora do DAS
  cppForaDoDas: boolean;
  folhaParaCpp: number;
  aliquotaCppPatronal: number;
  aliquotaRat: number;
  aliquotaTerceiros: number;
  cppPatronalTotal: number;
  ratTotal: number;
  terceirosTotal: number;
  cppCompletoTotal: number;

  // Pró-labore
  proLabore: number;
  inssProLabore: number;
  cppPatronalProLabore: number;

  observacoes: string;

  // Custos opcionais para apresentação ao cliente (não entram no cálculo tributário)
  honorarioContabil: number;
  custoLegalizacao: number;

  rotuloCenario: string;

  sucesso: boolean;
  erro: string;
}

export function novaSimulacaoVazia(): Simulacao {
  return {
    nomeEmpresa: "", cnpj: "", atividade: "",
    anexo: "", descricaoAnexo: "", rbt12: 0, receitaMes: 0, folha12m: null,
    faixa: 0, aliquotaNominal: 0, parcelaDedutivel: 0, aliquotaEfetiva: 0, dasEstimado: 0,
    fatorR: null, fatorRPercentual: null, usaFatorR: false, anexoOriginal: "", anexoFinal: "", tributadoPeloAnexoIii: null,
    cppForaDoDas: false, folhaParaCpp: 0, aliquotaCppPatronal: 0.2, aliquotaRat: 0.02, aliquotaTerceiros: 0.058,
    cppPatronalTotal: 0, ratTotal: 0, terceirosTotal: 0, cppCompletoTotal: 0,
    proLabore: 0, inssProLabore: 0, cppPatronalProLabore: 0,
    observacoes: "", honorarioContabil: 0, custoLegalizacao: 0, rotuloCenario: "",
    sucesso: false, erro: "",
  };
}

export interface SimulacaoLucroPresumido {
  nomeEmpresa: string;
  cnpj: string;
  atividade: string;

  tipoAtividade: ChaveAtividade;
  receitaMes: number;

  possuiIss: boolean;
  aliquotaIss: number;
  municipio: string;

  possuiIcms: boolean;
  aliquotaIcms: number;
  estado: string;

  possuiInssPatronal: boolean;
  folhaPagamentoMes: number;
  aliquotaInssPatronal: number;
  aliquotaRat: number;
  aliquotaTerceiros: number;

  proLabore: number;

  observacoes: string;
  honorarioContabil: number;
  custoLegalizacao: number;
  rotuloCenario: string;

  // Resultados calculados
  labelAtividade: string;
  irpjPresuncao: number;
  csllPresuncao: number;

  baseCalculoIrpj: number;
  baseCalculoCsll: number;

  irpjNormal: number;
  irpjAdicional: number;
  irpjTotal: number;

  csllTotal: number;
  pisTotal: number;
  cofinsTotal: number;
  issTotal: number;
  icmsTotal: number;

  inssPatronalTotal: number;
  ratTotal: number;
  terceirosTotal: number;
  inssPatronalCompleto: number;

  inssProLabore: number;
  cppPatronalProLabore: number;

  totalTributosPj: number;
  totalEncargosFolha: number;
  custoTotalMes: number;

  cargaEfetivaPercentual: number;

  sucesso: boolean;
  erro: string;
}

export function novaSimulacaoLpVazia(): SimulacaoLucroPresumido {
  return {
    nomeEmpresa: "", cnpj: "", atividade: "",
    tipoAtividade: "demais", receitaMes: 0,
    possuiIss: false, aliquotaIss: 0, municipio: "",
    possuiIcms: false, aliquotaIcms: 0, estado: "",
    possuiInssPatronal: false, folhaPagamentoMes: 0, aliquotaInssPatronal: 0.2, aliquotaRat: 0.02, aliquotaTerceiros: 0.058,
    proLabore: 0,
    observacoes: "", honorarioContabil: 0, custoLegalizacao: 0, rotuloCenario: "",
    labelAtividade: "", irpjPresuncao: 0, csllPresuncao: 0,
    baseCalculoIrpj: 0, baseCalculoCsll: 0,
    irpjNormal: 0, irpjAdicional: 0, irpjTotal: 0,
    csllTotal: 0, pisTotal: 0, cofinsTotal: 0, issTotal: 0, icmsTotal: 0,
    inssPatronalTotal: 0, ratTotal: 0, terceirosTotal: 0, inssPatronalCompleto: 0,
    inssProLabore: 0, cppPatronalProLabore: 0,
    totalTributosPj: 0, totalEncargosFolha: 0, custoTotalMes: 0,
    cargaEfetivaPercentual: 0,
    sucesso: false, erro: "",
  };
}

// Envelope genérico para qualquer simulação (Simples ou Lucro Presumido)
// quando incluída no comparativo multi-cenário.
export type Regime = "Simples Nacional" | "Lucro Presumido";

export interface CenarioComparativo {
  rotulo: string;
  regime: Regime;
  simulacao: Simulacao | SimulacaoLucroPresumido;
  identificacao: string;
  custoTributarioMes: number;
  honorarioContabil: number;
  custoLegalizacao: number;
  custoTotalApresentacao: number;
  aliquotaEfetivaTotal: number;
}

export interface ComparativoMultiplo {
  cenarios: CenarioComparativo[];
  receitaMes: number;
  rotuloMaisVantajoso: string;
  custoMaisVantajoso: number;
  nomeEmpresa: string;
  cnpj: string;
  atividade: string;
  observacoes: string;
  sucesso: boolean;
  erro: string;
}
