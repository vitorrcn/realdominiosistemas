// Parsers de extrato bancário em PDF, portados 1:1 do app desktop original
// (app.py, Python + pdfplumber) para TypeScript + pdfjs-dist.
//
// Cada parser recebe o PDF (Buffer) e devolve a lista de transações
// detectadas. A lógica de cada um (regex, colunas por coordenada X,
// palavras-chave de layout) foi mantida fiel ao original — inclusive os
// comentários que explicam PORQUÊ cada regra existe (normalmente fruto de
// um bug real encontrado num extrato de verdade).
//
// Dois trechos do app.py original eram código morto (ficavam DEPOIS do
// "return" de verdade da função, então nunca executavam em produção) e
// por isso não foram portados: um bloco duplicado do parser do Inter
// dentro de `parse_itau_v2`, e um bloco duplicado do parser da Stone
// dentro de `parse_santander_internet_banking`.

import { extractLines, extractPageLines, extractPageWords, groupRowsByGap, bucketRows, type Word } from "./pdfText";
import { parseValorBR, fixMojibake } from "./util";
import type { Transacao, ParserId } from "./tipos";

function rowText(row: Word[]): string {
  return row.map((w) => w.text).join(" ").trim();
}

function colText(row: Word[], test: (x0: number) => boolean): string {
  return row.filter((w) => test(w.x0)).map((w) => w.text).join(" ").trim();
}

// ─── Itaú Empresas ──────────────────────────────────────────────────────
export async function parseItauEmpresas(buffer: Buffer): Promise<Transacao[]> {
  const X_DATA = 32, X_LANC = 116, X_AG = 289, X_VALOR = 427, X_SALDO = 517, TOL = 18;
  const SKIP = [
    "SALDO ANTERIOR", "SDO CTA/APL", "S A L D O", "SALDO",
    "Data Lançamento", "ItaúEmpresas", "Nome:", "Data:", "Horário:",
    "Extrato de", "Ag./Origem", "Valor (R$)", "Saldo (R$)",
  ];
  const shouldSkip = (line: string) => SKIP.some((s) => line.includes(s));

  let ctxYear: string | null = null;
  const transactions: Transacao[] = [];

  const pages = await extractPageWords(buffer);
  for (const words of pages) {
    for (const row of bucketRows(words, 3)) {
      const line = rowText(row);

      const mExt = line.match(/Extrato de \d{2}\/\d{2}\/(\d{4})/);
      if (mExt) { ctxYear = mExt[1]; continue; }
      const mDat = line.match(/Data:\s*\d{2}\/\d{2}\/(\d{4})/);
      if (mDat && !ctxYear) { ctxYear = mDat[1]; continue; }

      if (shouldSkip(line) || !ctxYear) continue;

      const colData = colText(row, (x0) => Math.abs(x0 - X_DATA) < TOL);
      const colLanc = colText(row, (x0) => x0 >= X_LANC - TOL && x0 < X_AG - TOL);
      const colValor = colText(row, (x0) => x0 >= X_VALOR - TOL && x0 < X_SALDO - TOL);

      if (!/^\d{1,2}\/\d{2}$/.test(colData)) continue;
      if (!colValor || !/^-?[\d.]+,\d{2}$/.test(colValor)) continue;
      if (!colLanc || shouldSkip(colLanc)) continue;

      const [d, m] = colData.split("/");
      const date = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${ctxYear}`;
      const isNeg = colValor.startsWith("-");
      const value = Math.abs(parseValorBR(colValor));
      if (!isNaN(value) && value > 0) {
        transactions.push({ date, description: colLanc, value, is_debit: isNeg });
      }
    }
  }
  return transactions;
}

// ─── Itaú extrato mensal PF/PJ (colunas entradas/saídas) ───────────────
export async function parseItauMensalPf(buffer: Buffer): Promise<Transacao[]> {
  const X_DATA = 150, X_DESC = 208, X_ENT = 370, X_SAI = 430, X_SALDO = 520, TOL = 22;
  const MESES_MAP: Record<string, string> = {
    jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
    jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
  };
  const SKIP = [
    "extratomensal", "Conta Corrente", "Movimentação", "entradas R$", "saídas R$",
    "saldo R$", "créditos", "débitos", "Saldo anterior", "SALDO APLIC", "SALDO DIA",
    "A =", "B =", "C =", "D =", "G =", "P =", "Para demais", "Explicativas",
    "Este material", "pelaBolsa", "totalizador", "Aplic Aut", "Res Aplic", "Apl Aplic",
    "Cheque Especial", "Aplicações Automáticas", "movimentação - aplic", "resumo - mês",
    "histórico", "principal", "bruto", "líquido", "data aplicações", "Notas explicativas",
    "Conta Corrente|", "Minha conta", "01. Conta", "saldo em", "entradas (créditos)",
    "saídas (débitos)", "Depósitos", "Transferências", "Saldo final", "Saldo em C/C",
    "B001A", "265204", "total", "Outras", "(créditos)", "(débitos)",
  ].map((s) => s.toLowerCase());
  const shouldSkip = (line: string) => !line.trim() || SKIP.some((s) => line.toLowerCase().includes(s));

  let ctxMonth = "01", ctxYear = "2025";
  const allRows: [string, string, string, string, string, string][] = [];

  const pages = await extractPageWords(buffer);
  for (let pgIdx = 0; pgIdx < pages.length; pgIdx++) {
    const words = pages[pgIdx];
    const pageTextLower = words.map((w) => w.text).join(" ").toLowerCase();
    if (pageTextLower.includes("aplicações automáticas") && pageTextLower.includes("aplic aut mais") && pgIdx > 0) {
      break;
    }
    for (const row of bucketRows(words, 3)) {
      const line = rowText(row);

      const mMy = line.match(/(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+(\d{4})/i);
      if (mMy) {
        ctxMonth = MESES_MAP[mMy[1].toLowerCase()] ?? ctxMonth;
        ctxYear = mMy[2];
      }

      if (shouldSkip(line)) continue;

      const colData = colText(row, (x0) => Math.abs(x0 - X_DATA) < TOL);
      const colDesc = colText(row, (x0) => x0 >= X_DESC - TOL && x0 < X_ENT - TOL);
      const colEnt = colText(row, (x0) => x0 >= X_ENT - TOL && x0 < X_SAI - TOL);
      const colSai = colText(row, (x0) => x0 >= X_SAI - TOL && x0 < X_SALDO - TOL);

      if (colDesc) allRows.push([colData, colDesc, colEnt, colSai, ctxMonth, ctxYear]);
    }
  }

  const transactions: Transacao[] = [];
  let currentDate: string | null = null;

  for (const [colData, colDesc, colEnt, colSai, , year] of allRows) {
    if (/^\d{1,2}\/\d{2}$/.test(colData)) {
      const [d, m] = colData.split("/");
      currentDate = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${year}`;
    }
    if (!currentDate) continue;

    if (colEnt && /^[\d.]+,\d{2}$/.test(colEnt)) {
      const val = Math.abs(parseValorBR(colEnt));
      if (val > 0) transactions.push({ date: currentDate, description: colDesc, value: val, is_debit: false });
    } else if (colSai && /^[\d.]+,\d{2}-$/.test(colSai)) {
      const val = Math.abs(parseValorBR(colSai.replace(/-$/, "")));
      if (val > 0) transactions.push({ date: currentDate, description: colDesc, value: val, is_debit: true });
    }
  }
  return transactions;
}

