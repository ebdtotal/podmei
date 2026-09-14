import type { Entry } from "./types";
import { isSale } from "./mei";

/** Anexo III do Simples Nacional (serviços — alíquotas nominais). */
export const SIMPLES_ANEXO_III = [
  { faixa: 1, label: "1ª Faixa", min: 0, max: 180_000, aliquota: 0.06, deduzir: 0 },
  { faixa: 2, label: "2ª Faixa", min: 180_000.01, max: 360_000, aliquota: 0.112, deduzir: 9_360 },
  { faixa: 3, label: "3ª Faixa", min: 360_000.01, max: 720_000, aliquota: 0.135, deduzir: 17_640 },
  { faixa: 4, label: "4ª Faixa", min: 720_000.01, max: 1_800_000, aliquota: 0.16, deduzir: 35_640 },
  { faixa: 5, label: "5ª Faixa", min: 1_800_000.01, max: 3_600_000, aliquota: 0.21, deduzir: 125_640 },
  { faixa: 6, label: "6ª Faixa", min: 3_600_000.01, max: 4_800_000, aliquota: 0.33, deduzir: 648_000 },
] as const;

export type SimplesFaixa = (typeof SIMPLES_ANEXO_III)[number];

export type SimplesReceitaHistorico = Record<string, number>;

export type SimplesMonthSource = "lancamentos" | "historico" | "vazio";

export type SimplesRbtMode = "cheia" | "proporcional_1" | "proporcional_media";

export type SimplesMonthRow = {
  year: number;
  month: number;
  key: string;
  valor: number;
  lancado: number;
  historico: number;
  source: SimplesMonthSource;
};

export function findSimplesFaixa(rbt12: number): SimplesFaixa | null {
  if (rbt12 < 0) return null;
  if (rbt12 > 4_800_000) return null;
  for (const f of SIMPLES_ANEXO_III) {
    if (rbt12 >= f.min && rbt12 <= f.max) return f;
  }
  return SIMPLES_ANEXO_III[0];
}

/** Alíquota efetiva = [(RBT12 × alíquota nominal) − dedução] / RBT12 */
export function aliquotaEfetiva(rbt12: number, faixa: SimplesFaixa) {
  if (rbt12 <= 0) return faixa.aliquota;
  return Math.max(0, (rbt12 * faixa.aliquota - faixa.deduzir) / rbt12);
}

export function monthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Os 12 meses anteriores à competência (não inclui o mês da competência). */
export function rbt12MonthList(year: number, month: number) {
  const rows: Array<{ year: number; month: number; key: string }> = [];
  for (let i = 1; i <= 12; i++) {
    const m = shiftMonth(year, month, -i);
    rows.push({ ...m, key: monthKey(m.year, m.month) });
  }
  return rows;
}

/**
 * Mês de atividade na competência (1 = mês de abertura).
 * Null se não há data de abertura válida ou se a competência é anterior à abertura.
 */
export function activityMonthAt(dataAbertura: string | undefined | null, year: number, month: number) {
  const opened = (dataAbertura || "").trim().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(opened)) return null;
  const oy = Number(opened.slice(0, 4));
  const om = Number(opened.slice(5, 7)) - 1;
  if (!Number.isFinite(oy) || om < 0 || om > 11) return null;
  const idx = (year - oy) * 12 + (month - om) + 1;
  if (idx < 1) return null;
  return idx;
}

/** Meses do calendário da abertura até a competência (inclusive). */
export function monthsFromAberturaTo(dataAbertura: string, year: number, month: number) {
  const opened = dataAbertura.trim().slice(0, 7);
  const oy = Number(opened.slice(0, 4));
  const om = Number(opened.slice(5, 7)) - 1;
  const rows: Array<{ year: number; month: number; key: string }> = [];
  let y = oy;
  let m = om;
  while (y < year || (y === year && m <= month)) {
    rows.push({ year: y, month: m, key: monthKey(y, m) });
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
    if (rows.length > 24) break;
  }
  return rows;
}

/** Soma de vendas (receita bruta) lançadas no mês. */
export function salesInMonth(entries: Entry[], year: number, month: number) {
  const prefix = monthKey(year, month);
  return (entries ?? [])
    .filter((e) => isSale(e) && e.data.startsWith(prefix))
    .reduce((s, e) => s + e.valor, 0);
}

export function hasSalesInMonth(entries: Entry[], year: number, month: number) {
  const prefix = monthKey(year, month);
  return (entries ?? []).some((e) => isSale(e) && e.data.startsWith(prefix));
}

/**
 * Receita do mês: se há lançamento de venda, usa o sistema;
 * senão, usa o valor informado no histórico (quando existir).
 */
