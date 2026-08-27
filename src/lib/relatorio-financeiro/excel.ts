// Leitura e estruturação do Excel "Banco de Dados" — porte fiel de
// ler_excel()/estruturar()/agrupar() do relatorio_financeiro.py original.
//
// Bug corrigido no porte: o filtro de "grupos principais" original exigia
// código inteiro MAIOR que zero (`int(f)>0`), o que fazia o código "0"
// (nesta planilha de exemplo: "Empréstimos e Financiamentos") nunca
// aparecer nas tabelas de categoria — mesmo estando na lista de códigos
// que a tabela de Transferências deveria mostrar ([0,94,95,98,99]). O
// valor já entrava certo no total do Fluxo de Caixa Final (que soma por
// código direto, sem passar por "grupos principais"), só sumia da tabela
// detalhada. Trocado para `>= 0`.
import * as XLSX from "xlsx";
import type { CategoriaEncontrada, EstruturaRelatorio, GrupoTempo, ModoVisao } from "./tipos";

export function mesIdx(col: string): number {
  const m = col.match(/^(\d{2})\/(\d{4})$/);
  if (!m) return 0;
  return parseInt(m[2], 10) * 100 + parseInt(m[1], 10);
}

/** Acha a aba de nome contendo "relat" (ex.: "Relatório"); senão, a última aba. */
export function lerExcel(buffer: Buffer): any[][] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  let sheetName = wb.SheetNames.find((s) => /relat/i.test(s));
  if (!sheetName) sheetName = wb.SheetNames[wb.SheetNames.length - 1];
  const ws = wb.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true }) as any[][];
}

function paraNumero(v: any): number {
  if (typeof v === "number") return v;
  const n = parseFloat(String(v ?? "0").trim().replace(",", "."));
  return isNaN(n) ? 0 : n;
}

/**
 * Normaliza um código de categoria pra string canônica: "1" -> "1",
 * "1.0" -> "1", "13.10" -> "13.1", "7.7 " -> "7.7". NUNCA usa rstrip num
 * código inteiro (ex.: "10".replace(/0+$/,"") daria "1" — bug clássico) —
 * por isso o código inteiro é tratado num caminho totalmente separado do
 * código decimal.
 */
export function normalizarCodigo(rawIn: string): string {
  const raw = rawIn.trim();
  const f = parseFloat(raw.replace(",", "."));
  if (isNaN(f)) return raw;
  if (f === Math.trunc(f)) {
    return String(Math.trunc(f));
  }
  let cod = raw.replace(/0+$/, "").replace(/\.$/, "");
  const partes = cod.split(".");
  partes[0] = String(Math.trunc(parseFloat(partes[0])));
  return partes.join(".");
}

export interface EstruturaComHelpers extends EstruturaRelatorio {
  get(cod: string): CategoriaEncontrada | null;
  val(cat: CategoriaEncontrada | null, mes: string): number;
  nome(cod: string): string;
  subcats(grupoCod: string): [string, string][];
}