// ─── Itaú Empresas — layout mensal "DD / mês" ───────────────────────────
export async function parseItauMensal(buffer: Buffer): Promise<Transacao[]> {
  const MESES_NUM: Record<string, number> = {
    janeiro: 1, fevereiro: 2, "março": 3, marco: 3, abril: 4, maio: 5, junho: 6,
    julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
    jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
  };
  const SKIP = [
    "SALDO ANTERIOR", "SALDO TOTAL", "SALDO DA CONTA", "LANÇAMENTOS FUTUROS",
    "LANÇAMENTOS PERÍODO", "SALDO DISPONÍVEL", "LIMITE DA CONTA", "DATA LANÇAMENTOS",
    "AG/ORIGEM", "VALOR (R$)", "SALDO (R$)", "EM CASO DE DÚVIDAS", "SAC ",
    "OUVIDORIA", "FALE CONOSCO", "DEFICIENTE", "ATUALIZADO EM", "AVISO:",
    "SALDO EM APLIC", "VALOR TOTAL", "RENDIMENTOS", "TOTAL DISPONÍVEL",
    "DESCRIÇÃO VALOR", "SALDO DISPONÍVEL SEM", "OPÇÕES",
  ];
  const reLinha = /^(\d{1,2})\s*\/\s*(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+(.+?)\s+(-?[\d.]+,\d{2})\s*$/i;
  const reAno = /^(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+(\d{4})$/i;
  const shouldSkip = (line: string) => { const u = line.toUpperCase(); return SKIP.some((s) => u.includes(s)); };

  const allLines = await extractLines(buffer);
  const transactions: Transacao[] = [];
  let currentYear: string | null = null;

  for (let line of allLines) {
    line = line.trim();
    if (!line || shouldSkip(line)) continue;

    const mAno = line.match(reAno);
    if (mAno) { currentYear = mAno[2]; continue; }

    const m = line.match(reLinha);
    if (!m || !currentYear) continue;

    const day = parseInt(m[1], 10);
    const mes = MESES_NUM[m[2].toLowerCase()] ?? 0;
    const desc = m[3].trim();
    const valStr = m[4];
    if (!mes) continue;

    const isNeg = valStr.startsWith("-");
    const value = Math.abs(parseValorBR(valStr));
    if (value > 0) {
      transactions.push({
        date: `${String(day).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${currentYear}`,
        description: desc, value, is_debit: isNeg,
      });
    }
  }
  return transactions;
}

// ─── Itaú — "Lançamentos do período" ────────────────────────────────────
export async function parseItauPeriodo(buffer: Buffer): Promise<Transacao[]> {
  const START_KEYWORDS = new Set([
    "COMPRA", "PIX", "RENDIMENTOS", "PAGAMENTOS", "BOLETO", "TED", "TAR",
    "IOF", "JUROS", "CONS", "RSCCS", "BUSINESS", "SALDO", "RECEBIMENTO",
    "TARIFA", "APLICACAO", "APLICAÇÃO", "RESGATE", "ESTORNO", "DEVOLUCAO",
    "DEVOLUÇÃO", "CREDITO", "CRÉDITO", "DEBITO", "DÉBITO",
  ]);
  const MONEY_RE = /^-?\d{1,3}(?:\.\d{3})*,\d{2}$/;
  const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;
  const CNPJCPF_RE = /^\d{2,3}(\.\d{3}){1,2}[/-]\d{0,4}-?\d{2}$/;

  type Aberto = { date: string | null; value: number | null; is_debit: boolean | null; descParts: string[] };
  const txns: Transacao[] = [];
  let openTxn: Aberto | null = null;

  function flushOpen() {
    if (openTxn) {
      const desc = openTxn.descParts.join(" ").replace(/\s+/g, " ").trim();
      if (desc && openTxn.value) {
        txns.push({ date: openTxn.date!, description: desc, value: openTxn.value, is_debit: !!openTxn.is_debit });
      }
    }
    openTxn = null;
  }

  const pages = await extractPageWords(buffer);
  let inSection = false;
  for (const words of pages) {
    for (const row of groupRowsByGap(words, 4)) {
      const fullText = row.map((w) => w.text).join(" ");

      if (fullText.startsWith("Data Lançamentos")) { inSection = true; continue; }
      if (fullText.startsWith("Saldo da conta corrente") || fullText.includes("Lançamentos futuros")) {
        inSection = false; flushOpen(); continue;
      }
      if (!inSection) continue;

      let dateTok: string | null = null;
      const moneyToks: [number, string][] = [];
      const descWords: string[] = [];
      for (const w of row) {
        const t = w.text, x0 = w.x0;
        if (x0 < 60 && DATE_RE.test(t)) dateTok = t;
        else if (MONEY_RE.test(t) && x0 > 400) moneyToks.push([x0, t]);
        else if (CNPJCPF_RE.test(t)) { /* ignora */ }
        else if (x0 >= 60) descWords.push(t);
      }

      if (fullText.includes("SALDO TOTAL") || fullText.includes("SALDO ANTERIOR")) { flushOpen(); continue; }

      const firstWord = descWords[0] ? descWords[0].toUpperCase() : null;
      if (firstWord && START_KEYWORDS.has(firstWord)) {
        flushOpen();
        openTxn = { date: null, value: null, is_debit: null, descParts: [] };
      }

      if (descWords.length) {
        if (!openTxn) openTxn = { date: null, value: null, is_debit: null, descParts: [] };
        openTxn.descParts.push(descWords.join(" "));
      }

      if (dateTok && moneyToks.length && openTxn) {
        moneyToks.sort((a, b) => a[0] - b[0]);
        const valStr = moneyToks[0][1];
        openTxn.date = dateTok;
        openTxn.value = Math.abs(parseValorBR(valStr));
        openTxn.is_debit = valStr.startsWith("-");
      }
    }
  }
  flushOpen();
  return txns;
}

// ─── Itaú PJ — 5 colunas (débito/crédito pelo sinal) ───────────────────
export async function parseItauV2(buffer: Buffer): Promise<Transacao[]> {
  const SKIP = [
    "SALDO TOTAL", "SALDO ANTERIOR", "Data Lançamentos", "Lançamentos do período",
    "Saldo total", "aviso:", "atualizado em", "Em caso de dúvidas",
    "SAC ", "Ouvidoria", "Fale Conosco", "Deficiente", "CNPJ/CPF",
    "Valor (R$)", "Agência", "Limite da conta",
  ];
  const reCnpj = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/;
  const reCpf = /\d{3}\.\d{3}\.\d{3}-\d{2}/;

  const isDateLine = (s: string) => /^\d{2}\/\d{2}\/\d{4}/.test(s.trim());
  const isSubcodeLine = (s: string) => /^[A-Z]{2}\d{10}\b/.test(s.trim());
  const isRedeDescLine = (s: string) => /^RECEBIMENTO REDE/.test(s.trim());
  const extractDoc = (s: string): [string, string] => {
    let m = s.match(reCnpj);
    if (m) return [m[0], (s.slice(0, m.index) + s.slice((m.index ?? 0) + m[0].length)).trim()];
    m = s.match(reCpf);
    if (m) return [m[0], (s.slice(0, m.index) + s.slice((m.index ?? 0) + m[0].length)).trim()];
    return ["", s];
  };

  const allLines = await extractLines(buffer);
  const transactions: Transacao[] = [];
  const n = allLines.length;
  let i = 0;

  while (i < n) {
    const raw = allLines[i].trim();
    if (!raw || SKIP.some((s) => raw.includes(s))) { i += 1; continue; }

    // Padrão A: RECEBIMENTO REDE (3 linhas)
    if (isRedeDescLine(raw)) {
      const lancamento = raw.includes("  ") ? raw.split("  ")[0].trim() : raw.trim();
      const razao = raw.slice(lancamento.length).trim();
      let j = i + 1;
      while (j < n && !allLines[j].trim()) j += 1;
      if (j < n && isDateLine(allLines[j])) {
        const m = allLines[j].trim().match(/^(\d{2}\/\d{2}\/\d{4})\s+(.*)/);
        if (m) {
          const dateStr = m[1];
          const rest = m[2].trim();
          const valM = rest.match(/(-?[\d.]+,\d{2})$/);
          if (valM) {
            const valueStr = valM[1];
            const [doc] = extractDoc(rest.slice(0, valM.index).trim());
            let k = j + 1;
            while (k < n && !allLines[k].trim()) k += 1;
            let razaoFull: string;
            if (k < n && isSubcodeLine(allLines[k])) {
              const razaoExtra = allLines[k].trim().replace(/^[A-Z]{2}\d{10}\s*/, "").trim();
              razaoFull = razao ? `${razao} ${razaoExtra}`.trim() : razaoExtra;
              i = k + 1;
            } else {
              razaoFull = razao;
              i = j + 1;
            }
            const parts = [lancamento, razaoFull, doc].filter(Boolean);
            const description = parts.join(" - ");
            const isNeg = valueStr.startsWith("-");
            const value = Math.abs(parseValorBR(valueStr));
            transactions.push({ date: dateStr, description, value, is_debit: isNeg });
            continue;
          }
        }
      }
      i += 1;
      continue;
    }

    // Padrão B: linha com data na frente
    if (isDateLine(raw)) {
      const m = raw.match(/^(\d{2}\/\d{2}\/\d{4})\s+(.*)/);
      if (m) {
        const dateStr = m[1];
        const rest = m[2].trim();
        if (rest.toUpperCase().includes("SALDO")) { i += 1; continue; }
        const valM = rest.match(/(-?[\d.]+,\d{2})$/);
        if (valM) {
          const valueStr = valM[1];
          const mid = rest.slice(0, valM.index).trim();
          const [doc, midSemDocRaw] = extractDoc(mid);
          const midSemDoc = midSemDocRaw.replace(/\s+/g, " ").trim();
          let description: string;
          if (midSemDoc.startsWith("RECEBIMENTO REDE")) {
            const partsDesc = midSemDoc.split(/\s{2,}/);
            const lancamento = partsDesc[0].trim();
            let razao = partsDesc.length > 1 ? partsDesc[1].trim() : "";
            let k = i + 1;
            while (k < n && !allLines[k].trim()) k += 1;
            if (k < n && isSubcodeLine(allLines[k])) {
              const razaoExtra = allLines[k].trim().replace(/^[A-Z]{2}\d{10}\s*/, "").trim();
              razao = razao ? `${razao} ${razaoExtra}`.trim() : razaoExtra;
              i = k + 1;
            } else {
              i += 1;
            }
            const parts = [lancamento, razao, doc].filter(Boolean);
            description = parts.join(" - ");
          } else {
            let midFinal = midSemDoc;
            if (["BOLETO PAGO", "PIX ENVIADO", "PAGAMENTO DE BOLETO"].includes(midSemDoc)) {
              const prev = i > 0 ? allLines[i - 1].trim() : "";
              if (
                prev && !isDateLine(prev) && !isSubcodeLine(prev) &&
                !SKIP.some((s) => prev.includes(s)) && !isRedeDescLine(prev)
              ) {
                midFinal = `${midSemDoc} ${prev}`;
              }
            }
            const parts = [midFinal, doc].filter(Boolean);
            description = parts.join(" - ");
            i += 1;
          }
          const isNeg = valueStr.startsWith("-");
          const value = Math.abs(parseValorBR(valueStr));
          if (description && value > 0) {
            transactions.push({ date: dateStr, description, value, is_debit: isNeg });
          }
          continue;
        }
      }
      i += 1;
      continue;
    }

    i += 1;
  }

  return transactions;
}

// ─── Inter — layout "Extrato Conta Corrente" (5 colunas) ────────────────
export async function parseInterCc(buffer: Buffer): Promise<Transacao[]> {
  const X_DATA = 234, X_TIPO = 310, X_DESC = 385, X_VALOR = 461, TOL = 18;
  const SKIP_LINES = ["Data Lan", "Extrato Conta", "Conta 7", "PerÃ", "Saldo ", "HistÃ", "DescriÃ", "Valor Saldo"];
  const shouldSkip = (line: string) => SKIP_LINES.some((s) => line.includes(s));
  const fixEncoding = (s: string) => fixMojibake(s).trim();

  const transactions: Transacao[] = [];
  const pages = await extractPageWords(buffer);
  for (const words of pages) {
    for (const row of bucketRows(words, 3)) {
      const line = rowText(row);
      if (!line || shouldSkip(line)) continue;

      const colData = colText(row, (x0) => Math.abs(x0 - X_DATA) < TOL);
      const colTipo = colText(row, (x0) => x0 >= X_TIPO - TOL && x0 < X_DESC - TOL);
      const colDesc = colText(row, (x0) => x0 >= X_DESC - TOL && x0 < X_VALOR - TOL);
      const colValor = colText(row, (x0) => Math.abs(x0 - X_VALOR) < TOL);

      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(colData)) continue;
      if (!colValor || !/^-?[\d.]+,\d{2}$/.test(colValor)) continue;

      const tipoClean = fixEncoding(colTipo);
      const descClean = fixEncoding(colDesc);
      const description = descClean ? `${tipoClean} - ${descClean}`.replace(/^[\s-]+|[\s-]+$/g, "") : tipoClean;

      const isNeg = colValor.startsWith("-");
      const value = Math.abs(parseValorBR(colValor));
      if (value > 0) {
        transactions.push({ date: colData, description, value, is_debit: isNeg });
      }
    }
  }
  return transactions;
}

// ─── Inter — layout com "Tipo: descrição R$ valor" ─────────────────────
export async function parseInter(buffer: Buffer): Promise<Transacao[]> {
  const MESES: Record<string, number> = {
    Janeiro: 1, Fevereiro: 2, "Março": 3, Abril: 4, Maio: 5, Junho: 6,
    Julho: 7, Agosto: 8, Setembro: 9, Outubro: 10, Novembro: 11, Dezembro: 12,
  };
  const SKIP = [
    "Fale com a gente", "SAC:", "Ouvidoria", "Solicitado", "CPF/CNPJ",
    "Período", "Saldo total", "bloqueado", "disponível", "Valor Saldo",
    "Instituição", "Agência", "Deficiência",
  ];

  const allLines = await extractLines(buffer);
  const transactions: Transacao[] = [];
  let currentDate: string | null = null;

  for (let line of allLines) {
    line = line.trim();
    if (!line || SKIP.some((k) => line.includes(k))) continue;

    const dateM = line.match(/^(\d{1,2}) de (\w+) de (\d{4})/);
    if (dateM) {
      const day = parseInt(dateM[1], 10);
      const month = MESES[dateM[2]] ?? 0;
      const year = parseInt(dateM[3], 10);
      if (month) currentDate = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
      continue;
    }

    if (!currentDate) continue;

    const amounts = [...line.matchAll(/(-?)R\$\s*([\d.]+,\d{2})/g)];
    if (!amounts.length) continue;

    const [, sinal, valueStr] = amounts[0];
    const value = parseValorBR(valueStr);
    if (isNaN(value)) continue;

    let description: string;
    const quotedM = line.match(/^(.+?):\s+"(.+?)"\s+-?R\$/);
    if (quotedM) {
      const tipo = quotedM[1].trim();
      let descRaw = quotedM[2].trim();
      descRaw = descRaw.replace(/^Cp\s*:\d{8,9}-/, "").trim();
      descRaw = descRaw.replace(/^\d{5}\s+\d+\s+/, "").trim();
      description = `${tipo}: ${descRaw}`;
    } else {
      description = line.replace(/\s+-?R\$.*$/, "").trim();
      if (description.includes("Saldo")) continue;
    }

    transactions.push({ date: currentDate, description, value, is_debit: sinal === "-" });
  }
  return transactions;
}

// ─── Cora ────────────────────────────────────────────────────────────────
export async function parseCora(buffer: Buffer): Promise<Transacao[]> {
  const SKIP = [
    "Saldo inicial", "Total de entradas", "Total de saídas", "Saldo final",
    "Transações", "Extrato do período", "Extrato gerado", "Ouvidoria",
    "Agência:", "Saldo do dia",
  ];
  const shouldSkip = (line: string) => {
    if (line.startsWith("Cora SCFI")) return true;
    return SKIP.some((s) => line.includes(s));
  };
  const reDateSaldo = /^(\d{2}\/\d{2}\/\d{4})\s+Saldo do dia/;
  const reTxn = /^(.+?)\s+([+-])\s+R\$\s+([\d.]+,\d{2})$/;

  const allLines: { top: number; line: string }[] = [];
  const pages = await extractPageWords(buffer);
  for (const words of pages) {
    for (const row of bucketRows(words, 3)) {
      const top = row[0]?.top ?? 0;
      allLines.push({ top, line: rowText(row) });
    }
  }

  const transactions: Transacao[] = [];
  let currentDate: string | null = null;
  let i = 0;
  const n = allLines.length;

  while (i < n) {
    const { top, line } = allLines[i];

    const mDate = line.match(reDateSaldo);
    if (mDate) { currentDate = mDate[1]; i += 1; continue; }

    if (shouldSkip(line) || !currentDate) { i += 1; continue; }

    const mTxn = line.match(reTxn);
    if (mTxn) {
      const tipo = mTxn[1].trim();
      const sinal = mTxn[2];
      const valStr = mTxn[3];
      const isNeg = sinal === "-";

      let beneficiario = "";
      if (i + 1 < n) {
        const { top: nextTop, line: nextLine } = allLines[i + 1];
        if (nextTop - top <= 6 && !shouldSkip(nextLine) && !reTxn.test(nextLine)) {
          beneficiario = nextLine.replace(/\s+\d{2,3}[\d./-]+\d{2}$/, "").trim();
          beneficiario = beneficiario.replace(/…$/, "").trim();
          i += 1;
        }
      }

      const description = beneficiario ? `${tipo} - ${beneficiario}`.replace(/^[\s-]+|[\s-]+$/g, "") : tipo;
      const value = parseValorBR(valStr);
      if (!isNaN(value) && value > 0) {
        transactions.push({ date: currentDate, description, value, is_debit: isNeg });
      }
    }
    i += 1;
  }
  return transactions;
}

// ─── Caixa ───────────────────────────────────────────────────────────────
export async function parseCaixa(buffer: Buffer): Promise<Transacao[]> {
  const SKIP = [
    "GeRen ciador", "Extrato por período", "Cliente:", "Conta:", "Data:",
    "Mês:", "Período:", "Extrato", "Data Mov.", "SALDO ANTERIOR",
    "SALDO DIA", "https://", "SAC CAIXA", "Pessoas com", "Ouvidoria",
    "Alô CAIXA", "* 661",
  ];
  const allLines = await extractLines(buffer);
  const transactions: Transacao[] = [];

  for (let line of allLines) {
    line = line.trim();
    if (!line || SKIP.some((k) => line.includes(k))) continue;

    const m = line.match(/^(\d{2}\/\d{2}\/\d{4})\s+(\d+)\s+(.+?)\s+([\d.]+,\d{2})\s+([DC])\s+[\d.]+,\d{2}\s+[DC]$/);
    if (!m) continue;

    const dateStr = m[1];
    const historico = m[3].trim();
    const valueStr = m[4];
    const dc = m[5];

    if (historico.includes("RESG AUT") || historico.includes("SALDO")) continue;

    const value = parseValorBR(valueStr);
    if (isNaN(value)) continue;

    transactions.push({ date: dateStr, description: historico, value, is_debit: dc === "D" });
  }
  return transactions;
}

// ─── Bradesco ────────────────────────────────────────────────────────────
export async function parseBradesco(buffer: Buffer): Promise<Transacao[]> {
  const SKIP_TEXT = [
    "SALDO ANTERIOR", "Folha ", "Extrato Mensal", "JAMIL TRANSPORTES",
    "Nome do usuário", "Data da operação", "Data Lançamento", "Agência | Conta",
    "Extrato de:", "Os dados acima", "Últimos Lançamentos", "Saldos Invest",
    "SALDO INVEST", "bradesco", "net empresa", "Crédito (R$)", "06632",
    "Débito (R$)", "Saldo (R$)", "Total ",
  ];
  const shouldSkip = (t: string) => SKIP_TEXT.some((s) => t.includes(s));

  type Linha = [string, string, string]; // data, lanc, vals
  const allLines: Linha[] = [];

  const pages = await extractPageWords(buffer);
  for (const words of pages) {
    const buckets = new Map<number, { data: [number, string][]; lanc: [number, string][]; vals: [number, string][] }>();
    for (const w of words) {
      const top = Math.round(w.top / 3) * 3;
      if (!buckets.has(top)) buckets.set(top, { data: [], lanc: [], vals: [] });
      const b = buckets.get(top)!;
      if (w.x0 < 100) b.data.push([w.x0, w.text]);
      else if (w.x0 < 262) b.lanc.push([w.x0, w.text]);
      else b.vals.push([w.x0, w.text]);
    }
    for (const top of [...buckets.keys()].sort((a, b) => a - b)) {
      const b = buckets.get(top)!;
      const d = b.data.sort((a, c) => a[0] - c[0]).map((x) => x[1]).join(" ").trim();
      const l = b.lanc.sort((a, c) => a[0] - c[0]).map((x) => x[1]).join(" ").trim();
      const v = b.vals.sort((a, c) => a[0] - c[0]).map((x) => x[1]).join(" ").trim();
      allLines.push([d, l, v]);
    }
  }

  const transactions: Transacao[] = [];
  let currentDate: string | null = null;
  const n = allLines.length;

  for (let idx = 0; idx < n; idx++) {
    const [dataStr, lancStr, valsStr] = allLines[idx];
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataStr)) currentDate = dataStr;

    if (dataStr.toUpperCase() === "TOTAL") continue;
    if (!currentDate || shouldSkip(lancStr) || shouldSkip(dataStr)) continue;

    const valNums = [...valsStr.matchAll(/-?[\d.]+,\d{2}/g)].map((m) => m[0]);
    if (valNums.length < 2) continue;
    const valueStr = valNums[valNums.length - 2];

    let tipo = "";
    if (idx > 0) {
      const [, prevLanc] = allLines[idx - 1];
      if (prevLanc && !shouldSkip(prevLanc) && !prevLanc.toUpperCase().includes("SALDO")) tipo = prevLanc;
    }
    if (lancStr && !shouldSkip(lancStr) && lancStr !== tipo) {
      tipo = tipo ? `${tipo} ${lancStr}`.trim() : lancStr;
    }

    let beneficiario = "";
    if (idx + 1 < n) {
      const [, nextLanc, nextVals] = allLines[idx + 1];
      const nextValNums = [...nextVals.matchAll(/-?[\d.]+,\d{2}/g)];
      if (nextLanc && !shouldSkip(nextLanc) && nextValNums.length < 2 && !nextLanc.toUpperCase().includes("SALDO")) {
        beneficiario = nextLanc;
      }
    }

    let desc = tipo && beneficiario ? `${tipo}: ${beneficiario}` : (tipo || beneficiario);
    desc = desc.replace(/\s+/g, " ").trim();

    if (!desc || desc.toUpperCase().includes("SALDO") || shouldSkip(desc)) continue;

    const isNeg = valueStr.startsWith("-");
    const value = Math.abs(parseValorBR(valueStr));
    if (!isNaN(value) && value > 0) {
      transactions.push({ date: currentDate, description: desc, value, is_debit: isNeg });
    }
  }
  return transactions;
}

