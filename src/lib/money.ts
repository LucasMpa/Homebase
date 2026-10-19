/** Valores são sempre centavos (inteiro). Conversão só na borda: formulário e exibição. */

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** 123456 → "R$ 1.234,56" (com espaço comum, não NBSP). */
export function formatBRL(cents: number): string {
  return brl.format(cents / 100).replace(/\u00a0/g, " ");
}

/** 123456 → "1.234,56" (para preencher inputs). */
export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return formatBRL(cents).replace(/^R\$\s?/, "");
}

/**
 * Converte texto digitado em centavos, sem ponto flutuante.
 * Aceita "1.234,56", "1234,56", "1234", "R$ 12,5" e também "1234.56".
 * Retorna null se vazio e NaN se inválido.
 */
export function parseBRL(input: string): number | null {
  let s = input.replace(/R\$/i, "").replace(/[\s\u00a0]/g, "");
  if (s === "") return null;
  // Parte inteira: só dígitos, ou agrupada de 3 em 3 com ponto ("1.234.567").
  const integer = String.raw`(?:\d+|\d{1,3}(?:\.\d{3})+)`;
  if (new RegExp(`^${integer},\\d{1,2}$`).test(s) || new RegExp(`^${integer}$`).test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (!/^\d+\.\d{1,2}$/.test(s)) {
    return Number.NaN; // "1234.56" (ponto decimal) é o único outro formato aceito
  }
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!match) return Number.NaN;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : Number.NaN;
}
