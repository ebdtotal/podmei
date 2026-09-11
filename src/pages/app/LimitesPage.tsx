import { useMemo, useState } from "react";
import {
  companyLimit,
  excessBand,
  forecastRevenue,
  limitStatus,
  monthlyCeiling,
  monthlyCeilingForMonth,
  monthlySeries,
  monthsActiveInYear,
  proportionalLimit,
  purchaseLimit,
  totalPurchases,
  totalRevenue,
  yearEntries,
} from "@/lib/mei";
import { AlertBanners } from "@/components/alerts/AlertBanners";
import { buildAlerts } from "@/lib/alerts";
import { useStore } from "@/lib/store";
import { MONTHS_SHORT } from "@/lib/types";
import { cn, currentYear, formatMoney, formatPercent } from "@/lib/utils";

export function LimitesPage() {
  const { company, entries } = useStore();
  const [year, setYear] = useState(currentYear());
  const list = useMemo(() => yearEntries(entries, year), [entries, year]);
  const series = monthlySeries(list, year);
  const billed = totalRevenue(list);
  const purchases = totalPurchases(list);
  const annual = companyLimit(company);
  const prop = proportionalLimit(company, year);
  const buy = purchaseLimit(company, year);
  const fat = limitStatus(billed, prop);
  const buySt = limitStatus(purchases, buy);
  const band = excessBand(billed, prop);
  const monthsOpen = monthsActiveInYear(company, year);
  const ceiling = monthlyCeiling(company);
  const { pace, forecast, elapsed } = forecastRevenue(billed, year, monthsOpen);
  const restante = Math.max(0, prop - billed);
  const mesesRestantes = Math.max(0, monthsOpen - elapsed);
  const tetoMensalRestante = mesesRestantes ? restante / mesesRestantes : restante;

  return (
    <div className="space-y-6">
      <AlertBanners alerts={buildAlerts(company, entries).filter((a) => a.kind === "limite")} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Limites de faturamento</h1>
          <p className="mt-1 text-sm text-mute">
            Teto anual, proporcional na abertura, ritmo mensal e faixa de 20% que muda o desenquadramento.
          </p>
        </div>
        <input
          type="number"
          className="input w-28"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        />
      </div>

      <div
        className={cn(
          "rounded-2xl px-5 py-4 text-white",
          fat.tone === "ok" ? "bg-green" : fat.tone === "warn" ? "bg-orange" : "bg-red",
        )}
      >
        <p className="text-xs uppercase tracking-wide text-white/80">{fat.label}</p>
        <p className="mt-1 font-display text-3xl">
          {formatMoney(billed)} <span className="text-lg font-sans">de {formatMoney(prop)}</span>
        </p>
        <p className="mt-1 text-sm text-white/80">
          {monthsOpen < 12
            ? `Limite proporcional: ${monthsOpen} meses em ${year} (abertura em ${company.dataAbertura}). Teto cheio: ${formatMoney(annual)}.`
            : `Limite cheio do MEI: ${formatMoney(annual)}.`}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="Usado no ano" value={formatPercent(fat.pct)} hint={`${formatMoney(billed)}`} />
        <Stat label="Ainda pode faturar" value={formatMoney(restante)} hint={`${mesesRestantes} mês(es) pela frente`} />
        <Stat label="Ritmo até agora" value={formatMoney(pace)} hint={`Média nos ${elapsed} mês(es) apurados`} />
        <Stat
          label="Projeção no ano"
          value={formatMoney(forecast)}
          hint={forecast > prop ? "Acima do teto se o ritmo continuar" : "Cabe no teto se o ritmo se manter"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-paper p-5">
          <h2 className="text-sm font-semibold">Régua do MEI</h2>
          <Bar label="Faturamento vs proporcional" used={billed} limit={prop} />
          <Bar label="Sublimite (20% a mais)" used={billed} limit={band.tetoExcesso} />
          <Bar label="Compras (80% do limite proporcional)" used={purchases} limit={buy} />
          <p className="mt-3 text-xs text-mute">
            {band.band === "ok" && "Até o limite: permanece MEI."}
            {band.band === "sublimite" &&
              `Excesso de ${formatMoney(band.over)} (até 20%). Permanece MEI neste ano, paga acréscimo na DASN e é desenquadrado em janeiro.`}
            {band.band === "desenquadramento" &&
              `Excesso de ${formatMoney(band.over)} (acima de 20%). Desenquadramento retroativo ao janeiro do ano. Fale com o contador.`}
          </p>
          <p className={cn("mt-2 text-xs font-semibold", buySt.tone === "ok" ? "text-green" : "text-orange")}>
            Compras: {buySt.label.toLowerCase()} ({formatPercent(buySt.pct)})
          </p>
        </section>
        <section className="rounded-2xl border border-line bg-paper p-5">
          <h2 className="text-sm font-semibold">Ritmo mensal recomendado</h2>
          <p className="mt-2 text-sm">
            Teto linear: {formatMoney(ceiling)} / mês sobre {formatMoney(annual)}.
          </p>
          <p className="mt-1 text-sm">
            Daqui para frente: {formatMoney(tetoMensalRestante)} / mês para não estourar o proporcional.
          </p>
          <ul className="mt-4 space-y-1 text-xs text-mute">
            <li>MEI comum: {formatMoney(annual)} no ano civil.</li>
            <li>Abertura no meio do ano: (teto ÷ 12) × meses restantes, inclusive o mês da abertura.</li>
            <li>Compras de mercadoria: até 80% do limite proporcional do ano.</li>
          </ul>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-line bg-paper">
        <div className="border-b border-line px-4 py-3 text-sm font-semibold">Faturamento × teto mensal</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg text-left text-xs text-mute">
              <tr>
                <th className="px-4 py-2">Mês</th>
                <th>Faturado</th>
                <th>Teto linear</th>
                <th>Saldo do mês</th>
              </tr>
            </thead>
            <tbody>
              {series.map((row) => {
                const teto = monthlyCeilingForMonth(company, year, row.month);
                const delta = teto - row.faturamento;
                return (
                  <tr key={row.month} className="border-t border-line">
                    <td className="px-4 py-2">{MONTHS_SHORT[row.month]}</td>
                    <td>{formatMoney(row.faturamento)}</td>
                    <td>{formatMoney(teto)}</td>
                    <td className={teto <= 0 && row.faturamento <= 0 ? "text-mute" : delta >= 0 ? "text-green" : "text-red"}>
                      {formatMoney(delta)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-line bg-paper p-4">
      <p className="text-xs text-mute">{label}</p>
      <p className="mt-1 font-display text-2xl text-ink">{value}</p>
      <p className="mt-1 text-xs text-mute">{hint}</p>
    </div>
  );
}

function Bar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit <= 0 ? 0 : (used / limit) * 100;
  return (
    <div className="mt-4">
      <div className="flex justify-between text-xs text-mute">
        <span>{label}</span>
        <span>{formatPercent(pct)}</span>
      </div>
      <p className="text-sm">
        {formatMoney(used)} de {formatMoney(limit)}
      </p>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-bg">
        <div
          className={cn("h-full", pct >= 100 ? "bg-red" : pct >= 80 ? "bg-orange" : "bg-green")}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}
