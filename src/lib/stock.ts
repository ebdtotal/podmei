import type { Entry, Product, StockMoveKind, StockMovement } from "./types";
import { todayIso, uid } from "./utils";

/** Quantidade usada no estoque: série só conta no 1º lançamento (`stockQty`). */
export function entryStockQty(entry: Entry): number {
  if (entry.seriesId && entry.stockQty == null) return 0;
  const q = entry.stockQty ?? entry.quantidade;
  return q && q > 0 ? q : entry.productId ? 1 : 0;
}

/** Delta de estoque para um lançamento (+ compra, − venda). Só produtos. */
export function entryStockDelta(entry: Entry, product: Product | undefined): number {
  if (!entry.productId || !product || product.kind !== "produto") return 0;
  const qty = entryStockQty(entry);
  if (qty <= 0) return 0;
  if (entry.kind === "venda") return -qty;
  if (entry.kind === "compra") return +qty;
  return 0;
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Custo unitário da compra a partir do lançamento. */
export function entryUnitCost(entry: Entry): number {
  const qty = entryStockQty(entry);
  if (entry.precoUnitario != null && entry.precoUnitario > 0) return entry.precoUnitario;
  if (qty > 0 && entry.valor) return Math.abs(entry.valor) / qty;
  return 0;
}

/** Preço unitário da venda (para margem). */
export function entryUnitPrice(entry: Entry): number {
  const qty = entryStockQty(entry);
  if (entry.precoUnitario != null && entry.precoUnitario > 0) return entry.precoUnitario;
  if (qty > 0 && entry.valor) return Math.abs(entry.valor) / qty;
  return 0;
}

export function weightedAverageCost(
  estoqueAntes: number,
  custoMedioAntes: number,
  qtyIn: number,
  unitCost: number,
): number {
  const before = Math.max(0, estoqueAntes);
  const after = before + qtyIn;
  if (qtyIn <= 0 || after <= 0) return round2(custoMedioAntes);
  if (before <= 0) return round2(unitCost);
  return round2((before * custoMedioAntes + qtyIn * unitCost) / after);
}

export function saleMargin(unitPrice: number, custoMedio: number, qty: number) {
  const marginUnit = round2(unitPrice - custoMedio);
  return { marginUnit, marginTotal: round2(marginUnit * qty) };
}

export function applyStockDelta(products: Product[], productId: string, delta: number): Product[] {
  if (!delta) return products;
  return products.map((p) => {
    if (p.id !== productId || p.kind !== "produto") return p;
    const atual = Number(p.estoqueAtual) || 0;
    return { ...p, estoqueAtual: round3(atual + delta) };
  });
}

function patchProduct(
  products: Product[],
  productId: string,
  patch: Partial<Product>,
): Product[] {
  return products.map((p) => (p.id === productId ? { ...p, ...patch } : p));
}

export type StockApplyResult = { products: Product[]; movements: StockMovement[] };

/** Aplica lançamento no saldo + histórico (+ custo médio / margem). `sign: -1` desfaz. */
export function applyEntryStockFull(
  products: Product[],
  movements: StockMovement[],
  entry: Entry,
  sign: 1 | -1 = 1,
): StockApplyResult {
  const product = products.find((p) => p.id === entry.productId);
  const delta = entryStockDelta(entry, product);
  if (!delta || !entry.productId || !product) {
    return { products, movements };
  }

  if (sign === -1) {
    const without = movements.filter((m) => m.entryId !== entry.id);
    // Reverte saldo e recompõe custo médio a partir do histórico restante (simples: só saldo)
    const reversed = applyStockDelta(products, entry.productId, -delta);
    const restored = recomputeCustoMedio(reversed, without, entry.productId);
    return { products: restored, movements: without };
  }

  const qty = Math.abs(delta);
  const estoqueAntes = Number(product.estoqueAtual) || 0;
  const custoAntes = Number(product.custoMedio) || 0;
  const estoqueDepois = round3(estoqueAntes + delta);

  let nextProducts = applyStockDelta(products, entry.productId, delta);
  let kind: StockMoveKind;
  let unitCost: number | undefined;
  let unitPrice: number | undefined;
  let marginUnit: number | undefined;
  let marginTotal: number | undefined;
  let custoMedio = custoAntes;

  if (delta > 0) {
    kind = "entrada";
    unitCost = entryUnitCost(entry);
    custoMedio = weightedAverageCost(estoqueAntes, custoAntes, qty, unitCost);
    nextProducts = patchProduct(nextProducts, entry.productId, { custoMedio });
  } else {
    kind = "saida";
    unitPrice = entryUnitPrice(entry);
    const m = saleMargin(unitPrice, custoAntes, qty);
    marginUnit = m.marginUnit;
    marginTotal = m.marginTotal;
    unitCost = custoAntes > 0 ? custoAntes : undefined;
    if (estoqueDepois <= 0) {
      // mantém último custo médio para referência; saldo zerado
    }
  }

  const move: StockMovement = {
    id: uid("stk"),
    productId: entry.productId,
    kind,
    data: entry.data || todayIso(),
    qty,
    sign: delta > 0 ? 1 : -1,
    unitCost,
    unitPrice,
    marginUnit,
    marginTotal,
    saldoApos: estoqueDepois,
    entryId: entry.id,
    observacao: entry.descricao || undefined,
    createdAt: new Date().toISOString(),
  };

  return {
    products: nextProducts,
    movements: [...movements, move].sort(sortMoves),
  };
}

export function applyEntriesStockFull(
  products: Product[],
  movements: StockMovement[],
  entries: Entry[],
  sign: 1 | -1 = 1,
): StockApplyResult {
  return entries.reduce(
    (acc, e) => applyEntryStockFull(acc.products, acc.movements, e, sign),
    { products, movements } as StockApplyResult,
  );
}

/** Compat: só produtos (sem histórico). Preferir applyEntryStockFull. */
export function applyEntryStock(products: Product[], entry: Entry, sign: 1 | -1 = 1): Product[] {
  return applyEntryStockFull(products, [], entry, sign).products;
}

export function applyEntriesStock(products: Product[], entries: Entry[], sign: 1 | -1 = 1): Product[] {
  return applyEntriesStockFull(products, [], entries, sign).products;
}

/** Ajuste manual de saldo (edição de estoque / inventário). */
export function applyStockAdjust(
  products: Product[],
  movements: StockMovement[],
  productId: string,
  newQty: number,
  opts?: { data?: string; unitCost?: number; observacao?: string },
): StockApplyResult {
  const product = products.find((p) => p.id === productId);
  if (!product || product.kind !== "produto") return { products, movements };

  const atual = Number(product.estoqueAtual) || 0;
  const target = round3(Number(newQty) || 0);
  const delta = round3(target - atual);
  if (!delta) {
    if (opts?.unitCost != null && opts.unitCost >= 0) {
      return {
        products: patchProduct(products, productId, { custoMedio: round2(opts.unitCost) }),
        movements,
      };
    }
    return { products, movements };
  }

  const qty = Math.abs(delta);
  const custoAntes = Number(product.custoMedio) || 0;
  let nextProducts = applyStockDelta(products, productId, delta);
  let custoMedio = custoAntes;

  if (delta > 0 && opts?.unitCost != null && opts.unitCost >= 0) {
    custoMedio = weightedAverageCost(atual, custoAntes, qty, opts.unitCost);
    nextProducts = patchProduct(nextProducts, productId, { custoMedio });
  }

  const move: StockMovement = {
    id: uid("stk"),
    productId,
    kind: "ajuste",
    data: opts?.data || todayIso(),
    qty,
    sign: delta > 0 ? 1 : -1,
    unitCost: delta > 0 ? opts?.unitCost : custoAntes > 0 ? custoAntes : undefined,
    saldoApos: target,
    observacao: opts?.observacao || (delta > 0 ? "Ajuste de entrada" : "Ajuste de saída"),
    createdAt: new Date().toISOString(),
  };

  return {
    products: nextProducts,
    movements: [...movements, move].sort(sortMoves),
  };
}

/** Estoque inicial ao cadastrar produto com saldo > 0. */
export function applyOpeningStock(
  products: Product[],
  movements: StockMovement[],
  product: Product,
  unitCost?: number,
): StockApplyResult {
  if (product.kind !== "produto") return { products, movements };
  const qty = Number(product.estoqueAtual) || 0;
  if (qty <= 0) {
    if (unitCost != null && unitCost >= 0) {
      return {
        products: patchProduct(products, product.id, { custoMedio: round2(unitCost) }),
        movements,
      };
    }
    return { products, movements };
  }

  const cost = unitCost != null && unitCost >= 0 ? round2(unitCost) : 0;
  const withCost = patchProduct(products, product.id, {
    custoMedio: cost,
    estoqueAtual: round3(qty),
  });

  const move: StockMovement = {
    id: uid("stk"),
    productId: product.id,
    kind: "ajuste",
    data: todayIso(),
    qty: round3(qty),
    sign: 1,
    unitCost: cost || undefined,
    saldoApos: round3(qty),
    observacao: "Estoque inicial",
    createdAt: new Date().toISOString(),
  };

  return { products: withCost, movements: [...movements, move].sort(sortMoves) };
}

/** Recalcula custo médio a partir das entradas/ajustes com custo (após desfazer lançamento). */
export function recomputeCustoMedio(
  products: Product[],
  movements: StockMovement[],
  productId: string,
): Product[] {
  const product = products.find((p) => p.id === productId);
  if (!product || product.kind !== "produto") return products;

  let estoque = 0;
  let custo = 0;
  const ordered = [...movements]
    .filter((m) => m.productId === productId)
    .sort(sortMoves);

  for (const m of ordered) {
    const s = m.sign ?? (m.kind === "saida" ? -1 : m.kind === "entrada" ? 1 : 1);
    const signed = m.kind === "ajuste" ? (m.sign ?? 1) * m.qty : s * m.qty;
    if (signed > 0) {
      const unit = Number(m.unitCost) || custo;
      custo = weightedAverageCost(estoque, custo, signed, unit);
      estoque = round3(estoque + signed);
    } else if (signed < 0) {
      estoque = round3(estoque + signed);
    }
  }

  return patchProduct(products, productId, {
    custoMedio: custo > 0 ? custo : undefined,
  });
}

function sortMoves(a: StockMovement, b: StockMovement) {
  return a.data.localeCompare(b.data) || a.createdAt.localeCompare(b.createdAt);
}

export type StockLevel = "ok" | "baixo" | "zerado" | "negativo";

export function stockLevel(product: Product): StockLevel | null {
  if (product.kind !== "produto") return null;
  const atual = Number(product.estoqueAtual) || 0;
  const min = Number(product.estoqueMinimo) || 0;
  if (atual < 0) return "negativo";
  if (atual <= 0) return "zerado";
  if (min > 0 && atual <= min) return "baixo";
  return "ok";
}

export function stockMoveLabel(kind: StockMoveKind, sign?: 1 | -1) {
  if (kind === "entrada") return "Entrada";
  if (kind === "saida") return "Saída";
  return sign === -1 ? "Ajuste (−)" : "Ajuste (+)";
}

export function lastMovementDate(movements: StockMovement[], productId: string): string | null {
  const list = movements.filter((m) => m.productId === productId);
  if (!list.length) return null;
  return [...list].sort((a, b) => b.data.localeCompare(a.data) || b.createdAt.localeCompare(a.createdAt))[0]
    .data;
}

export function lastExitDate(movements: StockMovement[], productId: string): string | null {
  const list = movements.filter(
    (m) => m.productId === productId && (m.kind === "saida" || (m.kind === "ajuste" && m.sign === -1)),
  );
  if (!list.length) return null;
  return [...list].sort((a, b) => b.data.localeCompare(a.data) || b.createdAt.localeCompare(a.createdAt))[0]
    .data;
}

export function daysSince(iso: string | null, today = todayIso()): number | null {
  if (!iso) return null;
  const a = new Date(`${iso}T12:00:00`);
  const b = new Date(`${today}T12:00:00`);
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

export type StockReportRow = {
  product: Product;
  level: StockLevel;
  diasParado: number | null;
  ultimaSaida: string | null;
  custoMedio: number;
  preco: number;
  margemUnit: number | null;
};

/** Produtos em falta (baixo / zerado / negativo). */
export function productsEmFalta(products: Product[]): StockReportRow[] {
  return products
    .filter((p) => p.kind === "produto")
    .map((p) => {
      const level = stockLevel(p)!;
      const custo = Number(p.custoMedio) || 0;
      const preco = Number(p.preco) || 0;
      return {
        product: p,
        level,
        diasParado: null,
        ultimaSaida: null,
        custoMedio: custo,
        preco,
        margemUnit: custo > 0 ? round2(preco - custo) : null,
      };
    })
    .filter((r) => r.level === "baixo" || r.level === "zerado" || r.level === "negativo")
    .sort((a, b) => (Number(a.product.estoqueAtual) || 0) - (Number(b.product.estoqueAtual) || 0));
}

/**
 * Produtos parados: têm saldo > 0 e sem saída há `dias` dias (ou nunca saíram).
 * Usa movimentos; se não houver saída registrada, conta desde createdAt do produto.
 */
export function productsParados(
  products: Product[],
  movements: StockMovement[],
  dias = 60,
  today = todayIso(),
): StockReportRow[] {
  return products
    .filter((p) => p.kind === "produto" && (Number(p.estoqueAtual) || 0) > 0)
    .map((p) => {
      const ultimaSaida = lastExitDate(movements, p.id);
      const ref = ultimaSaida || p.createdAt?.slice(0, 10) || null;
      const diasParado = daysSince(ref, today);
      const level = stockLevel(p)!;
      const custo = Number(p.custoMedio) || 0;
      const preco = Number(p.preco) || 0;
      return {
        product: p,
        level,
        diasParado,
        ultimaSaida,
        custoMedio: custo,
        preco,
        margemUnit: custo > 0 ? round2(preco - custo) : null,
      };
    })
    .filter((r) => r.diasParado == null || r.diasParado >= dias)
    .sort((a, b) => (b.diasParado ?? 0) - (a.diasParado ?? 0));
}