// ─── Sicoob ──────────────────────────────────────────────────────────────
export async function parseSicoob(buffer: Buffer): Promise<Transacao[]> {
  const SKIP = [
    "SICOOB", "SISTEMA DE", "PLATAFORMA", "EXTRATO CONTA", "COOP.:",
    "CONTA:", "PERÍODO:", "HISTÓRICO DE", "DATA HISTÓRICO", "SALDO ANTERIOR",
    "SALDO BLOQ", "SALDO DO DIA", "RESUMO", "SALDO EM CONTA", "CHEQUE ESPECIAL",
    "JUROS", "TARIFAS", "SALDO DISPONÍVEL", "SALDO BLOQUEADO", "ENCARGOS",
    "VENCIMENTO", "TAXA", "CUSTO EFETIVO", "EXTRATOS EMITIDOS", "SAC:",
    "OUVIDORIA", "DOC.:", "Pagamento Pix", "Recebimento Pix", "Estorno Pix",
    "CIELO S.A", "***.",
  ];

  const allLines = await extractLines(buffer);
  let year = "2025";
  for (const line of allLines.slice(0, 15)) {
    const m = line.match(/PERÍODO:\s*\d{2}\/\d{2}\/(\d{4})/);
    if (m) { year = m[1]; break; }
  }

  const transactions: Transacao[] = [];
  let i = 0;
  const n = allLines.length;

  while (i < n) {
    const raw = allLines[i].trim();
    if (!raw || SKIP.some((k) => raw.includes(k))) { i += 1; continue; }

    const m1 = raw.match(/^(\d{2}\/\d{2})\s+(.+?)\s+([\d.]+,\d{2})([DC])$/);
    if (m1) {
      const dateStr = `${m1[1]}/${year}`;
      let desc = m1[2].trim();
      const valueStr = m1[3];
      const dc = m1[4];
      if (i + 1 < n) {
        const nxt = allLines[i + 1].trim();
        if (nxt && !/^\d{2}\/\d{2}/.test(nxt) && !nxt.includes("DOC.:") && !SKIP.some((k) => nxt.includes(k))) {
          desc = `${desc}: ${nxt}`;
          i += 1;
        }
      }
      const value = parseValorBR(valueStr);
      if (!isNaN(value)) transactions.push({ date: dateStr, description: desc, value, is_debit: dc === "D" });
      i += 1;
      continue;
    }

    const m2 = raw.match(/^(\d{2}\/\d{2})\s+(.+?)\s+([\d.]+,\d{2})$/);
    if (m2) {
      const dateStr = `${m2[1]}/${year}`;
      const desc = m2[2].trim();
      const valueStr = m2[3];
      let dc: string | null = null;
      if (i + 1 < n && ["D", "C"].includes(allLines[i + 1].trim())) {
        dc = allLines[i + 1].trim();
        i += 1;
      }
      if (dc === null) { i += 1; continue; }
      const value = parseValorBR(valueStr);
      if (!isNaN(value)) transactions.push({ date: dateStr, description: desc, value, is_debit: dc === "D" });
      i += 1;
      continue;
    }

    i += 1;
  }
  return transactions;
}

