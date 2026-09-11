import { dasBreakdown, dasCompetenceKey, dasDueDate, dasPaidMap, resolveDasPerfil } from "./das";
import { proportionalLimit, totalRevenue, yearEntries } from "./mei";
import type { Company, Entry } from "./types";
import { MONTHS } from "./types";
import { formatDate, formatMoney, todayIso } from "./utils";

export type AppAlert = {
  id: string;
  kind: "das" | "limite";
  level: "warn" | "danger";
  title: string;
  body: string;
  href: string;
};

function daysBetween(fromIso: string, toIso: string) {
  const a = new Date(`${fromIso}T12:00:00`).getTime();
  const b = new Date(`${toIso}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

function openedBefore(company: Company, year: number, month: number) {
  const opened = company.dataAbertura || "";
  if (!opened) return true;
  const key = `${year}-${String(month + 1).padStart(2, "0")}`;
  return opened.slice(0, 7) <= key;
}

export function buildAlerts(company: Company, entries: Entry[], today = todayIso()): AppAlert[] {
  const alerts: AppAlert[] = [];
  const paid = dasPaidMap(entries);
  const year = Number(today.slice(0, 4));
  const perfil = resolveDasPerfil(company);
  const totalFor = (y: number, month: number) => dasBreakdown(perfil, y, month).total;
  const nome = company.nome || "sua empresa";

  for (const y of [year - 1, year]) {
    for (let month = 0; month < 12; month++) {
      if (!openedBefore(company, y, month)) continue;
      const due = dasDueDate(y, month);
      if (due > today && daysBetween(today, due) > 5) continue;
      const key = dasCompetenceKey(y, month);
      if (paid.has(key)) continue;
      const late = due < today;
      // Exercício anterior pode ser lançado, mas não vira aviso de atraso no cadastro.
      if (late && y < year) continue;
      const days = daysBetween(today, due);
      const ref = `${MONTHS[month]}/${y}`;
      alerts.push({
        id: late ? `das-late:${key}` : `das:${key}`,
        kind: "das",
        level: late ? "danger" : "warn",
        title: late ? `DAS de ${ref} em atraso` : `DAS de ${ref} vence em ${days === 0 ? "hoje" : `${days} dia${days === 1 ? "" : "s"}`}`,
        body: late
          ? `${nome}: competência em aberto. Venceu em ${formatDate(due)}. Valor estimado ${formatMoney(totalFor(y, month))}.`
          : `${nome}: emita a guia até ${formatDate(due)}. Valor estimado ${formatMoney(totalFor(y, month))}. Ainda não há pagamento lançado.`,
        href: "/app/das",
      });
    }
  }

  const billed = totalRevenue(yearEntries(entries, year));
  const limit = proportionalLimit(company, year);
  if (limit > 0 && billed > 0) {
    const pct = (billed / limit) * 100;
    const band = pct >= 100 ? 100 : pct >= 90 ? 90 : pct >= 70 ? 70 : 0;
    if (band) {
      alerts.push({
        id: `limite:${year}:${band}`,
        kind: "limite",
        level: band >= 100 ? "danger" : "warn",
        title:
          band >= 100
            ? "Limite de faturamento do MEI estourou"
            : `Faturamento em ${band}% do limite`,
        body: `${nome}: ${formatMoney(billed)} de ${formatMoney(limit)} neste ano (${pct.toFixed(1).replace(".", ",")}%). ${
          band >= 100
            ? "Acima do teto proporcional. Revise antes do desenquadramento."
            : band >= 90
              ? "Muito perto do teto de R$ 81 mil (proporcional à abertura)."
              : "Acompanhe para não cruzar o teto do MEI."
        }`,
        href: "/app/limites",
      });
    }
  }

  return alerts;
}

const DISMISS_KEY = "podmei-alert-dismissed";

export function dismissedAlertIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(list) ? list.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

export function dismissAlert(id: string) {
  const gone = dismissedAlertIds();
  gone.add(id);
  localStorage.setItem(DISMISS_KEY, JSON.stringify([...gone]));
}

export function visibleAlerts(alerts: AppAlert[]) {
  const gone = dismissedAlertIds();
  return alerts.filter((alert) => !gone.has(alert.id));
}
