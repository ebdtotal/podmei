import type { DiscountKind, Entry } from "./types";

/** Bruto = quantidade × preço unitário (ou valor legado). */
export function entryGross(entry: Pick<Entry, "valor" | "quantidade" | "precoUnitario">): number {
  const qty = entry.quantidade && entry.quantidade > 0 ? entry.quantidade : 1;
  if (entry.precoUnitario != null && entry.precoUnitario >= 0) {
    return round2(entry.precoUnitario * qty);
  }
  return round2(entry.valor);
}

export function entryDiscountAmount(
  bruto: number,
  tipo: DiscountKind | undefined,
  valor: number | undefined,
): number {
  if (!valor || valor <= 0) return 0;
  if (tipo === "percent") return round2(Math.min(bruto, (bruto * valor) / 100));
  return round2(Math.min(bruto, valor));
}

/** Valor líquido do lançamento (o que entra nos totais). */
export function entryNet(entry: Entry): number {
  if (entry.precoUnitario == null && entry.quantidade == null && entry.descontoValor == null) {
    return round2(entry.valor);
  }
  const bruto = entryGross(entry);
  const desc = entryDiscountAmount(bruto, entry.descontoTipo, entry.descontoValor);
  return round2(Math.max(0, bruto - desc));
}

export function calcEntryTotal(input: {
  quantidade?: number;
  precoUnitario?: number;
  descontoTipo?: DiscountKind;
  descontoValor?: number;
  /** fallback quando não há unitário (lançamento legado / texto) */
  valor?: number;
}): { bruto: number; desconto: number; liquido: number } {
  const qty = input.quantidade && input.quantidade > 0 ? input.quantidade : 1;
  const unit = input.precoUnitario != null && input.precoUnitario >= 0 ? input.precoUnitario : input.valor ?? 0;
  const bruto = round2(unit * qty);
  const desconto = entryDiscountAmount(bruto, input.descontoTipo, input.descontoValor);
  return { bruto, desconto, liquido: round2(Math.max(0, bruto - desconto)) };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
