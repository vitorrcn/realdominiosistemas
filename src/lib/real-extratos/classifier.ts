// Motor de classificação contábil (decide débito/crédito de cada
// lançamento) + extração de fornecedores a partir de um balancete em PDF.
// Porte de `Classifier`, `parse_balancete_fornecedores` e
// `match_fornecedor` do app.py original.
//
// Bug corrigido durante o porte: o app.py original chamava duas funções
// (`_normalizar_nome` e `_palavras_significativas`) que eram usadas mas
// NUNCA foram definidas em lugar nenhum do arquivo — ou seja, a função
// "fornecedores do balancete" quebrava com NameError sempre que alguém
// selecionava um PDF de balancete (o erro era engolido por um
// `except Exception: pass` no chamador, então na prática o recurso nunca
// funcionou). Aqui as duas foram reconstruídas com base no que o resto do
// código já documentava sobre sua função (normalizar nome sem acento e
// sem sufixo genérico de empresa) para o recurso funcionar de verdade.

import { extractPageLines } from "./pdfText";
import type { Fornecedor, Lancamento, RegraClassificacao, Transacao } from "./tipos";

// Sufixos genéricos de razão social que não ajudam a identificar o
// fornecedor (removidos ao montar as keywords de busca).
const SUFIXOS_GENERICOS = new Set([
  "LTDA", "ME", "EPP", "EIRELI", "SA", "S/A", "S.A", "MEI", "EI",
  "COMERCIO", "COMERCIAL", "INDUSTRIA", "INDUSTRIAL", "DE", "DA", "DO", "DOS", "DAS", "E",
]);

