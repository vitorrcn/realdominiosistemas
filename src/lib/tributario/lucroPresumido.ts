// Estrutura Tributária - Lucro Presumido
// Baseado em: IRPJ/CSLL por presunção, PIS/COFINS cumulativo, ISS, ICMS, INSS Patronal

export interface TipoAtividade {
  label: string;
  irpjPresuncao: number;
  csllPresuncao: number;
}

// Chave de TIPOS_ATIVIDADE
export type ChaveAtividade =
  | "combustivel"
  | "transporte_passageiros"
  | "transporte_cargas"
  | "hospitalar"
  | "servicos_gerais"
  | "demais";

export const TIPOS_ATIVIDADE: Record<ChaveAtividade, TipoAtividade> = {
  combustivel: { label: "Revenda de Combustíveis", irpjPresuncao: 0.016, csllPresuncao: 0.12 },
  transporte_passageiros: { label: "Transporte de Passageiros", irpjPresuncao: 0.16, csllPresuncao: 0.12 },
  transporte_cargas: { label: "Transporte de Cargas", irpjPresuncao: 0.08, csllPresuncao: 0.12 },
  hospitalar: { label: "Serviços Hospitalares e Correlatos", irpjPresuncao: 0.08, csllPresuncao: 0.12 },
  servicos_gerais: { label: "Serviços em Geral", irpjPresuncao: 0.32, csllPresuncao: 0.32 },
  demais: { label: "Demais Atividades (Comércio/Indústria)", irpjPresuncao: 0.08, csllPresuncao: 0.12 },
};

// Alíquotas fixas
export const PIS_ALIQUOTA = 0.0065; // 0,65% sobre receita bruta
export const COFINS_ALIQUOTA = 0.03; // 3,00% sobre receita bruta

// IRPJ: alíquota e adicional
export const IRPJ_ALIQUOTA_BASE = 0.15; // 15% sobre o lucro presumido
export const IRPJ_ADICIONAL_ALIQUOTA = 0.1; // 10% adicional sobre o que exceder o limite
export const IRPJ_LIMITE_MENSAL = 20000.0; // Limite mensal para incidência do adicional (R$ 20.000/mês)

// CSLL
export const CSLL_ALIQUOTA = 0.09; // 9% sobre a base de presunção da CSLL

// INSS Patronal padrão (referência)
export const INSS_PATRONAL_PADRAO = 0.2; // 20% sobre a folha (CPP regra geral)
export const RAT_PADRAO = 0.02; // 2% (RAT médio - varia 1% a 3% conforme risco)
export const TERCEIROS_PADRAO = 0.058; // 5,8% média (Sistema S, INCRA, etc. - varia por atividade)

// INSS sobre Pró-labore
export const INSS_PRO_LABORE_ALIQUOTA = 0.11; // 11% retido do sócio/administrador (contribuinte individual), limitado ao teto
export const CPP_PATRONAL_PRO_LABORE_ALIQUOTA = 0.2; // 20% de CPP patronal sobre o pró-labore, devida pela empresa (sem teto, sem RAT/Terceiros)
export const TETO_INSS_2026 = 8475.55; // Teto oficial INSS 2026 (Portaria MPS/MF nº 13, vigente desde 01/01/2026)
export const SALARIO_MINIMO_2026 = 1621.0; // Piso para fins de contribuição mínima