// ─── Banco do Brasil ─────────────────────────────────────────────────────
export async function parseBb(buffer: Buffer): Promise<Transacao[]> {
  const SKIP = [
    "Extrato de Conta", "Cliente", "Agência:", "Lançamentos",
    "Dia Lote", "Total Aplicações", "* Saldos", "Sujeitos a",
    "Saldo Anterior", "Saldo do dia", "S A L D O", "00/00/0000",
  ];

  const allLines = await extractLines(buffer);
  const transactions: Transacao[] = [];
  const n = allLines.length;
  let i = 0;
  let currentDate: string | null = null;
  let pendingTipo: string | null = null;

  while (i < n) {
    const raw = allLines[i].trim();
    if (!raw || SKIP.some((k) => raw.includes(k))) { i += 1; continue; }

    const dateM = raw.match(/^(\d{2}\/\d{2}\/\d{4})\s*(.*)$/);
    if (dateM && !/[\d.]+,\d{2}/.test(raw)) {
      currentDate = dateM[1];
      const tipoRest = dateM[2].trim();
      pendingTipo = tipoRest || null;
      i += 1;
      continue;
    }

    const valM = raw.match(/([\d.]+,\d{2})\s*\(([+-])\)\s*$/);
    if (valM && currentDate) {
      const valueStr = valM[1];
      const sign = valM[2];
      let descPart = raw.slice(0, valM.index).trim();
      descPart = descPart.replace(/^\d{5}\s+\d+\s+/, "").trim();
      descPart = descPart.replace(/^\d{5}\s+/, "").trim();

      let description: string;
      if (pendingTipo && descPart) description = `${pendingTipo}: ${descPart}`;
      else if (pendingTipo) description = pendingTipo;
      else description = descPart;
      description = description.replace(/\s+/g, " ").trim();
      pendingTipo = null;

      if (i + 1 < n) {
        const nxt = allLines[i + 1].trim();
        if (
          nxt && !/^\d{2}\/\d{2}\/\d{4}/.test(nxt) &&
          !/[\d.]+,\d{2}\s*\([+-]\)/.test(nxt) &&
          !SKIP.some((k) => nxt.includes(k)) &&
          !/^\d{5}\s/.test(nxt)
        ) {
          description = `${description}: ${nxt}`;
          i += 1;
        }
      }

      const value = parseValorBR(valueStr);
      if (!isNaN(value) && description && value > 0) {
        transactions.push({ date: currentDate, description, value, is_debit: sign === "-" });
      }
      i += 1;
      continue;
    }

    if (currentDate && !/^\d{2}\/\d{2}\/\d{4}/.test(raw) && !/[\d.]+,\d{2}/.test(raw)) {
      pendingTipo = raw;
    }

    i += 1;
  }
  return transactions;
}

