import { Download, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { CashBars } from "@/components/charts/CashBars";
import { buildCashMonth, buildCashYear, openingBalanceBefore } from "@/lib/cashflow";
import { exportCashflowExcel, exportCashYearExcel } from "@/lib/exportReports";
import { printOrSharePdf } from "@/lib/print";
import { useStore } from "@/lib/store";
import { MONTHS, MONTHS_SHORT } from "@/lib/types";
import { cn, currentYear, formatDate, formatMoney } from "@/lib/utils";

type ViewMode = "ano" | "mes";

export function FluxoCaixaPage() {
  const { company, entries, investmentMovements } = useStore();
  const now = new Date();
  const [year, setYear] = useState(currentYear());
  const [month, setMonth] = useState(now.getMonth());
  const [view, setView] = useState<ViewMode>("ano");

  const yearOptions = useMemo(() => {
    const years = new Set<number>([currentYear(), currentYear() - 1, currentYear() - 2]);
    for (const e of entries) {
      const y = Number(e.data.slice(0, 4));
      if (y) years.add(y);
    }
    for (const m of investmentMovements) {
      const y = Number(m.data.slice(0, 4));
      if (y) years.add(y);
    }
    return [...years].sort((a, b) => b - a);
  }, [entries, investmentMovements]);

  const yearCash = useMemo(
    () => buildCashYear(entries, year, investmentMovements),
    [entries, year, investmentMovements],
  );
  const opening = useMemo(
    () => openingBalanceBefore(entries, year, month, investmentMovements),
    [entries, year, month, investmentMovements],
  );
  const cash = useMemo(
    () => buildCashMonth(entries, year, month, opening, investmentMovements),
    [entries, year, month, opening, investmentMovements],
  );

  const monthPoints = yearCash.months.map((m) => ({
    label: MONTHS_SHORT[m.month],
    entradas: m.entradas + m.aReceber,
    saidas: m.saidas + m.aPagar,
    saldo: m.saldoProjetado,
  }));

  const weekPoints = cash.weeks.map((w, i) => ({
    label: `S${i + 1}`,
    entradas: w.entradas,
    saidas: w.saidas,
    saldo: w.saldoFinal,
  }));

  const dayBars = cash.days
    .filter((d) => d.entradas || d.saidas || d.receber || d.pagar)
    .slice(0, 31)
    .map((d) => ({
      label: d.date.slice(8),
      entradas: d.entradas + d.receber,
      saidas: d.saidas + d.pagar,
      saldo: d.saldo,
    }));

  function exportExcel() {
    if (view === "ano") exportCashYearExcel(yearCash, `fluxo-caixa-${year}.xlsx`);
    else exportCashflowExcel(cash, `fluxo-caixa-${year}-${month + 1}.xlsx`);
  }

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Fluxo de caixa</h1>
          <p className="mt-1 max-w-2xl text-sm text-mute">
            Filtre pelo ano para ver o fluxo mensal, ou abra um mês para o detalhe por semana e dia.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium text-mute">
            Ano
            <select
              className="input mt-1.5 w-28"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <div className="flex rounded-full border border-line bg-bg p-0.5" role="group" aria-label="Visão">
            <button
              type="button"
              className={view === "ano" ? "btn-primary !px-3 !py-2 text-xs" : "btn-ghost !px-3 !py-2 text-xs border-0"}
              aria-pressed={view === "ano"}
              onClick={() => setView("ano")}
            >
              Ano (mensal)
            </button>
            <button
              type="button"
              className={view === "mes" ? "btn-primary !px-3 !py-2 text-xs" : "btn-ghost !px-3 !py-2 text-xs border-0"}
              aria-pressed={view === "mes"}
              onClick={() => setView("mes")}
            >
              Mês
            </button>
          </div>
          {view === "mes" ? (
            <label className="text-xs font-medium text-mute">
              Mês
              <select
                className="input mt-1.5 w-auto"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {MONTHS.map((name, i) => (
                  <option key={name} value={i}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button type="button" className="btn-ghost gap-2" onClick={exportExcel}>
            <Download className="size-4" />
            Excel
          </button>
          <button type="button" className="btn-primary gap-2" onClick={() => void printOrSharePdf("fluxo-caixa.pdf")}>
            <Printer className="size-4" />
            PDF
          </button>
        </div>
      </div>

      <article className="print-sheet space-y-6">
        <div className="hidden text-center print:block">
          <h2 className="text-sm font-bold">
            FLUXO DE CAIXA · {view === "ano" ? year : `${MONTHS[month].toUpperCase()}/${year}`}
          </h2>
          <p className="mt-1 text-xs">
            {company.nome} · CNPJ {company.cnpj}
          </p>
        </div>

        {view === "ano" ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Kpi label={`Entradas ${year}`} value={yearCash.entradas} tone="text-green" />
              <Kpi label={`Saídas ${year}`} value={yearCash.saidas} tone="text-orange" />
              <Kpi label="A receber no ano" value={yearCash.aReceber} tone="text-blue" />
              <Kpi label="A pagar no ano" value={yearCash.aPagar} tone="text-red" />
              <Kpi
                label="Saldo projetado (dez)"
                value={yearCash.saldoProjetado}
                tone={yearCash.saldoProjetado < 0 ? "text-red" : "text-ink"}
              />
            </div>

            <section className="space-y-4">
              <CashBars points={monthPoints} title={`Fluxo mensal · ${year}`} />
              <div className="overflow-x-auto rounded-2xl border border-line bg-paper p-4">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-mute">
                    <tr>
                      <th className="py-2">Mês</th>
                      <th>Entradas</th>
                      <th>Saídas</th>
                      <th>A receber</th>
                      <th>A pagar</th>
                      <th>Saldo projetado</th>
                      <th className="no-print" />
                    </tr>
                  </thead>
                  <tbody>
                    {yearCash.months.map((m) => (
                      <tr key={m.month} className="border-t border-line">
                        <td className="py-2 font-medium">{MONTHS[m.month]}</td>
                        <td>{formatMoney(m.entradas)}</td>
                        <td>{formatMoney(m.saidas)}</td>
                        <td>{formatMoney(m.aReceber)}</td>
                        <td>{formatMoney(m.aPagar)}</td>
                        <td className={cn(m.saldoProjetado < 0 && "font-semibold text-red")}>
                          {formatMoney(m.saldoProjetado)}
                        </td>
                        <td className="no-print text-right">
                          <button
                            type="button"
                            className="text-xs font-semibold text-navy"
                            onClick={() => {
                              setMonth(m.month);
                              setView("mes");
                            }}
                          >
                            Detalhar
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-line font-bold">
                      <td className="py-2">Total</td>
                      <td>{formatMoney(yearCash.entradas)}</td>
                      <td>{formatMoney(yearCash.saidas)}</td>
                      <td>{formatMoney(yearCash.aReceber)}</td>
                      <td>{formatMoney(yearCash.aPagar)}</td>
                      <td>{formatMoney(yearCash.saldoProjetado)}</td>
                      <td className="no-print" />
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Kpi label="Entradas liquidadas" value={cash.entradas} tone="text-green" />
              <Kpi label="Saídas liquidadas" value={cash.saidas} tone="text-orange" />
              <Kpi label="A receber no mês" value={cash.aReceber} tone="text-blue" />
              <Kpi label="A pagar no mês" value={cash.aPagar} tone="text-red" />
              <Kpi
                label="Saldo projetado"
                value={cash.saldoProjetado}
                tone={cash.saldoProjetado < 0 ? "text-red" : "text-ink"}
              />
            </div>

            <section className="space-y-4">
              <CashBars points={weekPoints} title={`Semanas · ${MONTHS[month]}/${year}`} />
              <div className="overflow-x-auto rounded-2xl border border-line bg-paper p-4">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-mute">
                    <tr>
                      <th className="py-2">Semana</th>
                      <th>Entradas</th>
                      <th>Saídas</th>
                      <th>Saldo final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cash.weeks.map((w, i) => (
                      <tr key={w.start} className="border-t border-line">
                        <td className="py-2">
                          S{i + 1} · {formatDate(w.start)}–{formatDate(w.end)}
                          {w.shortfall ? (
                            <span className="ml-2 text-[10px] font-bold uppercase text-red">Falta caixa</span>
                          ) : null}
                        </td>
                        <td>{formatMoney(w.entradas)}</td>
                        <td>{formatMoney(w.saidas)}</td>
                        <td className={cn(w.saldoFinal < 0 && "font-semibold text-red")}>{formatMoney(w.saldoFinal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {dayBars.length ? (
              <CashBars points={dayBars} title="Dias com movimento" />
            ) : (
              <p className="rounded-2xl border border-line bg-paper px-4 py-6 text-sm text-mute">
                Sem movimentos neste mês. Lance vendas, despesas ou contas a receber/pagar para projetar o caixa.
              </p>
            )}
          </>
        )}
      </article>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-line bg-paper px-4 py-3">
      <p className="text-xs text-mute">{label}</p>
      <p className={cn("mt-1 font-display text-2xl", tone)}>{formatMoney(value)}</p>
    </div>
  );
}
