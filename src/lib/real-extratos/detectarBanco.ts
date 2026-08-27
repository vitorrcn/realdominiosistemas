// Portado de detect_bank_from_pdf (app.py original). Lê as primeiras 3
// páginas do PDF e tenta identificar o banco/layout pelo texto. A ORDEM
// das checagens é proposital e foi mantida idêntica ao original: fintechs
// (Grupo 1) sempre antes dos bancos tradicionais (Grupo 2), porque extrato
// de fintech costuma citar bancos tradicionais na descrição de boletos/PIX
// pagos ("Pagamento de conta Itaú Unibanco S.A." etc.) e dispararia a
// checagem solta de "nome do banco em qualquer lugar do texto" primeiro se
// a ordem fosse invertida.

import { extractSampleTextUpper } from "./pdfText";
import type { DeteccaoBanco } from "./tipos";

export async function detectarBanco(buffer: Buffer): Promise<DeteccaoBanco | null> {
  let sample: string;
  try {
    sample = await extractSampleTextUpper(buffer, 3);
  } catch {
    return null;
  }

  // ── Itaú — "Lançamentos do período" (checado ANTES de tudo, GRUPO 0)
  // Esse layout não tem "ITAÚ"/"ITAU" extraível como texto (logo é
  // imagem) — e como descrições de PIX costumam citar "BANCO INTER SA"
  // dezenas de vezes, sem essa checagem vir primeiro o extrato caía como
  // Banco Inter. Marcador: cabeçalhos exclusivos desse template.
  if (
    sample.includes("LANÇAMENTOS DO PERÍODO") &&
    sample.includes("RAZÃO SOCIAL") &&
    sample.includes("CNPJ/CPF")
  ) {
    return { bancoKey: "Itaú", parserId: "itau_periodo", descricao: "Itaú (Lançamentos do período)" };
  }

  // ── GRUPO 1: fintechs / instituições de pagamento ──────────────────
  if (
    sample.includes("INTERNET BANKING EMPRESARIAL") &&
    sample.includes("HISTÓRICO") &&
    sample.includes("DOCUMENTO")
  ) {
    return {
      bancoKey: "Santander",
      parserId: "santander_internet_banking",
      descricao: "Santander (Internet Banking Empresarial)",
    };
  }

  if (
    sample.includes("MERCADO PAGO") ||
    (sample.includes("EXTRATO DE CONTA") && sample.includes("DETALHE DOS MOVIMENTOS"))
  ) {
    return { bancoKey: "Mercado Pago", parserId: "mercado_pago", descricao: "Mercado Pago" };
  }

  if (sample.includes("STONE INSTITUIÇÃO DE PAGAMENTO") || sample.includes("MEAJUDA@STONE")) {
    return { bancoKey: "Stone", parserId: "stone", descricao: "Stone Instituição de Pagamento" };
  }

  if (
    sample.includes("NUBANK") ||
    sample.includes("NU PAGAMENTOS") ||
    sample.includes("NU FINANCEIRA") ||
    sample.includes("NUBANK.COM")
  ) {
    return { bancoKey: "Nubank", parserId: "nubank", descricao: "Nubank" };
  }

  if (sample.includes("INTER") && (sample.includes("BANCO INTER") || sample.includes("CONTA DIGITAL") || sample.includes("INTER S.A."))) {
    return { bancoKey: "Inter", parserId: "inter", descricao: "Banco Inter" };
  }
  if (sample.includes("EXTRATO CONTA CORRENTE") && sample.includes("PIX RECEBIDO")) {
    return { bancoKey: "Inter", parserId: "inter_cc", descricao: "Banco Inter" };
  }

  if (sample.includes("CORA SCFI") || sample.includes("CORA S.A") || sample.includes("CORA SOCIEDADE")) {
    return { bancoKey: "Cora", parserId: "cora", descricao: "Cora" };
  }

  if (sample.includes("XP INVESTIMENTOS") || sample.includes("XP INC") || sample.includes("XP S.A")) {
    return { bancoKey: "XP", parserId: "universal", descricao: "XP Investimentos" };
  }

  if (sample.includes("C6 BANK") || sample.includes("C6 S.A")) {
    return { bancoKey: "C6", parserId: "universal", descricao: "C6 Bank" };
  }

  // ── GRUPO 2: bancos tradicionais ────────────────────────────────────
  const isItau =
    sample.includes("ITAÚ") ||
    sample.includes("ITAU") ||
    sample.includes("ITAU UNIBANCO") ||
    sample.includes("BANCO ITAU") ||
    (sample.includes("RAZÃO SOCIAL") && sample.includes("REDECARD")) ||
    (sample.includes("LANÇAMENTOS DO PERÍODO") && sample.includes("SALDO TOTAL DISPONÍVEL DIA")) ||
    sample.includes("ITAUEMPRESAS") ||
    sample.includes("ITAÚEMPRESAS") ||
    sample.includes("AG./ORIGEM");

  if (isItau) {
    if (sample.includes("AG./ORIGEM") && sample.includes("SDO CTA/APL")) {
      return { bancoKey: "Itaú", parserId: "itau_empresas", descricao: "Itaú Empresas" };
    }
    if (sample.includes("ENTRADAS R$") && sample.includes("SAÍDAS R$") && sample.includes("CONTA CORRENTE")) {
      return { bancoKey: "Itaú", parserId: "itau_mensal_pf", descricao: "Itaú" };
    }
    if (sample.includes("LANÇAMENTOS PERÍODO") || sample.includes("SISPAG")) {
      return { bancoKey: "Itaú", parserId: "itau_mensal", descricao: "Itaú" };
    }
    return { bancoKey: "Itaú", parserId: "itau_v2", descricao: "Itaú" };
  }

  if (
    sample.includes("BRADESCO") ||
    sample.includes("BANCO BRADESCO") ||
    (sample.includes("EXTRATO DE: AG:") && sample.includes("DATA LANÇAMENTO DCTO.")) ||
    (sample.includes("EXTRATO DE: AG:") && sample.includes("PAGTO ELETRON COBRANCA")) ||
    (sample.includes("DATA LANÇAMENTO DCTO.") && sample.includes("PAGTO ELETRON COBRANCA"))
  ) {
    return { bancoKey: "Bradesco", parserId: "bradesco", descricao: "Bradesco" };
  }

  if (sample.includes("SANTANDER")) {
    const semEspacos = sample.replace(/ /g, "");
    if (semEspacos.includes("EXTRATOCONSOLIDADOINTELIGENTE") || semEspacos.includes("CONTAMAX")) {
      return {
        bancoKey: "Santander",
        parserId: "santander_consolidado_pj",
        descricao: "Santander PJ (Consolidado Inteligente)",
      };
    }
    return { bancoKey: "Santander", parserId: "santander", descricao: "Santander" };
  }

  if (sample.includes("BANCO DO BRASIL") || sample.includes("BB CORPORATE")) {
    return { bancoKey: "Banco do Brasil", parserId: "bb", descricao: "Banco do Brasil" };
  }

  if (sample.includes("CAIXA ECONÔMICA") || sample.includes("CAIXA ECONOMICA") || sample.includes("CAIXA S.A")) {
    return { bancoKey: "Caixa", parserId: "caixa", descricao: "Caixa Econômica Federal" };
  }

  if (sample.includes("SICOOB") || sample.includes("COOPERATIVA DE CRÉDITO")) {
    return { bancoKey: "Sicoob", parserId: "sicoob", descricao: "Sicoob" };
  }

  if (
    sample.includes("UNICRED") ||
    (sample.includes("CRED DOM") && sample.includes("ARRANJO CREDITO") && sample.includes("LIQUIDACAO DE TITULO"))
  ) {
    return { bancoKey: "Unicred", parserId: "unicred", descricao: "Unicred" };
  }

  return null;
}
