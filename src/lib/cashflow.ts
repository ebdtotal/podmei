import { dasBreakdown, dasCompetenceKey, dasDueDate, dasPaidMap, resolveDasPerfil } from "./das";
import { cashDeltaForInvestmentMove } from "./investments";
import type { Company, Entry, InvestmentMovement } from "./types";
import { MONTHS } from "./types";
import { addDaysIso, isoDate, monthIndex, todayIso, yearOf } from "./utils";

export type CashDay = {
  date: string;
  entradas: number;
  saidas: number;
  receber: number;
  pagar: number;
  saldo: number;
};

export type CashWeek = {
  start: string;
  end: string;
  entradas: number;
  saidas: number;
  receber: number;
  pagar: number;
  saldoFinal: number;
  shortfall: boolean;
};

export type CashMonthSummary = {
  year: number;
  month: number;
  entradas: number;
  saidas: number;
  lucro: number;
  aReceber: number;
  aPagar: number;
  saldoProjetado: number;
  days: CashDay[];
  weeks: CashWeek[];
};

export type CashYearSummary = {
  year: number;
  opening: number;
  entradas: number;
  saidas: number;
  lucro: number;
  aReceber: number;
  aPagar: number;
  saldoProjetado: number;
  months: CashMonthSummary[];
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function isInflow(entry: Entry) {
  return entry.kind === "venda";
}

function isOutflow(entry: Entry) {
  return entry.kind === "compra" || entry.kind === "despesa";
}

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

/** Dias do mês com movimento liquidado + títulos em aberto no vencimento. */
export function buildCashMonth(
  entries: Entry[],
  year: number,
  month: number,
  opening = 0,
  investMoves: InvestmentMovement[] = [],
): CashMonthSummary {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const days: CashDay[] = [];
  let saldo = opening;

  for (let d = 1; d <= lastDay; d++) {
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    let entradas = 0;
    let saidas = 0;
    let receber = 0;
    let pagar = 0;

    for (const e of entries) {
      if (e.status === "liquidado" && e.data === date) {
        if (isInflow(e)) entradas += e.valor;
        else if (isOutflow(e)) saidas += e.valor;
      }
      const due = e.vencimento || e.data;
      if (e.status === "a_receber" && due === date) receber += e.valor;
      if (e.status === "a_pagar" && due === date) pagar += e.valor;
    }

    for (const m of investMoves) {
      if (m.data !== date) continue;
      const delta = cashDeltaForInvestmentMove(m);
      if (delta > 0) entradas += delta;
      else if (delta < 0) saidas += -delta;
    }

    saldo = round2(saldo + entradas - saidas + receber - pagar);
    days.push({
      date,
      entradas: round2(entradas),
      saidas: round2(saidas),
      receber: round2(receber),
      pagar: round2(pagar),
      saldo,
    });
  }

  const weeks: CashWeek[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const slice = days.slice(i, i + 7);
    const first = slice[0];
    const last = slice[slice.length - 1];
    const week: CashWeek = {
      start: first.date,
      end: last.date,
      entradas: round2(slice.reduce((a, x) => a + x.entradas + x.receber, 0)),
      saidas: round2(slice.reduce((a, x) => a + x.saidas + x.pagar, 0)),
      receber: round2(slice.reduce((a, x) => a + x.receber, 0)),
      pagar: round2(slice.reduce((a, x) => a + x.pagar, 0)),
      saldoFinal: last.saldo,
      shortfall: slice.some((x) => x.saldo < 0) || last.saldo < 0,
    };
    weeks.push(week);
  }

  const entradas = round2(days.reduce((a, d) => a + d.entradas, 0));
  const saidas = round2(days.reduce((a, d) => a + d.saidas, 0));
  const aReceber = round2(days.reduce((a, d) => a + d.receber, 0));
  const aPagar = round2(days.reduce((a, d) => a + d.pagar, 0));

  return {
    year,
    month,
    entradas,
    saidas,
    lucro: round2(entradas - saidas),
    aReceber,
    aPagar,
    saldoProjetado: days[days.length - 1]?.saldo ?? opening,
    days,
    weeks,
  };
}

/** Saldo liquidado acumulado até o dia anterior ao mês (inclui aporte/resgate de investimentos). */
export function openingBalanceBefore(
  entries: Entry[],
  year: number,
  month: number,
  investMoves: InvestmentMovement[] = [],
) {
  const cutoff = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  let saldo = 0;
  for (const e of entries) {
    if (e.status !== "liquidado" || e.data >= cutoff) continue;
    if (isInflow(e)) saldo += e.valor;
    else if (isOutflow(e)) saldo -= e.valor;
  }
  for (const m of investMoves) {
    if (m.data >= cutoff) continue;
    saldo += cashDeltaForInvestmentMove(m);
  }
  return round2(saldo);
}

/** Fluxo mensal de um ano inteiro (saldo encadeado mês a mês). */
export function buildCashYear(entries: Entry[], year: number, investMoves: InvestmentMovement[] = []): CashYearSummary {
  const opening = openingBalanceBefore(entries, year, 0, investMoves);
  const months: CashMonthSummary[] = [];
  let carry = opening;
  for (let month = 0; month < 12; month++) {
    const row = buildCashMonth(entries, year, month, carry, investMoves);
    months.push(row);
    carry = row.saldoProjetado;
  }
  return {
    year,
    opening,
    entradas: round2(months.reduce((a, m) => a + m.entradas, 0)),
    saidas: round2(months.reduce((a, m) => a + m.saidas, 0)),
    lucro: round2(months.reduce((a, m) => a + m.lucro, 0)),
    aReceber: round2(months.reduce((a, m) => a + m.aReceber, 0)),
    aPagar: round2(months.reduce((a, m) => a + m.aPagar, 0)),
    saldoProjetado: months[11]?.saldoProjetado ?? opening,
    months,
  };
}

export type CalendarItem = {
  id: string;
  date: string;
  kind: "receber" | "pagar" | "agendado" | "evento";
  title: string;
  valor: number;
  entryId?: string;
  eventId?: string;
  href?: string;
  detail?: string;
};

/** Itens do calendário: títulos + DAS mensal + eventos manuais. */
export function calendarItems(
  entries: Entry[],
  year: number,
  month: number,
  company?: Company,
  events: Array<{ id: string; date: string; title: string; note?: string; valor?: number }> = [],
): CalendarItem[] {
  const key = `${year}-${String(month + 1).padStart(2, "0")}`;
  const items: CalendarItem[] = [];
  for (const e of entries) {
    const due = e.vencimento || (e.status !== "liquidado" ? e.data : "");
    if (!due || !due.startsWith(key)) continue;
    if (e.status === "a_receber") {
      items.push({
        id: `rec-${e.id}`,
        date: due,
        kind: "receber",
        title: e.contraparte || e.descricao || "A receber",
        valor: e.valor,
        entryId: e.id,
        href: "/app/contas",
      });
    } else if (e.status === "a_pagar") {
      items.push({
        id: `pag-${e.id}`,
        date: due,
        kind: "pagar",
        title: e.contraparte || e.descricao || "A pagar",
        valor: e.valor,
        entryId: e.id,
        href: "/app/contas",
      });
    }
  }

  const paid = dasPaidMap(entries);
  const perfil = company ? resolveDasPerfil(company) : null;
  for (const y of [year - 1, year]) {
    for (let competenceMonth = 0; competenceMonth < 12; competenceMonth++) {
      const due = dasDueDate(y, competenceMonth);
      if (!due.startsWith(key)) continue;
      const ckey = dasCompetenceKey(y, competenceMonth);
      const alreadyPaid = paid.has(ckey);
      const total = perfil ? dasBreakdown(perfil, y, competenceMonth).total : 0;
      items.push({
        id: `das:${ckey}`,
        date: due,
        kind: "agendado",
        title: alreadyPaid ? `DAS mensal · ${MONTHS[competenceMonth]}/${y} (pago)` : `DAS mensal · ${MONTHS[competenceMonth]}/${y}`,
        valor: total,
        href: "/app/das",
        detail: alreadyPaid ? "Competência quitada" : "Vencimento da guia DAS",
      });
    }
  }

  for (const ev of events) {
    if (!ev.date?.startsWith(key)) continue;
    items.push({
      id: `evt:${ev.id}`,
      date: ev.date,
      kind: "evento",
      title: ev.title || "Evento",
      valor: ev.valor ?? 0,
      eventId: ev.id,
      detail: ev.note || undefined,
    });
  }

  return items.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "pt-BR"));
}

