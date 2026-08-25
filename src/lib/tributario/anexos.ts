// Tabelas do Simples Nacional - Lei Complementar 123/2006
// Vigencia: a partir de 1.01.2018 (conforme LC 155/2016)
// Fonte: Planalto.gov.br / CDM Contabilidade

export interface FaixaSimples {
  faixa: number;
  limite: number;
  aliquota: number;
  pd: number; // parcela dedutivel
}

export type NomeAnexo = "Anexo I" | "Anexo II" | "Anexo III" | "Anexo IV" | "Anexo V";

const ANEXO_I: FaixaSimples[] = [
  { faixa: 1, limite: 180000.0, aliquota: 0.04, pd: 0.0 },
  { faixa: 2, limite: 360000.0, aliquota: 0.073, pd: 5940.0 },
  { faixa: 3, limite: 720000.0, aliquota: 0.095, pd: 13860.0 },
  { faixa: 4, limite: 1800000.0, aliquota: 0.107, pd: 22500.0 },
  { faixa: 5, limite: 3600000.0, aliquota: 0.143, pd: 87300.0 },
  { faixa: 6, limite: 4800000.0, aliquota: 0.19, pd: 378000.0 },
];

const ANEXO_II: FaixaSimples[] = [
  { faixa: 1, limite: 180000.0, aliquota: 0.045, pd: 0.0 },
  { faixa: 2, limite: 360000.0, aliquota: 0.078, pd: 5940.0 },
  { faixa: 3, limite: 720000.0, aliquota: 0.1, pd: 13860.0 },
  { faixa: 4, limite: 1800000.0, aliquota: 0.112, pd: 22500.0 },
  { faixa: 5, limite: 3600000.0, aliquota: 0.147, pd: 85500.0 },
  { faixa: 6, limite: 4800000.0, aliquota: 0.3, pd: 720000.0 },
];

const ANEXO_III: FaixaSimples[] = [
  { faixa: 1, limite: 180000.0, aliquota: 0.06, pd: 0.0 },
  { faixa: 2, limite: 360000.0, aliquota: 0.112, pd: 9360.0 },
  { faixa: 3, limite: 720000.0, aliquota: 0.135, pd: 17640.0 },
  { faixa: 4, limite: 1800000.0, aliquota: 0.16, pd: 35640.0 },
  { faixa: 5, limite: 3600000.0, aliquota: 0.21, pd: 125640.0 },
  { faixa: 6, limite: 4800000.0, aliquota: 0.33, pd: 648000.0 },
];

const ANEXO_IV: FaixaSimples[] = [
  { faixa: 1, limite: 180000.0, aliquota: 0.045, pd: 0.0 },
  { faixa: 2, limite: 360000.0, aliquota: 0.09, pd: 8100.0 },
  { faixa: 3, limite: 720000.0, aliquota: 0.102, pd: 12420.0 },
  { faixa: 4, limite: 1800000.0, aliquota: 0.14, pd: 39780.0 },
  { faixa: 5, limite: 3600000.0, aliquota: 0.22, pd: 183780.0 },
  { faixa: 6, limite: 4800000.0, aliquota: 0.33, pd: 828000.0 },
];

const ANEXO_V: FaixaSimples[] = [
  { faixa: 1, limite: 180000.0, aliquota: 0.155, pd: 0.0 },
  { faixa: 2, limite: 360000.0, aliquota: 0.18, pd: 4500.0 },
  { faixa: 3, limite: 720000.0, aliquota: 0.195, pd: 9900.0 },
  { faixa: 4, limite: 1800000.0, aliquota: 0.205, pd: 17100.0 },
  { faixa: 5, limite: 3600000.0, aliquota: 0.23, pd: 62100.0 },
  { faixa: 6, limite: 4800000.0, aliquota: 0.305, pd: 540000.0 },
];

export const TABELAS: Record<NomeAnexo, FaixaSimples[]> = {
  "Anexo I": ANEXO_I,
  "Anexo II": ANEXO_II,
  "Anexo III": ANEXO_III,
  "Anexo IV": ANEXO_IV,
  "Anexo V": ANEXO_V,
};

export const DESCRICAO_ANEXOS: Record<NomeAnexo, string> = {
  "Anexo I": "Comércio (Revenda de Mercadorias)",
  "Anexo II": "Indústria (Fabricação de Mercadorias)",
  "Anexo III": "Serviços (Instalação, Reparos, Manutenção e outros / Fator R)",
  "Anexo IV": "Serviços (Construção Civil, Vigilância, Limpeza e outros)",
  "Anexo V": "Serviços (Intelectuais, Tecnologia, Publicidade / Fator R)",
};

export const LIMITE_SIMPLES = 4800000.0;
