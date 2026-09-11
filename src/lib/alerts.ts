import { dasBreakdown, dasCompetenceKey, dasDueDate, dasPaidMap, resolveDasPerfil } from "./das";
import {
  calcPayroll,
  employedInMonth,
  fgtsDueDate,
  hasActiveEmployee,
  inssColaboradorDueDate,
  payrollMap,
} from "./folha";
import { proportionalLimit, totalRevenue, yearEntries } from "./mei";
import type { Company, Employee, Entry, PayrollRun } from "./types";
import { MONTHS } from "./types";
import { formatDate, formatMoney, todayIso } from "./utils";

export type AppAlert = {
  id: string;
  kind: "das" | "limite" | "folha";
  level: "warn" | "danger";
  title: string;
  body: string;
  href: string;
};

export type LaborContext = {
  employee: Employee | null;
  payrolls?: PayrollRun[];
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

export function buildAlerts(
  company: Company,
  entries: Entry[],
  today = todayIso(),
  labor?: LaborContext,
): AppAlert[] {
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

  if (labor && hasActiveEmployee(labor.employee)) {
    alerts.push(...laborAlerts(labor.employee, labor.payrolls, today));
  }

  return alerts;
}

function laborAlerts(employee: Employee, payrolls: PayrollRun[] | undefined, today: string): AppAlert[] {
  const alerts: AppAlert[] = [];
  const year = Number(today.slice(0, 4));
  const map = payrollMap(payrolls);
  const nome = employee.nome || "colaborador";

  for (const y of [year - 1, year]) {
    for (let month = 0; month < 12; month++) {
      if (!employedInMonth(employee, y, month)) continue;
      const run = map.get(`mensal-${y}-${String(month + 1).padStart(2, "0")}`);
      if (run?.daePaid) continue;
      const calc = calcPayroll({ employee, year: y, month, kind: "mensal" });
      const ref = `${MONTHS[month]}/${y}`;
      const duties = [
        {
          id: "inss",
          title: "INSS",
          due: inssColaboradorDueDate(y, month),
          amount: calc.inssEmpregado + calc.inssPatronal,
          hint: "Quite a guia do INSS do colaborador (DAE) no eSocial.",
        },
        {
          id: "fgts",
          title: "FGTS",
          due: fgtsDueDate(y, month),
          amount: calc.fgts,
          hint: "Quite a guia de FGTS do colaborador no eSocial.",
        },
      ];
      for (const duty of duties) {
        if (duty.due > today && daysBetween(today, duty.due) > 5) continue;
        const late = duty.due < today;
        if (late && y < year) continue;
        const days = daysBetween(today, duty.due);
        alerts.push({
          id: late ? `folha-${duty.id}-late:${y}-${month + 1}` : `folha-${duty.id}:${y}-${month + 1}`,
          kind: "folha",
          level: late ? "danger" : "warn",
          title: late
            ? `Pagar ${duty.title} de ${ref} em atraso`
            : `Pagar ${duty.title} de ${ref} ${days === 0 ? "vence hoje" : `vence em ${days} dia${days === 1 ? "" : "s"}`}`,
          body: `${nome}: ${duty.hint} Vencimento ${formatDate(duty.due)}. Valor estimado ${formatMoney(duty.amount)}.`,
          href: "/app/folha",
        });
      }
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