export function revenueInMonth(
  entries: Entry[],
  year: number,
  month: number,
  historico?: SimplesReceitaHistorico | null,
) {
  if (hasSalesInMonth(entries, year, month)) {
    return salesInMonth(entries, year, month);
  }
  const key = monthKey(year, month);
  const h = historico?.[key];
  return typeof h === "number" && Number.isFinite(h) ? Math.max(0, h) : 0;
}

export function resolveMonthRevenue(
  entries: Entry[],
  year: number,
  month: number,
  historico?: SimplesReceitaHistorico | null,
): SimplesMonthRow {
  const key = monthKey(year, month);
  const lancado = salesInMonth(entries, year, month);
  const histRaw = historico?.[key];
  const historicoVal = typeof histRaw === "number" && Number.isFinite(histRaw) ? Math.max(0, histRaw) : 0;
  if (hasSalesInMonth(entries, year, month)) {
    return {
      year,
      month,
      key,
      valor: lancado,
      lancado,
      historico: historicoVal,
      source: "lancamentos",
    };
  }
  if (historicoVal > 0 || (histRaw != null && Number.isFinite(histRaw))) {
    return {
      year,
      month,
      key,
      valor: historicoVal,
      lancado,
      historico: historicoVal,
      source: "historico",
    };
  }
  return { year, month, key, valor: 0, lancado: 0, historico: 0, source: "vazio" };
}

/**
 * RBT12 padrão: soma da receita bruta dos 12 meses anteriores
 * (não inclui o mês da competência).
 */
export function rbt12BeforeMonth(
  entries: Entry[],
  year: number,
  month: number,
  historico?: SimplesReceitaHistorico | null,
) {
  return rbt12MonthList(year, month).reduce(
    (total, m) => total + revenueInMonth(entries, m.year, m.month, historico),
    0,
  );
}

/**
 * RBT12 com regra de empresa nova (menos de 12 meses de atividade):
 * - 1º mês: faturamento do mês × 12
 * - 2º ao 12º mês: média dos meses já vividos × 12
 * - A partir do 13º mês: soma dos 12 meses anteriores (regra cheia)
 */
export function provisaoSimplesMes(
  entries: Entry[],
  year: number,
  month: number,
  historico?: SimplesReceitaHistorico | null,
  dataAbertura?: string | null,
) {
  const receitaMes = revenueInMonth(entries, year, month, historico);
  const activityMonth = activityMonthAt(dataAbertura, year, month);
  const useProportional = activityMonth != null && activityMonth >= 1 && activityMonth <= 12;

  let months: SimplesMonthRow[];
  let rbt12: number;
  let rbtMode: SimplesRbtMode;
  let mediaMensal = 0;
  let mesesVividos = 0;

  if (useProportional && dataAbertura) {
    const lived = monthsFromAberturaTo(dataAbertura, year, month).map((m) =>
      resolveMonthRevenue(entries, m.year, m.month, historico),
    );
    months = lived;
    mesesVividos = lived.length;
    const soma = lived.reduce((s, m) => s + m.valor, 0);

    if (activityMonth === 1) {
      rbtMode = "proporcional_1";
      mediaMensal = receitaMes;
      rbt12 = round2(receitaMes * 12);
    } else {
      rbtMode = "proporcional_media";
      mediaMensal = mesesVividos > 0 ? soma / mesesVividos : 0;
      rbt12 = round2(mediaMensal * 12);
    }
  } else {
    rbtMode = "cheia";
    months = rbt12MonthList(year, month).map((m) =>
      resolveMonthRevenue(entries, m.year, m.month, historico),
    );
    mesesVividos = 12;
    mediaMensal = 0;
    rbt12 = round2(months.reduce((s, m) => s + m.valor, 0));
  }

  const faixa = findSimplesFaixa(rbt12);
  if (!faixa) {
    return {
      rbt12,
      receitaMes,
      faixa: null as SimplesFaixa | null,
      efetiva: 0,
      imposto: 0,
      ultrapassou: rbt12 > 4_800_000,
      months,
      rbtMode,
      activityMonth,
      mesesVividos,
      mediaMensal: round2(mediaMensal),
    };
  }
  const efetiva = aliquotaEfetiva(rbt12, faixa);
  const imposto = round2(receitaMes * efetiva);
  return {
    rbt12,
    receitaMes,
    faixa,
    efetiva,
    imposto,
    ultrapassou: false,
    months,
    rbtMode,
    activityMonth,
    mesesVividos,
    mediaMensal: round2(mediaMensal),
  };
}