function normalizarNome(nome: string): string {
  const semAcento = nome
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  return semAcento
    .replace(/[.,/\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function palavrasSignificativas(nomeNorm: string): string[] {
  return nomeNorm
    .split(" ")
    .filter((p) => p.length >= 2 && !SUFIXOS_GENERICOS.has(p));
}

/**
 * Lê o balancete e extrai fornecedores com a conta contábil associada.
 * Gera keywords do mais específico (nome completo) para o menos
 * específico, permitindo casar mesmo quando o extrato abrevia o nome.
 */
export async function parseBalanceteFornecedores(buffer: Buffer): Promise<Fornecedor[]> {
  const fornecedores: Fornecedor[] = [];
  let allLines: string[];
  try {
    allLines = (await extractPageLines(buffer)).flat();
  } catch {
    return fornecedores;
  }

  let inFornecedores = false;
  for (let line of allLines) {
    line = line.trim();
    if (!line) continue;

    if (/\bFORNECEDORES\b/i.test(line)) { inFornecedores = true; continue; }

    if (
      inFornecedores &&
      /^\s*\[?\d+\]?\s*(OBRIGAÇÕES TRABALHISTAS|OBRIGAÇÕES TRIBUTARIAS|SALÁRIOS A PAGAR|PATRIMÔNIO|RECEITAS|DESPESAS|CLIENTES PF|ADIANTAMENTO A EMPREGADOS)\b/i.test(line)
    ) {
      inFornecedores = false;
      continue;
    }

    if (!inFornecedores) continue;

    let conta: string, nome: string;
    let m = line.match(/\[(\d+)\]\s*(.+?)\s+[\d.]+,\d{2}[CD]/);
    if (m) {
      conta = m[1];
      nome = m[2].replace(/\s+/g, " ").trim();
    } else {
      const m2 = line.match(/^\s*(\d{3,6})\s+([A-Z].{4,60}?)\s+[\d.]+,\d{2}[CD]/);
      if (!m2) continue;
      conta = m2[1];
      nome = m2[2].replace(/\s+/g, " ").trim();
    }

    if (nome.length < 4) continue;

    const nomeNorm = normalizarNome(nome);
    const palavras = palavrasSignificativas(nomeNorm);
    if (!palavras.length) continue;

    const keywords: string[] = [];

    const nomeSemSufixo = palavras.join(" ");
    if (nomeSemSufixo.length >= 4) keywords.push(nomeSemSufixo);

    for (let n = Math.min(palavras.length, 5); n >= 1; n--) {
      const kw = palavras.slice(0, n).join(" ");
      if (kw.length >= 4 && !keywords.includes(kw)) keywords.push(kw);
    }

    const nomeTodas = normalizarNome(nome);
    if (!keywords.includes(nomeTodas) && nomeTodas.length >= 4) keywords.push(nomeTodas);

    if (palavras.length >= 2) {
      const abrev = palavras.slice(0, 5).map((p) => p[0]).join("");
      if (abrev.length >= 3 && !keywords.includes(abrev)) keywords.push(abrev);
    }

    fornecedores.push({ nome, nome_norm: nomeNorm, conta, keywords: [...new Set(keywords)] });
  }

  fornecedores.sort((a, b) => b.nome.length - a.nome.length);
  return fornecedores;
}

/**
 * Busca o fornecedor cuja keyword mais longa bate na descrição do
 * lançamento (mínimo 4 caracteres, sempre como palavra inteira).
 */
export function matchFornecedor(descUpper: string, fornecedores: Fornecedor[]): Fornecedor | null {
  const descNorm = descUpper
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let best: Fornecedor | null = null;
  let bestLen = 0;

  for (const forn of fornecedores) {
    for (const kw of forn.keywords) {
      if (kw.length < 4) continue;
      const pattern = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
      if (pattern.test(descNorm) && kw.length > bestLen) {
        best = forn;
        bestLen = kw.length;
      }
    }
  }
  return best;
}

export interface ClassifierConfig {
  conta_banco: string;
  conta_receita: string;
  conta_socio: string;
  conta_despesas: string;
  conta_padrao: string;
  nome_socio: string;
  rules: RegraClassificacao[];
  fornecedores?: Fornecedor[];
}

export class Classifier {
  private contaBanco: string;
  private contaReceita: string;
  private contaSocio: string;
  private contaDespesas: string;
  private contaPadrao: string;
  private nomeSocio: string;
  private rules: RegraClassificacao[];
  private fornecedores: Fornecedor[];

  constructor(cfg: ClassifierConfig) {
    this.contaBanco = cfg.conta_banco;
    this.contaReceita = cfg.conta_receita;
    this.contaSocio = cfg.conta_socio;
    this.contaDespesas = cfg.conta_despesas;
    this.contaPadrao = cfg.conta_padrao;
    this.nomeSocio = (cfg.nome_socio || "").toUpperCase();
    this.rules = cfg.rules;
    this.fornecedores = cfg.fornecedores ?? [];
  }

  classify(txn: Transacao): [string, string, string, Lancamento["origem"]] {
    const desc = txn.description.toUpperCase();
    const isDebit = txn.is_debit;

    // ── REGRA 1: regras personalizadas do usuário. A conta do banco é
    // SEMPRE preservada; a regra só define a contrapartida.
    const rulesOrdenadas = [...this.rules].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    for (const rule of rulesOrdenadas) {
      const kw = (rule.keyword || "").toUpperCase();
      if (kw && desc.includes(kw)) {
        if (rule.conta_debito && rule.conta_credito) {
          if (isDebit) return [rule.conta_debito, this.contaBanco, "REGRA", "rule"];
          return [this.contaBanco, rule.conta_credito, "REGRA", "rule"];
        }
      }
    }

    // ── REGRA 2: fornecedores do balancete (só desta importação)
    if (this.fornecedores.length && isDebit) {
      const forn = matchFornecedor(desc, this.fornecedores);
      if (forn?.conta) {
        return [forn.conta, this.contaBanco, `FORNECEDOR: ${forn.nome.slice(0, 20)}`, "fornecedor"];
      }
    }

    // ── REGRA 3: classificações automáticas globais (comportamento, não banco)
    const KEYWORDS_TARIFA = ["TARIFA", "TAR ", "IOF", "ENCARGO", "CPMF", "ANUIDADE", "TRANSF PGTO PIX", "CESTA", "MANUTENCAO", "MANUTENÇÃO"];
    if (isDebit && KEYWORDS_TARIFA.some((k) => desc.includes(k))) {
      return [this.contaDespesas, this.contaBanco, "TARIFA BANCÁRIA", "builtin"];
    }

    const KEYWORDS_CARTAO = ["RECEBIMENTO REDE", "RECEBIMENTO CIELO", "RECEBIMENTO GETNET", "RECEBIMENTO REDECARD", "RECEBIMENTO VENDAS", "RECEBIMENTO STONE", "RECEBIMENTO VENDA", "CREDITO REDE", "CREDITO CIELO"];
    if (!isDebit && KEYWORDS_CARTAO.some((k) => desc.includes(k))) {
      return [this.contaBanco, this.contaReceita, "RECEITA CARTÃO", "builtin"];
    }

    const KEYWORDS_PIX_ENTRADA = ["PIX QRS", "PIX QR CODE", "PIX RECEBIDO", "RECEBIMENTO PIX", "PIX | MAQUININHA", "TRANSFERENCIA RECEBIDA", "TRANSFERENCIA PIX", "TRANSFERÊNCIA RECEBIDA", "TRANSFERÊNCIA RECEBIDA PELO PIX"];
    if (!isDebit && KEYWORDS_PIX_ENTRADA.some((k) => desc.includes(k))) {
      return [this.contaBanco, this.contaReceita, "RECEITA PIX", "builtin"];
    }

    const KEYWORDS_RENDIMENTO = ["RENTAB", "RENDIMENTO", "REND ", "JUROS CRED"];
    if (!isDebit && KEYWORDS_RENDIMENTO.some((k) => desc.includes(k))) {
      return [this.contaBanco, this.contaPadrao, "RENDIMENTO", "builtin"];
    }

    // Siglas curtas (CDB, LCI, LCA) precisam de \b — sem isso "LCA" bate
    // dentro de sobrenomes como "CAVALCANTI" (CAVA-LCA-NTI).
    const KEYWORDS_APLICACAO_SIGLA = ["CDB", "LCI", "LCA"];
    const KEYWORDS_APLICACAO_TEXTO = ["APLICACAO", "APLICAÇÃO", "RESGATE", "INVEST FACIL", "INVESTIMENTO"];
    const bateAplicacao =
      KEYWORDS_APLICACAO_SIGLA.some((k) => new RegExp(`\\b${k}\\b`).test(desc)) ||
      KEYWORDS_APLICACAO_TEXTO.some((k) => desc.includes(k));
    if (bateAplicacao) {
      if (isDebit) return [this.contaPadrao, this.contaBanco, "APLICAÇÃO/RESGATE", "builtin"];
      return [this.contaBanco, this.contaPadrao, "APLICAÇÃO/RESGATE", "builtin"];
    }

    const KEYWORDS_BOLETO = ["BOLETO PAGO", "PAGAMENTO DE BOLETO", "PAG BOLETO", "PAGTO ELETRON COBRANCA", "PAGTO ELETRONICO", "PAGAMENTO ELETRONICO", "BOLETO", "COBRANCA"];
    if (isDebit && KEYWORDS_BOLETO.some((k) => desc.includes(k))) {
      return [this.contaPadrao, this.contaBanco, "BOLETO/PAGAMENTO", "builtin"];
    }

    const KEYWORDS_EMPRESTIMO = ["DEBITO SEGURO", "DÉBITO SEGURO", "PARCELA GIRO", "PARCELA", "EMPRESTIMO", "EMPRÉSTIMO", "OPERACAO CAPITAL", "OPERAÇÃO CAPITAL"];
    if (isDebit && KEYWORDS_EMPRESTIMO.some((k) => desc.includes(k))) {
      return [this.contaPadrao, this.contaBanco, "EMPRÉSTIMO", "builtin"];
    }

    const KEYWORDS_TRANSF_SAIDA = ["PIX ENVIADO", "TRANSFERENCIA PIX", "TRANSFERÊNCIA PIX", "TRANSFERENCIA ENVIADA", "TRANSFERÊNCIA ENVIADA", "TED", "DOC ", "PAGAMENTOS PIX", "TRANSF CC"];
    if (isDebit && KEYWORDS_TRANSF_SAIDA.some((k) => desc.includes(k))) {
      return [this.contaPadrao, this.contaBanco, "TRANSFERÊNCIA", "builtin"];
    }

    // ── REGRA 5: fallback — conta padrão
    if (isDebit) return [this.contaPadrao, this.contaBanco, "NÃO CLASSIFICADO", "padrao"];
    return [this.contaBanco, this.contaPadrao, "NÃO CLASSIFICADO", "padrao"];
  }
}