// ─── Santander (layout simples) ─────────────────────────────────────────
export async function parseSantander(buffer: Buffer): Promise<Transacao[]> {
  const IGNORE = [
    "APLICACAO CONTAMAX", "RESGATE CONTAMAX",
    "SALDO EM", "Saldos por Período",
    "Extrato_PJ", "BALP_UY", "Pagina:",
    "Data Descrição", "Créditos Débitos",
    "Movimentação", "Conta Corrente",
  ];
  const STOP = [
    "Saldos por Período", "Créditos Contratados", "Investimentos",
    "ContaMax Empresarial", "Posição Consolidada", "Pacote de Serviços",
    "Índices Econômicos", "Você e Seu",
  ];

  let year = "2025";
  let inSection = false;
  const txnLines: string[] = [];

  for (const line of await extractLines(buffer)) {
    const raw = line.trim();
    const m = raw.match(
      /(?:janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\/(\d{4})/i
    );
    if (m) year = m[1];
    if (raw === "Movimentação") { inSection = true; continue; }
    if (inSection && STOP.some((k) => raw.includes(k))) { inSection = false; continue; }
    if (inSection) txnLines.push(raw);
  }

  const transactions: Transacao[] = [];
  let currentDate: string | null = null;
  let i = 0;
  const n = txnLines.length;

  while (i < n) {
    let raw = txnLines[i];
    if (!raw || IGNORE.some((k) => raw.includes(k))) { i += 1; continue; }

    const dateM = raw.match(/^(\d{2}\/\d{2})\s+(.*)/);
    if (dateM) {
      currentDate = `${dateM[1]}/${year}`;
      raw = dateM[2].trim();
    }
    if (!currentDate) { i += 1; continue; }

    const valM = raw.match(/\b([\d.]+,\d{2})(-?)\s*$/);
    if (!valM) { i += 1; continue; }

    const valueStr = valM[1];
    const isDebit = valM[2] === "-";
    let desc = raw.slice(0, valM.index).trim();

    if (/[\d.]+,\d{2}/.test(desc) && !/[A-Za-z]/.test(desc)) { i += 1; continue; }

    desc = desc.replace(/\s+\d{6,}\s*$/, "").trim();
    desc = desc.replace(/\s+-\s*$/, "").trim();

    if (i + 1 < n) {
      const nxt = txnLines[i + 1].trim();
      if (
        nxt && !/^\d{2}\/\d{2}/.test(nxt) && !/[\d.]+,\d{2}/.test(nxt) &&
        !IGNORE.some((k) => nxt.includes(k)) && nxt.length > 2
      ) {
        desc = desc ? `${desc}: ${nxt}` : nxt;
        i += 1;
      }
    }

    desc = desc.replace(/\s+/g, " ").trim();
    const value = parseValorBR(valueStr);
    if (!isNaN(value) && desc && value > 0) {
      transactions.push({ date: currentDate, description: desc, value, is_debit: isDebit });
    }
    i += 1;
  }
  return transactions;
}

// ─── Santander PJ — "Extrato Consolidado Inteligente" ──────────────────
export async function parseSantanderConsolidadoPj(buffer: Buffer): Promise<Transacao[]> {
  const SKIP_SNIPPETS = ["Extrato_PJ", "BALP_UY", "Pagina:", "EXTRATOCONSOLIDADOINTELIGENTE", "Fale Conosco", "Central de Atendimento", "SAC -", "Ouvidoria"];
  const STOP_MARKERS = [
    "Saldos por Período", "Créditos Contratados", "ContaMax Empresarial",
    "Posição Consolidada", "Pacote de Serviços", "Índices Econômicos",
    "Você e Seu", "Débito Automático em Conta", "Comprovantes de Pagamento",
    "Transferências entre Contas",
  ];

  let year = "2025";
  const txns: Transacao[] = [];
  let pendingDate: string | null = null;
  let current: Transacao | null = null;
  const bounds: { desc?: number; doc?: number; cred?: number; deb?: number } = {};
  let inSection = false;

  function flush() {
    if (current && current.value) txns.push(current);
    current = null;
  }

  const pages = await extractPageWords(buffer);
  for (const words of pages) {
    for (const row of groupRowsByGap(words, 4)) {
      const texts = row.map((w) => w.text);
      const fullText = texts.join(" ");

      const ym = fullText.match(
        /(?:janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\/(\d{4})/i
      );
      if (ym) year = ym[1];

      if (texts.includes("Descrição") && (texts.includes("Nº") || texts.includes("Documento"))) {
        bounds.desc = row.find((w) => w.text === "Descrição")!.x0;
        bounds.doc = row.find((w) => w.text === "Nº" || w.text === "Documento")!.x0;
        continue;
      }
      if (texts.includes("Créditos") && texts.includes("Débitos")) {
        bounds.cred = row.find((w) => w.text === "Créditos")!.x0;
        bounds.deb = row.find((w) => w.text === "Débitos")!.x0;
        continue;
      }

      if (fullText.trim() === "Movimentação") { inSection = true; continue; }
      if (STOP_MARKERS.some((m) => fullText.includes(m))) { inSection = false; continue; }
      if (!inSection || bounds.cred === undefined) continue;
      if (SKIP_SNIPPETS.some((s) => fullText.includes(s))) continue;
      if (fullText.trim().startsWith("SALDO EM")) continue;

      const bDoc = (bounds.desc! + bounds.doc!) / 2 + 15;
      const bCred = (bounds.doc! + bounds.cred!) / 2 + 15;
      const bDeb = (bounds.cred! + bounds.deb!) / 2;
      const bSal = bounds.deb! + 45;

      let dateW: string | null = null;
      const descWords: string[] = [];
      let credito: string | null = null;
      let debito: string | null = null;
      for (const w of row) {
        const x0 = w.x0, t = w.text;
        if (x0 < 60 && /^\d{2}\/\d{2}$/.test(t)) dateW = t;
        else if (x0 < bDoc) descWords.push(t);
        else if (x0 < bCred) { /* Nº Documento */ }
        else if (x0 < bDeb) credito = t;
        else if (x0 < bSal) debito = t;
      }

      if (dateW) pendingDate = `${dateW}/${year}`;

      if (credito !== null || debito !== null) {
        flush();
        const desc = descWords.join(" ").trim();
        const valueStr = credito ?? debito!;
        const isDebit = debito !== null;
        const value = parseFloat(valueStr.replace(/\./g, "").replace(",", ".").replace(/-$/, ""));
        if (pendingDate && desc && value) {
          current = { date: pendingDate, description: desc, value, is_debit: isDebit };
        }
      } else if (current && descWords.length) {
        current.description = (current.description + " " + descWords.join(" ")).trim();
      }
    }
  }
  flush();
  return txns;
}

// ─── Santander — Internet Banking Empresarial ───────────────────────────
export async function parseSantanderInternetBanking(buffer: Buffer): Promise<Transacao[]> {
  const SKIP_EXACT = new Set(["Data Histórico Documento Valor (R$) Saldo (R$)", "Consultar", "Internet Banking Empresarial"]);
  const SKIP_CONTAINS = ["Agência:", "Conta Corrente >", "Opção de Pesquisa", "Períodos:"];
  const STOP_MARKERS = ["a = Bloqueio Dia", "Posição em:", "Saldo Valor (R$)"];
  const LINE_RE = /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(\d{6})\s+(-?\d[\d.]*,\d{2})(?:\s+(\d[\d.]*,\d{2}))?$/;

  const txns: Transacao[] = [];
  let stop = false;
  const pageLines = await extractPageLines(buffer);
  for (const lines of pageLines) {
    if (stop) break;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (STOP_MARKERS.some((mk) => line.includes(mk))) { stop = true; break; }
      if (SKIP_EXACT.has(line) || SKIP_CONTAINS.some((s) => line.includes(s))) continue;
      if (line.includes("SALDO ANTERIOR")) continue;

      const m = line.match(LINE_RE);
      if (!m) continue;
      const [, date, descRaw, , valStr] = m;
      const isDebit = valStr.startsWith("-");
      const value = Math.abs(parseValorBR(valStr));
      const desc = descRaw.replace(/\s+/g, " ").trim();
      if (desc && value) txns.push({ date, description: desc, value, is_debit: isDebit });
    }
  }
  return txns;
}

// ─── Nubank ──────────────────────────────────────────────────────────────
export async function parseNubank(buffer: Buffer): Promise<Transacao[]> {
  const MESES_PT: Record<string, number> = {
    JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6, JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12,
  };
  const reDate = /^(\d{1,2})\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s+(\d{4})/i;
  const reValor = /^(.+?)\s+([\d.]+,\d{2})\s*$/;
  const reSaida = /(enviada|sa[íi]da|pagamento|tarifa|d[eé]bito|boleto)/i;

  const SKIP_TOKENS = [
    "TEM ALGUMA", "METROPOLITANAS", "CASO A SOLU", "DISPONÍVEIS EM", "DISPONIVEIS EM",
    "EXTRATO GERADO", "MOVIMENTAÇÕES", "ATENDIMENTO 24H", "NUBANK.COM.BR", "0800",
    "OUVIDORIA", "VALORES EM R$", "CNPJ", "AGÊNCIA 0001", "AGENCIA 0001",
    "SALDO INICIAL", "SALDO FINAL", "4020 0185", "RENDIMENTO LÍQUIDO",
    "RENDIMENTO LIQUIDO", "NU FINANCEIRA", "FINANCIAMENTO E INVESTIMENTO",
    "DE NOVEMBRO DE", "DE DEZEMBRO DE", "DE JANEIRO DE", "DE FEVEREIRO DE",
    "DE MARÇO DE", "DE OUTUBRO DE", "DE ABRIL DE", "DE MAIO DE", "DE JUNHO DE",
    "DE JULHO DE", "DE AGOSTO DE", "DE SETEMBRO DE",
  ];
  const shouldSkip = (line: string) => {
    const upper = line.toUpperCase();
    if (SKIP_TOKENS.some((m) => upper.includes(m))) return true;
    if (/^\d+\s+de\s+\d+$/.test(line.trim())) return true;
    return false;
  };
  const limparBeneficiario = (s: string) => {
    s = s.replace(/\s*-\s*[•*]{3}[\d•*./-]+.*$/, "").trim();
    s = s.replace(/\s*-\s*\d{2,3}\.\d{3}\.\d{3}[-/].*$/, "").trim();
    return s.trim();
  };

  const allLines = await extractLines(buffer);
  const transactions: Transacao[] = [];
  let currentDate: string | null = null;

  for (const raw of allLines) {
    const line = raw.trim();
    if (!line || shouldSkip(line)) continue;

    const dm = line.match(reDate);
    if (dm) {
      currentDate = `${String(parseInt(dm[1], 10)).padStart(2, "0")}/${String(MESES_PT[dm[2].toUpperCase()]).padStart(2, "0")}/${dm[3]}`;
      continue;
    }
    if (!currentDate) continue;
    if (/^(Total de|Saldo (do|inicial|final)|Rendimento)/i.test(line)) continue;

    const m = line.match(reValor);
    if (!m) continue;
    const descRaw = m[1].trim();
    const valueStr = m[2];

    let description: string;
    const tipoM = descRaw.match(/^((?:Transferência|Reembolso|Rendimento|Estorno|Aplicação|Resgate|Tarifa|Pagamento|Débito|Crédito)\S*(?:\s+\S+){0,3})\s+(.+)$/i);
    if (tipoM) {
      const tipo = tipoM[1].trim();
      const beneficiario = limparBeneficiario(tipoM[2]);
      description = beneficiario ? `${tipo} - ${beneficiario}` : tipo;
    } else {
      description = descRaw;
    }

    const value = parseValorBR(valueStr);
    if (isNaN(value)) continue;

    transactions.push({ date: currentDate, description, value, is_debit: reSaida.test(descRaw) });
  }
  return transactions;
}

// ─── Unicred ─────────────────────────────────────────────────────────────
export async function parseUnicred(buffer: Buffer): Promise<Transacao[]> {
  const X_DATA = 21, X_DESC = 91, X_VALOR = 390, X_SALDO = 497, TOL = 20, PAGE_H = 600;
  const SKIP = [
    "Extrato", "Período de", "HOSPITAL", "Solicitado por", "Saldo em",
    "Saldo atual", "Total Disponível", "Limite de", "Data Lançamentos", "CENTRAL DE",
    "Lançamentos futuros", "Saldo no final", "Saldo bloqueado", "Tarifas", "Pág.",
    "Coop:", "UNICRED", "14:48", "Juros", "IOF",
  ];
  const shouldSkip = (t: string) => SKIP.some((s) => t.includes(s));

  type Linha = [number, string, string, string]; // yAbs, colData, colDesc, colValor
  const allRows: Linha[] = [];

  const pages = await extractPageWords(buffer);
  for (let pgIdx = 0; pgIdx < pages.length; pgIdx++) {
    for (const row of bucketRows(pages[pgIdx], 3)) {
      const top = row[0]?.top ?? 0;
      const colData = colText(row, (x0) => Math.abs(x0 - X_DATA) < TOL);
      const colDesc = colText(row, (x0) => x0 >= X_DESC - TOL && x0 < X_VALOR - TOL);
      const colValor = colText(row, (x0) => x0 >= X_VALOR - TOL && x0 < X_SALDO - TOL);
      allRows.push([pgIdx * PAGE_H + top, colData, colDesc, colValor]);
    }
  }

  const transactions: Transacao[] = [];
  const n = allRows.length;
  let i = 0;

  while (i < n) {
    const [yAbs, colData, colDesc, colValor] = allRows[i];
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(colData)) { i += 1; continue; }

    const valM = colValor.match(/R\$\s*([\d.]+,\d{2})/);
    if (!valM) { i += 1; continue; }

    const isNeg = colValor.trim().startsWith("-");
    const valStr = valM[1];

    const descParts: string[] = [];
    if (i > 0) {
      const [prevY, prevData, prevDesc] = allRows[i - 1];
      if (yAbs - prevY <= 6 && !/^\d{2}\/\d{2}\/\d{4}$/.test(prevData) && prevDesc && !shouldSkip(prevDesc)) {
        descParts.push(prevDesc);
      }
    }
    if (colDesc && !shouldSkip(colDesc)) descParts.push(colDesc);

    if (i + 1 < n) {
      const [nextY, nextData, nextDesc, nextVal] = allRows[i + 1];
      if (
        nextY - yAbs <= 12 && !/^\d{2}\/\d{2}\/\d{4}$/.test(nextData) &&
        nextDesc && !shouldSkip(nextDesc) && !/R\$\s*[\d.]+,\d{2}/.test(nextVal)
      ) {
        descParts.push(nextDesc);
        i += 1;
      }
    }

    let desc = descParts.join(" ").trim();
    desc = desc.replace(/\s*\(\s*Doc\.:[^)]*\)\s*/, " ").trim();
    desc = desc.replace(/\s+/g, " ").trim().replace(/^[/ ]+|[/ ]+$/g, "");

    if (!desc || shouldSkip(desc)) { i += 1; continue; }

    const value = parseValorBR(valStr);
    if (!isNaN(value) && value > 0) {
      transactions.push({ date: colData, description: desc, value, is_debit: isNeg });
    }
    i += 1;
  }
  return transactions;
}

