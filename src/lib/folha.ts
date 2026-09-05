import { SALARIO_MINIMO } from "./das";
import type { Employee, Entry, PayrollKind, PayrollRun } from "./types";
import { isoDate, todayIso, uid } from "./utils";

export const INSS_PATRONAL_MEI = 0.03;
export const FGTS_MEI = 0.08;
export const VT_DESCONTO_TETO = 0.06;
export const INSS_TETO_2026 = 8_475.55;

const INSS_FAIXAS_2026 = [
  { upTo: 1_621, rate: 0.075 },
  { upTo: 2_902.84, rate: 0.09 },
  { upTo: 4_354.27, rate: 0.12 },
  { upTo: INSS_TETO_2026, rate: 0.14 },
] as const;

export const payrollKindLabel: Record<PayrollKind, string> = {
  mensal: "Folha mensal",
  decimo: "13º salário",
  ferias: "Férias + 1/3",
};

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function employeeInss(bruto: number) {
  const base = Math.min(Math.max(bruto, 0), INSS_TETO_2026);
  let prev = 0;
  let total = 0;
  for (const faixa of INSS_FAIXAS_2026) {
    if (base <= prev) break;
    const slice = Math.min(base, faixa.upTo) - prev;
    total += slice * faixa.rate;
    prev = faixa.upTo;
  }
  return round2(total);
}

export function legalSalaryFloor(employee: Pick<Employee, "pisoCategoria">) {
  return round2(Math.max(SALARIO_MINIMO, employee.pisoCategoria || 0));
}

export function salaryOutOfMeiRange(employee: Pick<Employee, "salario" | "pisoCategoria">) {
  const teto = legalSalaryFloor(employee);
  if (employee.salario + 0.009 < teto) return "abaixo";
  if (employee.salario - 0.009 > teto) return "acima";
  return null;
}

export function fifthBusinessDay(year: number, month: number) {
  let day = 1;
  let count = 0;
  while (count < 5 && day < 32) {
    const date = new Date(year, month, day);
    if (date.getMonth() !== month) break;
    const wd = date.getDay();
    if (wd !== 0 && wd !== 6) {
      count += 1;
      if (count === 5) return isoDate(date);
    }
    day += 1;
  }
  return isoDate(new Date(year, month, 7));
}

export function salaryDueDate(year: number, month: number) {
  const due = new Date(year, month + 1, 1);
  return fifthBusinessDay(due.getFullYear(), due.getMonth());
}

export function daeDueDate(year: number, month: number) {
  return isoDate(new Date(year, month + 1, 20));
}

export function payrollCompetenceKey(year: number, month: number, kind: PayrollKind) {
  return `${kind}-${year}-${String(month + 1).padStart(2, "0")}`;
}

export function competenceLabel(year: number, month: number) {
  return `${String(month + 1).padStart(2, "0")}/${year}`;
}

export function calcPayroll(input: {
  employee: Employee;
  year: number;
  month: number;
  kind: PayrollKind;
  extras?: number;
}): Omit<PayrollRun, "id" | "salaryPaid" | "daePaid" | "salaryEntryId" | "daeEntryId" | "createdAt"> {
  const extras = round2(Math.max(input.extras ?? 0, 0));
  let bruto = round2(input.employee.salario + extras);
  if (input.kind === "ferias") bruto = round2(input.employee.salario * (4 / 3) + extras);
  if (input.kind === "decimo") bruto = round2(input.employee.salario + extras);

  const valeTransporte = input.kind === "mensal" ? round2(input.employee.valeTransporte || 0) : 0;
  const inssEmpregado = employeeInss(bruto);
  const descontoVt = round2(Math.min(valeTransporte, bruto * VT_DESCONTO_TETO));
  const liquido = round2(bruto - inssEmpregado - descontoVt);
  const inssPatronal = round2(bruto * INSS_PATRONAL_MEI);
  const fgts = round2(bruto * FGTS_MEI);
  const dae = round2(inssPatronal + fgts + inssEmpregado);
  const provision13 = input.kind === "mensal" ? round2(input.employee.salario / 12) : 0;
  const provisionFerias = input.kind === "mensal" ? round2((input.employee.salario / 12) * (4 / 3)) : 0;
  const custoMei = round2(liquido + dae + (valeTransporte - descontoVt));

  return {
    employeeId: input.employee.id,
    employeeNome: input.employee.nome,
    year: input.year,
    month: input.month,
    kind: input.kind,
    bruto,
    extras,
    valeTransporte,
    inssEmpregado,
    descontoVt,
    liquido,
    inssPatronal,
    fgts,
    dae,
    provision13,
    provisionFerias,
    custoMei,
  };
}

export function buildPayroll(input: {
  employee: Employee;
  year: number;
  month: number;
  kind: PayrollKind;
  extras?: number;
  existing?: PayrollRun;
}): PayrollRun {
  const calc = calcPayroll(input);
  return {
    id: input.existing?.id ?? uid("fol"),
    ...calc,
    salaryPaid: input.existing?.salaryPaid ?? false,
    daePaid: input.existing?.daePaid ?? false,
    salaryEntryId: input.existing?.salaryEntryId,
    daeEntryId: input.existing?.daeEntryId,
    createdAt: input.existing?.createdAt ?? todayIso(),
  };
}

export function salaryExpense(run: PayrollRun, paidOn: string): Entry {
  return {
    id: uid("lan"),
    data: paidOn,
    contraparte: run.employeeNome,
    documento: `HOLERITE ${competenceLabel(run.year, run.month)}`,
    kind: "despesa",
    valor: run.liquido,
    descricao:
      run.kind === "mensal"
        ? "SALÁRIO COLABORADOR"
        : run.kind === "decimo"
          ? "13º SALÁRIO COLABORADOR"
          : "FÉRIAS COLABORADOR",
    status: "liquidado",
    documentoFiscal: false,
    formaPagamento: "pix",
    source: "manual",
  };
}

export function daeExpense(run: PayrollRun, paidOn: string): Entry {
  return {
    id: uid("lan"),
    data: paidOn,
    contraparte: "eSocial / Receita Federal",
    documento: `DAE ${competenceLabel(run.year, run.month)}`,
    kind: "despesa",
    valor: run.dae,
    descricao: "DAE eSocial — INSS + FGTS do colaborador",
    status: "liquidado",
    documentoFiscal: false,
    formaPagamento: "boleto",
    source: "manual",
  };
}

export function hasActiveEmployee(
  employee: Employee | null | undefined,
): employee is Employee & { status: "ativo" } {
  return Boolean(employee && employee.status === "ativo");
}

export function payrollMap(payrolls: PayrollRun[] | undefined) {
  const map = new Map<string, PayrollRun>();
  for (const run of payrolls ?? []) {
    map.set(payrollCompetenceKey(run.year, run.month, run.kind), run);
  }
  return map;
}

export function openPayrollCount(payrolls: PayrollRun[] | undefined, year: number, today = todayIso()) {
  let n = 0;
  for (const run of payrolls ?? []) {
    if (run.year !== year || run.kind !== "mensal") continue;
    const due = daeDueDate(run.year, run.month);
    if (due < today && (!run.salaryPaid || !run.daePaid)) n += 1;
  }
  return n;
}
