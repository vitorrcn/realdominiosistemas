// Tipos compartilhados do "Real Extratos" (conversor de extrato bancário
// para o formato de importação contábil Alterdata).

export interface Transacao {
  date: string; // DD/MM/AAAA
  description: string;
  value: number;
  is_debit: boolean;
}

export type ParserId =
  | "itau_periodo"
  | "itau_empresas"
  | "itau_mensal_pf"
  | "itau_mensal"
  | "itau_v2"
  | "santander_internet_banking"
  | "mercado_pago"
  | "stone"
  | "nubank"
  | "inter"
  | "inter_cc"
  | "cora"
  | "universal"
  | "bradesco"
  | "santander_consolidado_pj"
  | "santander"
  | "bb"
  | "caixa"
  | "sicoob"
  | "unicred";

export interface DeteccaoBanco {
  bancoKey: string;
  parserId: ParserId;
  descricao: string;
}

export interface RegraClassificacao {
  keyword: string;
  conta_debito: string;
  conta_credito: string;
  priority?: number;
}

export interface ConfigRealExtratos {
  conta_banco: string;
  conta_receita: string;
  conta_socio: string;
  conta_despesas: string;
  conta_padrao: string;
  nome_socio: string;
  rules: RegraClassificacao[];
}

export interface Fornecedor {
  nome: string;
  nome_norm: string;
  conta: string;
  keywords: string[];
}

export interface Lancamento {
  date: string;
  description: string;
  debit: string;
  credit: string;
  value: number;
  categoria: string;
  origem: "rule" | "fornecedor" | "builtin" | "padrao";
}
