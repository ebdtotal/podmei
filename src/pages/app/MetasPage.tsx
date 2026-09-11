import { useMemo, useState } from "react";
import { goalProgress } from "@/lib/insights";
import { proportionalLimit, totalRevenue, yearEntries } from "@/lib/mei";
import { useStore } from "@/lib/store";
import { MONTHS } from "@/lib/types";
import { cn, currentYear, formatMoney, monthIndex, todayIso } from "@/lib/utils";

export function MetasPage() {
  const { company, entries, setCompany } = useStore();
  const year = currentYear();
  const month = monthIndex(todayIso());
  const yearList = yearEntries(entries, year);
  const monthList = yearList.filter((e) => monthIndex(e.data) === month);
  const billedYear = totalRevenue(yearList);
  const billedMonth = totalRevenue(monthList);
  const fatLimit = proportionalLimit(company, year);

  const [metaMes, setMetaMes] = useState(String(company.metaFaturamentoMes ?? ""));
  const [metaAno, setMetaAno] = useState(String(company.metaFaturamentoAno ?? Math.round(fatLimit)));
  const [lembrete, setLembrete] = useState(String(company.lembreteContasDias ?? 3));
  const [saved, setSaved] = useState("");

  const mesGoal = goalProgress(billedMonth, Number(metaMes) || 0);
  const anoGoal = goalProgress(billedYear, Number(metaAno) || 0);
  const limiteGoal = goalProgress(billedYear, fatLimit);

  const tip = useMemo(() => {
    if (!mesGoal.meta) return "Defina a meta do mês para acompanhar o ritmo.";
    if (mesGoal.ok) return "Meta do mês atingida.";
    const daysLeft = new Date(year, month + 1, 0).getDate() - Number(todayIso().slice(8));
    const need = mesGoal.restante;
    return daysLeft > 0
      ? `Faltam ${formatMoney(need)} em cerca de ${daysLeft} dia${daysLeft === 1 ? "" : "s"}.`
      : `Faltam ${formatMoney(need)} neste mês.`;
  }, [mesGoal, month, year]);

  function save() {
    setCompany({
      ...company,
      metaFaturamentoMes: Number(metaMes) || 0,
      metaFaturamentoAno: Number(metaAno) || 0,
      lembreteContasDias: Math.max(1, Math.min(30, Number(lembrete) || 3)),
    });
    setSaved("Metas salvas.");
    window.setTimeout(() => setSaved(""), 2000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink">Metas</h1>
        <p className="mt-1 text-sm text-mute">
          Faturamento do mês e do ano versus suas metas e o limite do MEI ({formatMoney(fatLimit)}).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <GoalCard title={`Meta · ${MONTHS[month]}`} progress={mesGoal} hint={tip} />
        <GoalCard title={`Meta · ${year}`} progress={anoGoal} />
        <GoalCard title="Limite MEI (proporcional)" progress={limiteGoal} />
      </div>

      <section className="rounded-2xl border border-line bg-paper p-5">
        <h2 className="text-sm font-semibold">Definir metas</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium text-mute">
            Meta do mês (R$)
            <input className="input mt-1.5" type="number" min="0" step="100" value={metaMes} onChange={(e) => setMetaMes(e.target.value)} />
          </label>
          <label className="text-xs font-medium text-mute">
            Meta do ano (R$)
            <input className="input mt-1.5" type="number" min="0" step="100" value={metaAno} onChange={(e) => setMetaAno(e.target.value)} />
          </label>
          <label className="text-xs font-medium text-mute">
            Lembrete a receber/pagar (dias antes)
            <input className="input mt-1.5" type="number" min="1" max="30" value={lembrete} onChange={(e) => setLembrete(e.target.value)} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary" onClick={save}>
            Salvar metas
          </button>
          {saved ? <p className="text-sm text-green">{saved}</p> : null}
        </div>
      </section>
    </div>
  );
}

function GoalCard({ title, progress, hint }: { title: string; progress: ReturnType<typeof goalProgress>; hint?: string }) {
  const pct = Math.min(100, progress.pct);
  const tone = progress.ok ? "bg-green" : progress.pct >= 70 ? "bg-orange" : "bg-navy";
  return (
    <div className="rounded-2xl border border-line bg-paper p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-mute">{title}</p>
      <p className="mt-2 font-display text-2xl">{formatMoney(progress.atual)}</p>
      <p className="text-xs text-mute">de {formatMoney(progress.meta) || "—"}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg">
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-sm font-semibold">{progress.meta ? `${progress.pct}%` : "Sem meta"}</p>
      {hint ? <p className="mt-1 text-xs text-mute">{hint}</p> : null}
    </div>
  );
}
