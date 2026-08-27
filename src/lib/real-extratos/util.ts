// Utilitários compartilhados pelos parsers do Real Extratos.

/** "1.234,56" -> 1234.56 (aceita também "-1.234,56"). */
export function parseValorBR(s: string): number {
  return parseFloat(s.replace(/\./g, "").replace(",", "."));
}

/**
 * Corrige texto de PDF que veio com sequências tipo "Ã§", "Ã£", "Ã©" no
 * lugar de "ç", "ã", "é" — mojibake clássico de um texto UTF-8 decodificado
 * por engano como Latin-1/cp1252. Só mexe no texto se detectar a
 * assinatura do problema ("Ã"); nunca piora um texto que já estava certo.
 * Porte de `_fix_mojibake` do app.py original.
 */
export function fixMojibake(s: string): string {
  if (!s || !s.includes("Ã")) return s;
  try {
    const fixed = Buffer.from(s, "latin1").toString("utf-8");
    if (fixed.includes("�")) return s;
    return fixed;
  } catch {
    return s;
  }
}

export function contemAlguma(texto: string, termos: string[]): boolean {
  return termos.some((t) => texto.includes(t));
}
