import { dasLateCount } from "./das";
import { hasActiveEmployee, openPayrollCount } from "./folha";
import {
  excessBand,
  limitStatus,
  proportionalLimit,
  totalPurchases,
  totalRevenue,
  yearEntries,
} from "./mei";
import type { MeiClient } from "./types";
import { currentYear } from "./utils";

export function clientSnapshot(client: MeiClient, year = currentYear()) {
  const entries = client.entries ?? [];
  const list = yearEntries(entries, year);
  const billed = totalRevenue(list);
  const purchases = totalPurchases(list);
  const limite = proportionalLimit(client.company, year);
  const fat = limitStatus(billed, limite);
  const excesso = excessBand(billed, limite);
  const dasAtraso = dasLateCount(entries, year);
  const receber = entries.filter((e) => e.status === "a_receber").reduce((s, e) => s + e.valor, 0);
  const pagar = entries.filter((e) => e.status === "a_pagar").reduce((s, e) => s + e.valor, 0);
  return {
    billed,
    purchases,
    limite,
    fat,
    excesso,
    dasAtraso,
    receber,
    pagar,
    hasEmployee: hasActiveEmployee(client.employee),
    folhaAberta: openPayrollCount(client.payrolls, year),
  };
}
