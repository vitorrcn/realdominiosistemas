// Geração do arquivo de importação Alterdata a partir dos lançamentos já
// revisados. Porte de `on_export` / `remover_acentos` do app.py original.
//
// Formato: CSV com todos os campos entre aspas, uma linha por lançamento:
//   "","DÉBITO","CRÉDITO","DD/MM/AAAA","VALOR","","HISTÓRICO",""
// Alterdata só aceita ASCII puro no histórico — acentos e caracteres
// especiais são removidos (não substituídos por "?": simplesmente caem).

import type { Lancamento } from "./tipos";

const SUBSTITUICOES_MANUAIS: Record<string, string> = {
  "ç": "C", "Ç": "C",
  "ã": "A", "Ã": "A", "õ": "O", "Õ": "O",
  "ß": "SS", "ð": "D", "ø": "O",
  "|": "-",
  "–": "-", "—": "-",
  "’": "'", "‘": "'",
};

function removerAcentos(texto: string): string {
  let t = texto;
  for (const [orig, sub] of Object.entries(SUBSTITUICOES_MANUAIS)) {
    t = t.split(orig).join(sub);
  }
  // Decompõe acentos (NFD) e remove os diacríticos.
  const semAcento = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Mantém só ASCII imprimível (32-126) — remove qualquer coisa fora disso.
  return [...semAcento].filter((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126).join("");
}

function csvField(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

/** Gera o conteúdo do arquivo .txt no formato Alterdata (CRLF, campos entre aspas). */
export function gerarArquivoAlterdata(lancamentos: Lancamento[]): string {
  const linhas = lancamentos.map((l) => {
    const valStr = l.value.toFixed(2);

    let data = l.date;
    const partes = data.split("/");
    if (partes.length === 3 && partes[2].length === 2) {
      data = `${partes[0]}/${partes[1]}/20${partes[2]}`;
    }

    let historico = removerAcentos(l.description).trim();
    if (!historico) historico = "LANCAMENTO";

    const campos = ["", l.debit, l.credit, data, valStr, "", historico, ""];
    return campos.map(csvField).join(",");
  });

  return linhas.join("\r\n") + (linhas.length ? "\r\n" : "");
}