export function weekShortfallAlerts(
  entries: Entry[],
  today = todayIso(),
): Array<{ id: string; start: string; end: string; saldo: number }> {
  const y = yearOf(today);
  const m = monthIndex(today);
  const open = openingBalanceBefore(entries, y, m);
  const cash = buildCashMonth(entries, y, m, open);
  const out: Array<{ id: string; start: string; end: string; saldo: number }> = [];
  for (const w of cash.weeks) {
    if (!w.shortfall) continue;
    if (w.end < today) continue;
    out.push({
      id: `caixa-semana:${w.start}`,
      start: w.start,
      end: w.end,
      saldo: w.saldoFinal,
    });
  }
  return out;
}

/** Próximos vencimentos (para lembretes). */
export function upcomingDues(entries: Entry[], withinDays = 7, today = todayIso()) {
  const limit = addDaysIso(today, withinDays);
  return entries
    .filter((e) => e.status === "a_receber" || e.status === "a_pagar")
    .map((e) => ({ entry: e, due: e.vencimento || e.data }))
    .filter((x) => x.due >= today && x.due <= limit)
    .sort((a, b) => a.due.localeCompare(b.due));
}

export function monthLabel(year: number, month: number) {
  return isoDate(new Date(year, month, 1)).slice(0, 7);
}

export function cashMonthKey(year: number, month: number) {
  return monthKey(`${year}-${String(month + 1).padStart(2, "0")}-01`);
}