// ─── Mercado Pago ────────────────────────────────────────────────────────
export async function parseMercadoPago(buffer: Buffer): Promise<Transacao[]> {
  const X_DATA = 40, X_DESC = 89, X_ID = 198, X_VALOR = 295, TOL = 20, PAGE_H = 630;
  const SKIP = [
    "EXTRATO DE CONTA", "VITORI MULT", "CPF/CNPJ", "Periodo:", "De 0",
    "Entradas:", "Saidas:", "Saldo inicial", "Saldo final",
    "DETALHE DOS MOVIMENTOS", "Data Descrição", "DDaattaa", "/209",
    "ID da operação",
  ];
  const isDateMp = (s: string) => /^\d{2}-\d{2}-\d{4}$/.test(s.trim());
  const fmtDateMp = (s: string) => {
    const m = s.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
    return m ? `${m[1]}/${m[2]}/${m[3]}` : null;
  };
  const toFloatMp = (s: string): [number | null, boolean | null] => {
    let t = s.replace(/[R$\s]/g, "").trim();
    const neg = t.startsWith("-");
    t = t.replace(/^-/, "");
    const v = parseFloat(t.replace(/\./g, "").replace(",", "."));
    return isNaN(v) ? [null, null] : [Math.abs(v), neg];
  };

  type Linha = [number, string, string, string, string]; // yAbs, colData, colDesc, colId, valorStr
  const allRows: Linha[] = [];

  const pages = await extractPageWords(buffer);
  for (let pgIdx = 0; pgIdx < pages.length; pgIdx++) {
    for (const row of bucketRows(pages[pgIdx], 3)) {
      const line = rowText(row);
      if (SKIP.some((s) => line.includes(s))) continue;
      const top = row[0]?.top ?? 0;

      const colData = colText(row, (x0) => Math.abs(x0 - X_DATA) < TOL);
      const colDesc = colText(row, (x0) => x0 >= X_DESC - TOL && x0 < X_ID - TOL);
      const colId = colText(row, (x0) => Math.abs(x0 - X_ID) < TOL);
      let valorStr = "";
      for (const w of [...row].sort((a, b) => a.x0 - b.x0)) {
        if (w.x0 >= X_VALOR - TOL && /^-?[\d.]+,\d{2}$/.test(w.text)) { valorStr = w.text; break; }
      }
      allRows.push([pgIdx * PAGE_H + top, colData, colDesc, colId, valorStr]);
    }
  }

  if (!allRows.length) return [];

  const blocks: Linha[][] = [[allRows[0]]];
  for (const row of allRows.slice(1)) {
    const last = blocks[blocks.length - 1];
    if (row[0] - last[last.length - 1][0] >= 20) blocks.push([row]);
    else last.push(row);
  }

  const transactions: Transacao[] = [];
  for (const block of blocks) {
    let anchor: Linha | null = null;
    for (const row of block) {
      const [, data, , id_, val] = row;
      if (isDateMp(data) && /^\d{10,15}$/.test(id_) && val) { anchor = row; break; }
    }
    if (!anchor) {
      for (const row of block) {
        const [, data, , , val] = row;
        if (isDateMp(data) && val) { anchor = row; break; }
      }
    }
    if (!anchor) continue;

    const [, data, , , val] = anchor;
    const date = fmtDateMp(data);
    const [value, isNeg] = toFloatMp(val);
    if (!date || !value) continue;

    const seen = new Set<string>();
    const descParts: string[] = [];
    for (const [, , desc] of block) {
      if (desc && !seen.has(desc) && !/^\d{10,15}$/.test(desc)) {
        seen.add(desc);
        descParts.push(desc);
      }
    }

    const description = descParts.join(" ").trim() || "Mercado Pago";
    transactions.push({ date, description, value, is_debit: !!isNeg });
  }
  return transactions;
}

