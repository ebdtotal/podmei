import { weekShortfallAlerts, upcomingDues } from "./cashflow";
import { dasBreakdown, dasCompetenceKey, dasDueDate, dasPaidMap, resolveDasPerfil } from "./das";
import {
  calcPayroll,
  employedInMonth,
  fgtsDueDate,
  hasActiveEmployee,
  inssColaboradorDueDate,
  payrollMap,
} from "./folha";
import { proportionalLimit, purchaseLimit, totalPurchases, totalRevenue, yearEntries } from "./mei";
import { showsMeiLimits, isSimplesNacionalCompany } from "./plans";
import type { Company, Employee, Entry, MeiClient, PayrollRun } from "./types";
import { MONTHS } from "./types";
import { formatDate, formatMoney, todayIso } from "./utils";

export type AppAlert = {
  id: string;
  kind: "das" | "limite" | "folha" | "caixa" | "contas";
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
  const isSn = isSimplesNacionalCompany(company);
  const paid = isSn ? new Map() : dasPaidMap(entries);
  const year = Number(today.slice(0, 4));
  const perfil = isSn ? null : resolveDasPerfil(company);
  const totalFor = (y: number, month: number) => (perfil ? dasBreakdown(perfil, y, month).total : 0);
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
      if (isSn) {
        alerts.push({
          id: late ? `das-late:${key}` : `das:${key}`,
          kind: "das",
          level: late ? "danger" : "warn",
          title: late
            ? `DAS Simples de ${ref} em atraso`
            : `DAS Simples de ${ref} vence em ${days === 0 ? "hoje" : `${days} dia${days === 1 ? "" : "s"}`}`,
          body: late
            ? `${nome}: competência em aberto. Venceu em ${formatDate(due)}. Valor conforme o faturamento — confira em Simples Nacional.`
            : `${nome}: emita a guia até ${formatDate(due)}. O valor varia com o faturamento — veja a provisão em Simples Nacional.`,
          href: "/app/simples",
        });
        continue;
      }
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

  const yearList = yearEntries(entries, year);
  const billed = totalRevenue(yearList);
  if (showsMeiLimits(company)) {
    const limit = proportionalLimit(company, year);
    const billedAlert = limitAlert({
      id: `limite:${year}`,
      used: billed,
      limit,
      titleAt: "Limite de faturamento do MEI estourou",
      titleNear: (band) => `Faturamento em ${band}% do limite`,
      name: nome,
      hint100: "Acima do teto proporcional. Revise antes do desenquadramento.",
      hint90: "Muito perto do teto de R$ 81 mil (proporcional à abertura).",
      hint70: "Acompanhe para não cruzar o teto do MEI.",
    });
    if (billedAlert) alerts.push(billedAlert);

    const bought = totalPurchases(yearList);
    const buyLimit = purchaseLimit(company, year);
    const buyAlert = limitAlert({
      id: `limite-compras:${year}`,
      used: bought,
      limit: buyLimit,
      titleAt: "Limite de compras do MEI estourou",
      titleNear: (band) => `Compras em ${band}% do limite`,
      name: nome,
      hint100: "Acima de 80% do teto proporcional de faturamento. Revise as compras de mercadoria.",
      hint90: "Muito perto do teto de compras (80% do limite proporcional).",
      hint70: "Acompanhe para não cruzar o teto de compras do MEI.",
    });
    if (buyAlert) alerts.push(buyAlert);
  }

  if (labor && hasActiveEmployee(labor.employee)) {
    alerts.push(...laborAlerts(labor.employee, labor.payrolls, today));
  }

  for (const week of weekShortfallAlerts(entries, today)) {
    alerts.push({
      id: week.id,
      kind: "caixa",
      level: "danger",
      title: `Vai faltar caixa na semana de ${formatDate(week.start)}`,
      body: `${nome}: o saldo projetado fica negativo até ${formatDate(week.end)} (cerca de ${formatMoney(week.saldo)}). Revise entradas, a receber e a pagar.`,
      href: "/app/fluxo-caixa",
    });
  }

  const remindDays = Math.max(1, Math.min(30, company.lembreteContasDias ?? 3));
  for (const { entry, due } of upcomingDues(entries, remindDays, today)) {
    const receive = entry.status === "a_receber";
    const days = daysBetween(today, due);
    alerts.push({
      id: `contas:${entry.id}:${due}`,
      kind: "contas",
      level: days === 0 ? "danger" : "warn",
      title: receive
        ? days === 0
          ? `Receber hoje · ${entry.contraparte || "cliente"}`
          : `A receber em ${days} dia${days === 1 ? "" : "s"}`
        : days === 0
          ? `Pagar hoje · ${entry.contraparte || "fornecedor"}`
          : `A pagar em ${days} dia${days === 1 ? "" : "s"}`,
      body: `${formatMoney(entry.valor)} · vence ${formatDate(due)}. ${entry.descricao || ""}`.trim(),
      href: "/app/contas",
    });
  }

  return alerts;
}

/** Avisos de um ou mais MEIs. Com vários CNPJs, o id e o título identificam a empresa. */
export function buildPortfolioAlerts(
  clients: Pick<MeiClient, "id" | "status" | "company" | "entries" | "employee" | "payrolls">[],
  today = todayIso(),
): AppAlert[] {
  const active = clients.filter((client) => client.status !== "arquivado");
  const multi = active.length > 1;
  const out: AppAlert[] = [];
  for (const client of active) {
    const nome = client.company?.nome?.trim() || "MEI";
    const alerts = buildAlerts(client.company, client.entries ?? [], today, {
      employee: client.employee ?? null,
      payrolls: client.payrolls,
    });
    for (const alert of alerts) {
      out.push({
        ...alert,
        id: multi ? `${client.id}:${alert.id}` : alert.id,
        title: multi ? `${nome} · ${alert.title}` : alert.title,
      });
    }
  }
  return out;
}

function limitAlert(input: {
  id: string;
  used: number;
  limit: number;
  titleAt: string;
  titleNear: (band: number) => string;
  name: string;
  hint100: string;
  hint90: string;
  hint70: string;
}): AppAlert | null {
  if (input.limit <= 0 || input.used <= 0) return null;
  const pct = (input.used / input.limit) * 100;
  const band = pct >= 100 ? 100 : pct >= 90 ? 90 : pct >= 70 ? 70 : 0;
  if (!band) return null;
  const shown = pct.toFixed(1).replace(".", ",");
  return {
    id: `${input.id}:${band}`,
    kind: "limite",
    level: band >= 100 ? "danger" : "warn",
    title: band >= 100 ? input.titleAt : input.titleNear(band),
    body: `${input.name}: ${formatMoney(input.used)} de ${formatMoney(input.limit)} neste ano (${shown}%). ${
      band >= 100 ? input.hint100 : band >= 90 ? input.hint90 : input.hint70
    }`,
    href: "/app/limites",
  };
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

/** Pro: só limite e DAS. Premium/Contador: todos os kinds. */
export function filterAlertsForPlan(alerts: AppAlert[], premium: boolean): AppAlert[] {
  if (premium) return alerts;
  return alerts.filter((a) => a.kind === "das" || a.kind === "limite");
}

