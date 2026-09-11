import type { Investment, InvestmentMovement } from "./types";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function investmentBalance(movements: InvestmentMovement[], investmentId?: string) {
  let saldo = 0;
  for (const m of movements) {
    if (investmentId && m.investmentId !== investmentId) continue;
    if (m.kind === "aporte" || m.kind === "rendimento") saldo += m.valor;
    else if (m.kind === "resgate") saldo -= m.valor;
  }
  return round2(saldo);
}

export function investmentsSummary(investments: Investment[], movements: InvestmentMovement[]) {
  const rows = investments.map((inv) => ({
    investment: inv,
    saldo: investmentBalance(movements, inv.id),
  }));
  const total = round2(rows.reduce((a, r) => a + r.saldo, 0));
  const aportes = round2(
    movements.filter((m) => m.kind === "aporte").reduce((a, m) => a + m.valor, 0),
  );
  const resgates = round2(
    movements.filter((m) => m.kind === "resgate").reduce((a, m) => a + m.valor, 0),
  );
  const rendimentos = round2(
    movements.filter((m) => m.kind === "rendimento").reduce((a, m) => a + m.valor, 0),
  );
  return { rows, total, aportes, resgates, rendimentos };
}

export function yieldLabel(inv: Investment) {
  if (inv.yieldKind === "pre") return `${inv.taxa.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% a.a. pré`;
  return `${inv.taxa.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% do CDI`;
}

/** Efeito no caixa operacional: aporte sai, resgate entra; rendimento fica investido. */
export function cashDeltaForInvestmentMove(m: InvestmentMovement) {
  if (m.kind === "aporte") return -m.valor;
  if (m.kind === "resgate") return m.valor;
  return 0;
}