// ─── Stone ───────────────────────────────────────────────────────────────
export async function parseStone(buffer: Buffer): Promise<Transacao[]> {
  const DATE_RE = /^\d{2}\/\d{2}\/\d{2}$/;
  const MONEY_RE = /^\d{1,3}(?:\.\d{3})*,\d{2}$/;

  type Aberto = { date: string; tipo: string; value: number; is_debit: boolean; descParts: string[] };
  const txns: Transacao[] = [];
  let openTxn: Aberto | null = null;

  function flush() {
    if (openTxn && openTxn.value) {
      const desc = openTxn.descParts.join(" ").replace(/\s+/g, " ").trim();
      txns.push({ date: openTxn.date, description: desc || openTxn.tipo, value: openTxn.value, is_debit: openTxn.is_debit });
    }
    openTxn = null;
  }

  const pages = await extractPageWords(buffer);
  let inSection = false;
  for (const words of pages) {
    for (const row of groupRowsByGap(words, 4)) {
      const fullText = row.map((w) => w.text).join(" ");
      if (fullText.startsWith("DATA TIPO")) { inSection = true; continue; }
      if (!inSection) continue;

      let dateTok: string | null = null;
      let tipoTok: string | null = null;
      const descWords: string[] = [];
      let valorVal: string | null = null;
      for (const w of row) {
        const t = w.text, x0 = w.x0;
        if (x0 < 60 && DATE_RE.test(t)) dateTok = t;
        else if (x0 >= 65 && x0 < 115 && (t === "Entrada" || t === "Saída")) tipoTok = t;
        else if (x0 >= 290 && x0 < 358) { if (MONEY_RE.test(t)) valorVal = t; }
        else if (x0 >= 358) { /* saldo, ignora */ }
        else if (x0 >= 115) descWords.push(t);
      }

      if (dateTok && tipoTok && valorVal) {
        flush();
        const value = parseValorBR(valorVal);
        openTxn = { date: dateTok, tipo: tipoTok, value, is_debit: tipoTok === "Saída", descParts: [...descWords] };
      } else if (descWords.length && openTxn) {
        openTxn.descParts.push(...descWords);
      }
    }
  }
  flush();
  return txns;
}

