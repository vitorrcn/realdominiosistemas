import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, "");
  if (d.length === 14)
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return cnpj;
}

export function formatCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, "");
  if (d.length === 11)
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return cpf;
}

export function competenciaAtual(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

export function formatCompetencia(comp: string): string {
  const [ano, mes] = comp.split("-");
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${meses[Number(mes) - 1]}/${ano}`;
}

export function formatData(data: Date | string | null | undefined): string {
  if (!data) return "—";
  const d = typeof data === "string" ? new Date(data) : data;
  // Usa UTC de propósito: essas datas são "só o dia" (sem hora de verdade),
  // guardadas como meia-noite UTC. Se usássemos fuso local, datas como
  // 01/01/2009 podiam "virar" 31/12/2008 dependendo do fuso do servidor.
  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  const ano = d.getUTCFullYear();
  return `${dia}/${mes}/${ano}`;
}

export function diasAte(data: Date | string | null | undefined): number | null {
  if (!data) return null;
  const d = typeof data === "string" ? new Date(data) : data;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - hoje.getTime()) / 86_400_000);
}

/**
 * Calcula a data de vencimento de uma obrigação a partir da competência
 * ("AAAA-MM") e da configuração do template (dia do mês + se vence no mês
 * seguinte). Retorna null se o template não tem dia de vencimento definido.
 * Função pura (sem I/O) — usada tanto no servidor quanto no client. Usa
 * UTC de propósito (mesmo motivo do formatData) — assim o "dia" calculado
 * é o mesmo independente do fuso de onde o código roda.
 */
export function calcularVencimento(
  competencia: string,
  diaVencimento: number | null | undefined,
  vencimentoMesSeguinte: boolean
): Date | null {
  if (!diaVencimento) return null;
  const [ano, mes] = competencia.split("-").map(Number);
  const mesVencimento = vencimentoMesSeguinte ? mes + 1 : mes; // pode passar de 12 e virar o ano, o Date lida com isso
  return new Date(Date.UTC(ano, mesVencimento - 1, diaVencimento));
}
