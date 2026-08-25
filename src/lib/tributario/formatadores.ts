export function fmtMoeda(v: number | null | undefined): string {
  const n = v ?? 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtPct(v: number | null | undefined, casas = 2): string {
  const n = v ?? 0;
  // v já vem como fração (0.135) — exibe em percentual (13,50%)
  return `${(n * 100).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

export function fmtPctJaEmPercentual(v: number | null | undefined, casas = 2): string {
  // v já vem em escala 0-100 (ex.: carga_efetiva_percentual)
  const n = v ?? 0;
  return `${n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}