// ─── Parser universal (fallback para bancos não mapeados) ───────────────
export async function parseUniversal(buffer: Buffer): Promise<Transacao[]> {
  const MESES_ABREV: Record<string, number> = {
    jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
  };
  const SKIP_PHRASES = [
    "SALDO ANTERIOR", "SALDO TOTAL", "SALDO FINAL", "SALDO INICIAL",
    "EM CASO DE DÚVIDAS", "SAC 0800", "OUVIDORIA", "FALE CONOSCO",
    "ATUALIZADO EM", "AVISO:", "DEFICIENTE AUDITIVO", "LANÇAMENTOS FUTUROS",
    "SALDO DA CONTA", "VALOR (R$)", "SALDO (R$)", "DATA LANÇAMENTO",
    "AG/ORIGEM", "LIMITE DA CONTA", "SALDO DISPONÍVEL", "SALDO DISPONIVEL",
    "DESCRIÇÃO", "DESCRICAO", "HISTÓRICO", "HISTORICO", "LANÇAMENTOS", "LANCAMENTOS",
    "EXTRATO", "PERÍODO", "PERIODO", "FOLHA", "PAGINA", "PÁGINA",
  ];
  const shouldSkip = (line: string) => { const u = line.toUpperCase(); return SKIP_PHRASES.some((p) => u.includes(p)); };

  const reValor = /^-?[\d.]+,\d{2}$/;
  const reDateFull = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/;
  const reDateShort = /^(\d{1,2})[/\-.](\d{1,2})$/;
  const reDateItau = /^(\d{1,2})\s*\/\s*(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+(.+?)\s+(-?[\d.]+,\d{2})\s*$/i;
  const reAnoExtenso = /^(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+(\d{4})$/i;

  function tryDate(token: string, year: number | null): string | null {
    let m = token.match(reDateFull);
    if (m) {
      const d = parseInt(m[1], 10), mo = parseInt(m[2], 10);
      let y = parseInt(m[3], 10);
      if (y < 100) y += 2000;
      if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) return `${String(d).padStart(2, "0")}/${String(mo).padStart(2, "0")}/${y}`;
    }
    if (year) {
      m = token.match(reDateShort);
      if (m) {
        const d = parseInt(m[1], 10), mo = parseInt(m[2], 10);
        if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) return `${String(d).padStart(2, "0")}/${String(mo).padStart(2, "0")}/${year}`;
      }
    }
    return null;
  }

  function tryValue(token: string): [number | null, boolean | null] {
    let t = token.replace(/[R$\s]/g, "").trim();
    const neg = t.startsWith("-") || t.endsWith("-");
    t = t.replace(/^-|-$/g, "").replace(/\./g, "").replace(",", ".");
    const v = parseFloat(t);
    if (!isNaN(v) && v > 0) return [v, neg];
    return [null, null];
  }

  const allLines = await extractLines(buffer);
  const transactions: Transacao[] = [];
  let ctxYear: number | null = null;

  for (const line of allLines) {
    if (!line || shouldSkip(line)) continue;

    const mExt = line.trim().match(reAnoExtenso);
    if (mExt) { ctxYear = parseInt(mExt[2], 10); continue; }

    const mY = line.match(/\b(20\d{2})\b/);
    if (mY) ctxYear = parseInt(mY[1], 10);

    const mItau = line.match(reDateItau);
    if (mItau) {
      const day = parseInt(mItau[1], 10);
      const mes = MESES_ABREV[mItau[2].toLowerCase()] ?? 0;
      const desc = mItau[3].trim();
      const valStr = mItau[4];
      if (mes && ctxYear && desc && !shouldSkip(desc)) {
        const isNeg = valStr.startsWith("-");
        const value = Math.abs(parseValorBR(valStr));
        if (value > 0) {
          transactions.push({ date: `${String(day).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ctxYear}`, description: desc, value, is_debit: isNeg });
        }
      }
      continue;
    }

    const tokens = line.split(/\s+/).filter(Boolean);
    if (tokens.length < 3) continue;

    const [val, isNeg] = tryValue(tokens[tokens.length - 1]);
    if (val === null) continue;

    const dateStr = tryDate(tokens[0], ctxYear);
    if (dateStr === null) continue;

    let descTokens = tokens.slice(1, -1);
    if (descTokens.length && reValor.test(descTokens[descTokens.length - 1])) {
      descTokens = descTokens.slice(0, -1);
    }
    const desc = descTokens.join(" ").trim();
    if (!desc || shouldSkip(desc)) continue;

    transactions.push({ date: dateStr, description: desc, value: val, is_debit: !!isNeg });
  }
  return transactions;
}

// ─── Despacho por parserId (usado pela detecção automática de banco) ───
export const PARSERS: Record<ParserId, (buffer: Buffer) => Promise<Transacao[]>> = {
  itau_periodo: parseItauPeriodo,
  itau_empresas: parseItauEmpresas,
  itau_mensal_pf: parseItauMensalPf,
  itau_mensal: parseItauMensal,
  itau_v2: parseItauV2,
  santander_internet_banking: parseSantanderInternetBanking,
  mercado_pago: parseMercadoPago,
  stone: parseStone,
  nubank: parseNubank,
  inter: parseInter,
  inter_cc: parseInterCc,
  cora: parseCora,
  universal: parseUniversal,
  bradesco: parseBradesco,
  santander_consolidado_pj: parseSantanderConsolidadoPj,
  santander: parseSantander,
  bb: parseBb,
  caixa: parseCaixa,
  sicoob: parseSicoob,
  unicred: parseUnicred,
};
