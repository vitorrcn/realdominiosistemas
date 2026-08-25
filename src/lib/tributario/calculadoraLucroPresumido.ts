import {
  TIPOS_ATIVIDADE, PIS_ALIQUOTA, COFINS_ALIQUOTA,
  IRPJ_ALIQUOTA_BASE, IRPJ_ADICIONAL_ALIQUOTA, IRPJ_LIMITE_MENSAL,
  CSLL_ALIQUOTA, INSS_PRO_LABORE_ALIQUOTA, TETO_INSS_2026,
  CPP_PATRONAL_PRO_LABORE_ALIQUOTA, type ChaveAtividade,
} from "./lucroPresumido";
import { novaSimulacaoLpVazia, type SimulacaoLucroPresumido } from "./tipos";

// 11% sobre o pró-labore, limitado ao teto do INSS (cota do sócio/segurado).
function calcularInssProLabore(proLabore: number): number {
  if (proLabore <= 0) return 0.0;
  const base = Math.min(proLabore, TETO_INSS_2026);
  return base * INSS_PRO_LABORE_ALIQUOTA;
}

// 20% de CPP patronal sobre o pró-labore, devida pela empresa no Lucro
// Presumido e Lucro Real (e no Simples Nacional apenas no Anexo IV). Não
// há teto e não incide RAT/Terceiros sobre essa parcela.
function calcularCppPatronalProLabore(proLabore: number): number {
  if (proLabore <= 0) return 0.0;
  return proLabore * CPP_PATRONAL_PRO_LABORE_ALIQUOTA;
}

export interface EntradaLucroPresumido {
  tipoAtividade: ChaveAtividade;
  receitaMes: number;
  nomeEmpresa?: string;
  cnpj?: string;
  atividade?: string;
  possuiIss?: boolean;
  aliquotaIss?: number;
  municipio?: string;
  possuiIcms?: boolean;
  aliquotaIcms?: number;
  estado?: string;
  possuiInssPatronal?: boolean;
  folhaPagamentoMes?: number;
  aliquotaInssPatronal?: number;
  aliquotaRat?: number;
  aliquotaTerceiros?: number;
  proLabore?: number;
  observacoes?: string;
}

export function calcularLucroPresumido(entrada: EntradaLucroPresumido): SimulacaoLucroPresumido {
  const sim = novaSimulacaoLpVazia();
  const {
    tipoAtividade, receitaMes,
    nomeEmpresa = "", cnpj = "", atividade = "",
    possuiIss = false, aliquotaIss = 0, municipio = "",
    possuiIcms = false, aliquotaIcms = 0, estado = "",
    possuiInssPatronal = false, folhaPagamentoMes = 0,
    aliquotaInssPatronal = 0.2, aliquotaRat = 0.02, aliquotaTerceiros = 0.058,
    proLabore = 0, observacoes = "",
  } = entrada;

  sim.nomeEmpresa = nomeEmpresa;
  sim.cnpj = cnpj;
  sim.atividade = atividade;
  sim.tipoAtividade = tipoAtividade;
  sim.receitaMes = receitaMes;
  sim.possuiIss = possuiIss;
  sim.aliquotaIss = aliquotaIss;
  sim.municipio = municipio;
  sim.possuiIcms = possuiIcms;
  sim.aliquotaIcms = aliquotaIcms;
  sim.estado = estado;
  sim.possuiInssPatronal = possuiInssPatronal;
  sim.folhaPagamentoMes = folhaPagamentoMes;
  sim.aliquotaInssPatronal = aliquotaInssPatronal;
  sim.aliquotaRat = aliquotaRat;
  sim.aliquotaTerceiros = aliquotaTerceiros;
  sim.proLabore = proLabore;
  sim.observacoes = observacoes;

  if (receitaMes <= 0) {
    sim.erro = "A Receita do Mês deve ser maior que zero.";
    return sim;
  }

  const tipoDados = TIPOS_ATIVIDADE[tipoAtividade];
  if (!tipoDados) {
    sim.erro = `Tipo de atividade '${tipoAtividade}' não reconhecido.`;
    return sim;
  }

  sim.labelAtividade = tipoDados.label;
  sim.irpjPresuncao = tipoDados.irpjPresuncao;
  sim.csllPresuncao = tipoDados.csllPresuncao;

  // IRPJ
  sim.baseCalculoIrpj = receitaMes * sim.irpjPresuncao;
  sim.irpjNormal = sim.baseCalculoIrpj * IRPJ_ALIQUOTA_BASE;

  const excedente = sim.baseCalculoIrpj - IRPJ_LIMITE_MENSAL;
  sim.irpjAdicional = excedente > 0 ? excedente * IRPJ_ADICIONAL_ALIQUOTA : 0.0;
  sim.irpjTotal = sim.irpjNormal + sim.irpjAdicional;

  // CSLL
  sim.baseCalculoCsll = receitaMes * sim.csllPresuncao;
  sim.csllTotal = sim.baseCalculoCsll * CSLL_ALIQUOTA;

  // PIS / COFINS
  sim.pisTotal = receitaMes * PIS_ALIQUOTA;
  sim.cofinsTotal = receitaMes * COFINS_ALIQUOTA;

  // ISS / ICMS
  sim.issTotal = possuiIss ? receitaMes * aliquotaIss : 0.0;
  sim.icmsTotal = possuiIcms ? receitaMes * aliquotaIcms : 0.0;

  // INSS Patronal + RAT + Terceiros (sobre a folha)
  if (possuiInssPatronal && folhaPagamentoMes > 0) {
    sim.inssPatronalTotal = folhaPagamentoMes * aliquotaInssPatronal;
    sim.ratTotal = folhaPagamentoMes * aliquotaRat;
    sim.terceirosTotal = folhaPagamentoMes * aliquotaTerceiros;
    sim.inssPatronalCompleto = sim.inssPatronalTotal + sim.ratTotal + sim.terceirosTotal;
  } else {
    sim.inssPatronalTotal = 0;
    sim.ratTotal = 0;
    sim.terceirosTotal = 0;
    sim.inssPatronalCompleto = 0;
  }

  // INSS sobre Pró-labore
  sim.inssProLabore = calcularInssProLabore(proLabore);
  sim.cppPatronalProLabore = calcularCppPatronalProLabore(proLabore);

  // Totais
  sim.totalTributosPj = sim.irpjTotal + sim.csllTotal + sim.pisTotal + sim.cofinsTotal + sim.issTotal + sim.icmsTotal;
  sim.totalEncargosFolha = sim.inssPatronalCompleto + sim.cppPatronalProLabore;
  sim.custoTotalMes = sim.totalTributosPj + sim.totalEncargosFolha + sim.inssProLabore;

  sim.cargaEfetivaPercentual = receitaMes > 0 ? (sim.custoTotalMes / receitaMes) * 100 : 0.0;

  sim.sucesso = true;
  return sim;
}
