import type { Entry } from "./types";
import { monthIndex, yearOf } from "./utils";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Vendas liquidadas ou a receber contam no faturamento. */
function isSale(entry: Entry) {
  return entry.kind === "venda";
}

export function salesInRange(entries: Entry[], fromIso: string, toIso: string) {
  return entries.filter((e) => isSale(e) && e.data >= fromIso && e.data <= toIso);
}

export function averageTicket(entries: Entry[], year: number, month?: number) {
  const sales = entries.filter((e) => {
    if (!isSale(e)) return false;
    if (yearOf(e.data) !== year) return false;
    if (month != null && monthIndex(e.data) !== month) return false;
    return true;
  });
  if (!sales.length) return { count: 0, total: 0, ticket: 0 };
  const total = round2(sales.reduce((a, e) => a + e.valor, 0));
  return { count: sales.length, total, ticket: round2(total / sales.length) };
}

export type TopClient = { nome: string; contactId?: string; total: number; count: number };

export function topClients(entries: Entry[], year: number, limit = 5): TopClient[] {
  const map = new Map<string, TopClient>();
  for (const e of entries) {
    if (!isSale(e) || yearOf(e.data) !== year) continue;
    const key = e.contactId || e.contraparte.trim().toLowerCase() || "sem-nome";
    const cur = map.get(key) || {
      nome: e.contraparte || "Cliente",
      contactId: e.contactId,
      total: 0,
      count: 0,
    };
    cur.total = round2(cur.total + e.valor);
    cur.count += 1;
    if (e.contraparte) cur.nome = e.contraparte;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}

export type MonthTrend = {
  year: number;
  month: number;
  label: string;
  faturamento: number;
  despesas: number;
  lucro: number;
};

const SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Tendência dos últimos N meses (inclui o mês atual). */
export function trendMonths(entries: Entry[], monthsBack = 12, ref = new Date()): MonthTrend[] {
  const out: MonthTrend[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    let fat = 0;
    let desp = 0;
    for (const e of entries) {
      if (yearOf(e.data) !== y || monthIndex(e.data) !== m) continue;
      if (e.kind === "venda") fat += e.valor;
      else if (e.kind === "compra" || e.kind === "despesa") desp += e.valor;
    }
    out.push({
      year: y,
      month: m,
      label: `${SHORT[m]}/${String(y).slice(2)}`,
      faturamento: round2(fat),
      despesas: round2(desp),
      lucro: round2(fat - desp),
    });
  }
  return out;
}

export type GoalProgress = {
  meta: number;
  atual: number;
  pct: number;
  restante: number;
  ok: boolean;
};

export function goalProgress(atual: number, meta: number): GoalProgress {
  const m = Math.max(0, meta);
  const a = Math.max(0, atual);
  const pct = m > 0 ? Math.min(999, Math.round((a / m) * 1000) / 10) : 0;
  return {
    meta: m,
    atual: a,
    pct,
    restante: round2(Math.max(0, m - a)),
    ok: m > 0 && a >= m,
  };
}
