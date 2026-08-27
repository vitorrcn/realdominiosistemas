// Utilitário de extração de texto/posição de PDF para o "Real Extratos".
//
// Portado do app desktop original (Python + pdfplumber). Aqui usamos o
// pdfjs-dist (já usado em src/lib/pdfEmpresaParser.ts) para reconstruir o
// mesmo tipo de informação que o pdfplumber oferecia via
// `page.extract_words(x_tolerance=..., y_tolerance=...)`: uma lista de
// "palavras" com posição (x0 = distância da esquerda, top = distância do
// topo da página), agrupáveis em linhas visuais.
//
// Duas diferenças de sistema de coordenadas em relação ao pdfplumber, já
// compensadas aqui:
//   - eixo X: pdfjs (transform[4]) e pdfplumber (x0) usam a mesma origem
//     (esquerda da página, em pontos) — não precisa de ajuste.
//   - eixo Y: pdfplumber mede "top" a partir do topo da página, crescendo
//     para baixo. O pdfjs devolve a posição da linha de base (transform[5])
//     a partir do rodapé, crescendo para cima. Convertimos com
//     `top = alturaDaPagina - y`. Isso gera um pequeno deslocamento
//     constante (a distância entre a linha de base e o topo do caractere,
//     geralmente poucos pontos) que não afeta nada aqui: os parsers só
//     comparam "top" de forma relativa (agrupar mesma linha, medir
//     distância entre linhas), nunca contra um valor absoluto calibrado.
//     Coordenadas X, essas sim usadas como limite absoluto de coluna em
//     vários parsers, não sofrem esse deslocamento.

import { getDocument } from "pdfjs-dist/legacy/build/pdf.js";

export interface Word {
  text: string;
  x0: number;
  top: number;
}

async function loadDoc(buffer: Buffer) {
  return getDocument({ data: new Uint8Array(buffer) }).promise;
}

// Um "item" do pdfjs pode conter mais de uma palavra grudada (ex.: "PIX
// ENVIADO"). Quebramos pelo espaço e distribuímos a posição X
// proporcionalmente ao comprimento do texto, usando a largura total do
// item — aproximação suficiente para os testes de coluna (tolerância de
// 15-22pt na maioria dos parsers).
function splitItemToWords(str: string, x: number, top: number, width: number): Word[] {
  const totalLen = str.length || 1;
  const words: Word[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(str))) {
    const wx = width ? x + (m.index / totalLen) * width : x;
    words.push({ text: m[0], x0: wx, top });
  }
  if (words.length === 0 && str.trim()) {
    words.push({ text: str.trim(), x0: x, top });
  }
  return words;
}

async function pageWords(page: any): Promise<Word[]> {
  const viewport = page.getViewport({ scale: 1 });
  const height = viewport.height;
  const content = await page.getTextContent();
  const words: Word[] = [];
  for (const it of content.items as any[]) {
    const str: string = it.str;
    if (!str || !str.trim()) continue;
    const x = it.transform[4];
    const y = it.transform[5];
    const width = it.width ?? 0;
    words.push(...splitItemToWords(str, x, height - y, width));
  }
  return words;
}

/** Palavras de cada página, na ordem do documento. */
export async function extractPageWords(buffer: Buffer): Promise<Word[][]> {
  const doc = await loadDoc(buffer);
  const pages: Word[][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    pages.push(await pageWords(await doc.getPage(i)));
  }
  return pages;
}

export async function countPages(buffer: Buffer): Promise<number> {
  const doc = await loadDoc(buffer);
  return doc.numPages;
}

/**
 * Agrupa palavras em linhas visuais por proximidade vertical contínua
 * (equivalente ao padrão usado em vários parsers Python: percorre as
 * palavras ordenadas por "top" e abre uma nova linha quando o próximo
 * "top" está a mais de `yTol` pontos do atual). Cada linha volta ordenada
 * por x0 (esquerda → direita).
 */
export function groupRowsByGap(words: Word[], yTol = 4): Word[][] {
  const sorted = [...words].sort((a, b) => a.top - b.top);
  const rows: Word[][] = [];
  let cur: Word[] = [];
  let curTop: number | null = null;
  for (const w of sorted) {
    if (curTop === null || Math.abs(w.top - curTop) <= yTol) {
      cur.push(w);
    } else {
      rows.push(cur);
      cur = [w];
    }
    curTop = w.top;
  }
  if (cur.length) rows.push(cur);
  return rows.map((r) => [...r].sort((a, b) => a.x0 - b.x0));
}

/**
 * Agrupa palavras em "baldes" de linha por arredondamento de `top`
 * (equivalente a `by_y[round(w["top"]/bucket)*bucket]` usado na maioria
 * dos parsers por coordenada X). Retorna os baldes em ordem de topo.
 */
export function bucketRows(words: Word[], bucket = 3): Word[][] {
  const map = new Map<number, Word[]>();
  for (const w of words) {
    const key = Math.round(w.top / bucket) * bucket;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(w);
  }
  return [...map.keys()]
    .sort((a, b) => a - b)
    .map((top) => [...map.get(top)!].sort((a, b) => a.x0 - b.x0));
}

function rowText(row: Word[]): string {
  return row
    .map((w) => w.text)
    .join(" ")
    .trim();
}

/**
 * Reconstrói o texto do PDF como sequência contínua de linhas (todas as
 * páginas, em ordem) — equivalente ao helper `_pdf_extract_lines` /
 * `extract_text_lines()` do app original.
 */
export async function extractLines(buffer: Buffer): Promise<string[]> {
  const pages = await extractPageWords(buffer);
  const lines: string[] = [];
  for (const words of pages) {
    for (const row of bucketRows(words, 3)) {
      const line = rowText(row);
      if (line) lines.push(line);
    }
  }
  return lines;
}

/** Mesma reconstrução, mas mantendo as linhas separadas por página. */
export async function extractPageLines(buffer: Buffer): Promise<string[][]> {
  const pages = await extractPageWords(buffer);
  return pages.map((words) => bucketRows(words, 3).map(rowText).filter(Boolean));
}

/**
 * Amostra de texto das primeiras `maxPages` páginas, em maiúsculas — usada
 * pela detecção automática de banco (equivalente a `sample_lines[:80]` do
 * `detect_bank_from_pdf` original).
 */
export async function extractSampleTextUpper(buffer: Buffer, maxPages = 3): Promise<string> {
  const doc = await loadDoc(buffer);
  const n = Math.min(doc.numPages, maxPages);
  const lines: string[] = [];
  for (let i = 1; i <= n; i++) {
    const words = await pageWords(await doc.getPage(i));
    for (const row of bucketRows(words, 3)) {
      const line = rowText(row);
      if (line) lines.push(line);
    }
  }
  return lines.slice(0, 80).join("\n").toUpperCase();
}
