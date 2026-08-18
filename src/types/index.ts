import { PerfilGlobal, StatusEmpresa, StatusObrigacao, StatusEvento, StatusTarefa, RegimeTributario } from "@prisma/client";

// ── Re-exporta enums do Prisma ──────────────────────────────────
export { PerfilGlobal, StatusEmpresa, StatusObrigacao, StatusEvento, StatusTarefa, RegimeTributario };

// ── Sessão do usuário autenticado ───────────────────────────────
export interface UsuarioSession {
  id: string;
  nome: string;
  email: string;
  perfilGlobal: PerfilGlobal;
  podeVerComercial: boolean;
  setores: Array<{ setorId: string; nome: string; papel: string }>;
}

// ── Empresa resumida (para listagem) ───────────────────────────
export interface EmpresaResumo {
  id: string;
  codigoInterno: string;
  tipoPessoa: "PJ" | "PF";
  cnpj: string | null;
  cpf: string | null;
  razaoSocial: string;
  nomeFantasia: string | null;
  municipio: string | null;
  estado: string | null;
  status: StatusEmpresa;
  obsCritica: string | null;
  empresaBaixada?: boolean;
  respFiscal: { id: string; nome: string } | null;
  respContabil: { id: string; nome: string } | null;
  respDp: { id: string; nome: string } | null;
  respSocietario: { id: string; nome: string } | null;
  fiscal: { regimeTributario: RegimeTributario | null } | null;
  _count: {
    eventos: number;
    tarefas: number;
  };
  pendencias?: number;
  risco?: "ok" | "warn" | "danger";
}

// ── Filtros da listagem de empresas ────────────────────────────
export interface FiltrosEmpresa {
  q?: string;
  status?: StatusEmpresa;
  regimeTributario?: RegimeTributario;
  municipio?: string;
  respFiscalId?: string;
  respContabilId?: string;
  respDpId?: string;
  minhaCarteira?: boolean;
  emRisco?: boolean;
  comPendencias?: boolean;
  obsCritica?: boolean;
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDir?: "asc" | "desc";
}

// ── Obrigação instância com contexto ───────────────────────────
export interface ObrigacaoComContexto {
  id: string;
  competencia: string;
  status: StatusObrigacao;
  dataConclusao: Date | null;
  observacao: string | null;
  responsavel: { id: string; nome: string } | null;
  obrigacaoEmpresa: {
    empresa: { id: string; razaoSocial: string; codigoInterno: string };
    template: {
      nome: string;
      setor: { nome: string };
      diaVencimento: number | null;
      vencimentoMesSeguinte: boolean;
    };
  };
}

// ── Resultado paginado genérico ─────────────────────────────────
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ── Labels de exibição ──────────────────────────────────────────
export const STATUS_EMPRESA_LABEL: Record<StatusEmpresa, string> = {
  CADASTRO_INCOMPLETO: "Cadastro incompleto",
  IMPLANTACAO: "Implantação",
  ATIVA: "Ativa",
  EM_ATENCAO: "Em atenção",
  INATIVA: "Inativa",
  ENCERRADA: "Encerrada",
  EX_CLIENTE: "Ex-cliente",
};

export const REGIME_LABEL: Record<RegimeTributario, string> = {
  MEI: "MEI",
  SIMPLES_NACIONAL: "Simples Nacional",
  LUCRO_PRESUMIDO: "Lucro Presumido",
  LUCRO_REAL: "Lucro Real",
  CARNE_LEAO: "Carnê-Leão",
  ISENTO: "Isento",
  OUTRO: "Outro",
};

export const STATUS_OBRIGACAO_LABEL: Record<StatusObrigacao, string> = {
  NAO_INICIADO: "Não iniciado",
  EM_ANDAMENTO: "Em andamento",
  AGUARDANDO_CLIENTE: "Aguardando cliente",
  RECEBIDO_PARCIALMENTE: "Recebido parcialmente",
  RECEBIDO: "Recebido",
  ENVIADO: "Enviado",
  CONCLUIDO: "Concluído",
  NAO_SE_APLICA: "Não se aplica",
  EM_ATRASO: "Em atraso",
};

export const STATUS_EVENTO_LABEL: Record<StatusEvento, string> = {
  NAO_INICIADO: "Não iniciado",
  EM_ANDAMENTO: "Em andamento",
  AGUARDANDO_CLIENTE: "Aguardando cliente",
  AGUARDANDO_ORGAO: "Aguardando órgão público",
  AGUARDANDO_SETOR: "Aguardando outro setor",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};

export const STATUS_TAREFA_LABEL: Record<StatusTarefa, string> = {
  NAO_INICIADO: "Não iniciado",
  EM_ANDAMENTO: "Em andamento",
  AGUARDANDO_CLIENTE: "Aguardando cliente",
  AGUARDANDO_ORGAO: "Aguardando órgão público",
  AGUARDANDO_SETOR: "Aguardando outro setor",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};