export function estruturar(rows: any[][], mesIni: string, mesFim: string): EstruturaComHelpers {
  const headerRaw = rows[0] ?? [];

  const todosMeses = headerRaw
    .map((c) => String(c ?? "").trim())
    .filter((c) => /^\d{2}\/\d{4}$/.test(c));

  const iniI = mesIdx(mesIni);
  const fimI = mesIdx(mesFim);
  const mesesDisp = todosMeses.filter((m) => {
    const i = mesIdx(m);
    return iniI <= i && i <= fimI;
  });

  const idxPorMes = new Map<string, number>();
  headerRaw.forEach((c: any, i: number) => {
    const s = String(c ?? "").trim();
    if (/^\d{2}\/\d{4}$/.test(s)) idxPorMes.set(s, i);
  });

  const dataRows: any[][] = [];
  const sumarioRows: any[][] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const col0 = row[0];
    const col1 = row[1];
    const temCodigo = col0 !== null && col0 !== undefined && String(col0).trim() !== "";
    const temLabel = col1 !== null && col1 !== undefined && String(col1).trim() !== "";
    if (temCodigo) dataRows.push(row);
    else if (temLabel) sumarioRows.push(row);
  }

  const catMap = new Map<string, CategoriaEncontrada>();
  for (const row of dataRows) {
    const raw = String(row[0] ?? "").trim();
    const cod = normalizarCodigo(raw);
    const nomeCat = String(row[1] ?? "").trim();
    const valoresPorMes: Record<string, number> = {};
    for (const [mes, idx] of idxPorMes) valoresPorMes[mes] = paraNumero(row[idx]);
    catMap.set(cod, { codigo: cod, nome: nomeCat, valoresPorMes });
  }

  function get(cod: string): CategoriaEncontrada | null {
    if (catMap.has(cod)) return catMap.get(cod)!;
    return catMap.get(normalizarCodigo(cod)) ?? null;
  }
  function val(cat: CategoriaEncontrada | null, mes: string): number {
    return cat ? cat.valoresPorMes[mes] ?? 0 : 0;
  }
  function nome(cod: string): string {
    const r = get(cod);
    return r ? r.nome : cod;
  }
  function subcats(grupoCod: string): [string, string][] {
    const prefix = grupoCod + ".";
    const subs: [string, string][] = [];
    for (const [cod, cat] of catMap) {
      if (!cod.startsWith(prefix)) continue;
      if (cod.split(".")[0] !== grupoCod) continue;
      if (cod.split(".").length === 2) subs.push([cod, cat.nome]);
    }
    subs.sort((a, b) => {
      const pa = a[0].split(".").map(Number);
      const pb = b[0].split(".").map(Number);
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (d !== 0) return d;
      }
      return 0;
    });
    return subs;
  }

  // Sumário (linhas sem código — "Entradas", "Saídas", "Resultado" etc.)
  const sumario: Record<string, number> = {};
  const sumarioMensal: Record<string, Record<string, number>> = {};
  for (const row of sumarioRows) {
    const label = String(row[1] ?? "").trim();
    if (!label || label === "nan" || label === "None" || label === "Composição de Saldo") continue;
    const valsMes: Record<string, number> = {};
    for (const [mes, idx] of idxPorMes) {
      const n = paraNumero(row[idx]);
      if (n !== 0) valsMes[mes] = n;
    }
    if (Object.keys(valsMes).length > 0) {
      sumarioMensal[label] = valsMes;
      sumario[label] = Object.values(valsMes).reduce((a, b) => a + b, 0);
    } else {
      sumario[label] = paraNumero(row[2]);
    }
  }

  // Grupos principais: código inteiro >= 0 (ver comentário de correção no topo)
  const gruposPrincipais: { codigo: number; codigoStr: string; nome: string }[] = [];
  for (const [cod, cat] of catMap) {
    const f = parseFloat(cod);
    if (!isNaN(f) && f === Math.trunc(f) && f >= 0) {
      gruposPrincipais.push({ codigo: Math.trunc(f), codigoStr: cod, nome: cat.nome });
    }
  }
  gruposPrincipais.sort((a, b) => a.codigo - b.codigo);

  return { mesesDisp, todosMeses, catMap, gruposPrincipais, sumario, sumarioMensal, get, val, nome, subcats };
}

export function agrupar(mesesDisp: string[], modo: ModoVisao): GrupoTempo[] {
  if (modo === "mensal") return mesesDisp.map((m) => ({ label: m, meses: [m] }));
  const grupos = new Map<string, string[]>();
  const ordem: string[] = [];
  for (const m of mesesDisp) {
    const [numStr, ano] = m.split("/");
    const num = parseInt(numStr, 10);
    const key = modo === "trimestral" ? `T${Math.floor((num - 1) / 3) + 1}/${ano}` : ano;
    if (!grupos.has(key)) {
      grupos.set(key, []);
      ordem.push(key);
    }
    grupos.get(key)!.push(m);
  }
  return ordem.map((k) => ({ label: k, meses: grupos.get(k)! }));
}
