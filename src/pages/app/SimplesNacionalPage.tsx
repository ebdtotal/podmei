import { useMemo, useState } from "react";
import { Calculator, Printer } from "lucide-react";
import { MoneyBrInput } from "@/components/ui/MoneyBrInput";
import { printOrSharePdf } from "@/lib/print";
import {
  provisaoSimplesMes,
  SIMPLES_ANEXO_III,
  type SimplesReceitaHistorico,
} from "@/lib/simples";
import { useStore } from "@/lib/store";
import { MONTHS } from "@/lib/types";
import { cn, currentYear, formatMoney, formatPercent } from "@/lib/utils";

export function SimplesNacionalPage() {
  const { company, entries, setCompany } = useStore();
  const now = new Date();
  const [year, setYear] = useState(currentYear());
  const [month, setMonth] = useState(now.getMonth());
  const historico = company.simplesReceitaHistorico ?? {};
  const calc = useMemo(
    () => provisaoSimplesMes(entries, year, month, historico, company.dataAbertura),
    [entries, year, month, historico, company.dataAbertura],
  );

  function setHistoricoValor(key: string, valor: number) {
    const next: SimplesReceitaHistorico = { ...historico };
    if (valor > 0) next[key] = Math.round(valor * 100) / 100;
    else delete next[key];
    setCompany({ ...company, simplesReceitaHistorico: next });
  }

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-navy">Simples Nacional</p>
          <h1 className="font-display text-3xl text-ink">Provisão do imposto</h1>
          <p className="mt-1 max-w-2xl text-sm text-mute">
            Anexo III — alíquotas nominais a partir de 6%, conforme a receita bruta acumulada nos últimos 12 meses
            (RBT12). A alíquota efetiva = [(RBT12 × nominal) − dedução] ÷ RBT12, aplicada à receita do mês.
          </p>
        </div>
        <button type="button" className="btn-primary gap-2" onClick={() => void printOrSharePdf("provisao-simples.pdf")}>
          <Printer className="size-4" />
          Gerar PDF
        </button>
      </div>

      <div className="no-print flex flex-wrap gap-3">
        <label className="text-xs font-medium text-mute">
          Ano
          <input
            type="number"
            className="input mt-1 w-28"
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || currentYear())}
          />
        </label>
        <label className="text-xs font-medium text-mute">
          Competência
          <select className="input mt-1" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((label, i) => (
              <option key={label} value={i}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <article className="print-sheet space-y-6">
        <div className="hidden text-center print:block">
          <h2 className="text-sm font-bold">PROVISÃO SIMPLES NACIONAL — ANEXO III</h2>
          <p className="mt-1 text-xs">
            {company.nome} · CNPJ {company.cnpj} · {MONTHS[month]}/{year}
          </p>
        </div>

        {calc.ultrapassou ? (
          <p className="rounded-2xl bg-red px-4 py-3 text-sm text-white">
            RBT12 acima de R$ 4.800.000 — fora do teto do Simples Nacional nesta tabela. Confira com o contador o
            desenquadramento.
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label={
              calc.rbtMode === "cheia"
                ? "RBT12 (12 meses anteriores)"
                : calc.rbtMode === "proporcional_1"
                  ? "RBT12 (1º mês × 12)"
                  : "RBT12 (média × 12)"
            }
            value={formatMoney(calc.rbt12)}
          />
          <Stat label={`Receita ${MONTHS[month]}`} value={formatMoney(calc.receitaMes)} />
          <Stat
            label="Faixa / alíquota efetiva"
            value={calc.faixa ? `${calc.faixa.label} · ${formatPercent(calc.efetiva * 100)}` : "—"}
          />
          <Stat label="Provisão do mês" value={formatMoney(calc.imposto)} highlight />
        </div>

        {calc.rbtMode !== "cheia" ? (
          <p className="no-print rounded-2xl border border-navy/20 bg-navy/5 px-4 py-3 text-sm text-ink">
            Empresa nova
            {calc.activityMonth ? ` · ${calc.activityMonth}º mês de atividade` : ""}. RBT12 proporcional
            {calc.rbtMode === "proporcional_1"
              ? `: faturamento do mês × 12.`
              : `: média dos ${calc.mesesVividos} meses já vividos (${formatMoney(calc.mediaMensal)}) × 12.`}
          </p>
        ) : null}

        <section className="no-print space-y-3 rounded-2xl border border-line bg-paper p-5">
          <div>
            <h2 className="font-semibold text-ink">
              {calc.rbtMode === "cheia"
                ? "Faturamento dos últimos 12 meses (RBT12)"
                : "Faturamento dos meses já vividos"}
            </h2>
            <p className="mt-1 text-sm text-mute">
              Digite o faturamento de cada mês para iniciar a alíquota. Quando houver receita lançada no sistema, o
              campo é autopreenchido com esse total e passa a seguir os lançamentos.
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-line bg-bg text-xs uppercase tracking-wide text-mute">
                <tr>
                  <th className="px-4 py-3">Mês</th>
                  <th className="px-4 py-3">Faturamento</th>
                  <th className="px-4 py-3">Origem</th>
                </tr>
              </thead>
              <tbody>
                {calc.months.map((row) => {
                  const fromLancamentos = row.source === "lancamentos";
                  const display = fromLancamentos ? row.lancado : (historico[row.key] ?? 0);
                  return (
                    <tr key={row.key} className="border-t border-line">
                      <td className="px-4 py-3 font-medium">
                        {MONTHS[row.month]}/{row.year}
                      </td>
                      <td className="px-4 py-3">
                        <MoneyBrInput
                          className={cn("input max-w-[12rem]", fromLancamentos && "bg-bg text-ink")}
                          value={display}
                          onChange={(valor) => {
                            if (!fromLancamentos) setHistoricoValor(row.key, valor);
                          }}
                          min={0}
                          readOnly={fromLancamentos}
                          aria-label={`Faturamento ${MONTHS[row.month]} ${row.year}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-xs text-mute">
                        {fromLancamentos
                          ? "Autopreenchido pelos lançamentos"
                          : display > 0
                            ? "Digitado manualmente"
                            : "Digite o faturamento"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-line bg-navy/5 font-semibold text-ink">
                  <td className="px-4 py-3">
                    {calc.rbtMode === "cheia"
                      ? "RBT12 (soma dos 12 meses)"
                      : calc.rbtMode === "proporcional_1"
                        ? "RBT12 (mês × 12)"
                        : `RBT12 (média × 12)`}
                  </td>
                  <td className="px-4 py-3" colSpan={2}>
                    {formatMoney(calc.rbt12)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-paper p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-navy text-white">
              <Calculator className="size-5" />
            </span>
            <div>
              <h2 className="font-semibold">Como foi calculado</h2>
              <p className="mt-1 text-sm text-mute">
                {calc.rbtMode === "proporcional_1"
                  ? `Empresa no 1º mês de atividade: RBT12 = faturamento de ${MONTHS[month]}/${year} × 12.`
                  : calc.rbtMode === "proporcional_media"
                    ? `Empresa no ${calc.activityMonth}º mês de atividade: RBT12 = média dos ${calc.mesesVividos} meses já vividos (${formatMoney(calc.mediaMensal)}) × 12.`
                    : `RBT12 = receita bruta dos 12 meses anteriores a ${MONTHS[month]}/${year} (histórico informado + lançamentos).`}{" "}
                A alíquota efetiva multiplica a receita do mês ({formatMoney(calc.receitaMes)}).
              </p>
              {calc.faixa ? (
                <p className="mt-2 text-sm">
                  Nominal {formatPercent(calc.faixa.aliquota * 100)} − dedução {formatMoney(calc.faixa.deduzir)} →
                  efetiva {formatPercent(calc.efetiva * 100)} → imposto {formatMoney(calc.imposto)}.
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="overflow-x-auto rounded-2xl border border-line bg-paper">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-line bg-bg text-xs uppercase tracking-wide text-mute">
              <tr>
                <th className="px-4 py-3">Faixa</th>
                <th className="px-4 py-3">Receita bruta em 12 meses (R$)</th>
                <th className="px-4 py-3">Alíquota nominal</th>
                <th className="px-4 py-3">Valor a deduzir (R$)</th>
              </tr>
            </thead>
            <tbody>
              {SIMPLES_ANEXO_III.map((f) => {
                const active = calc.faixa?.faixa === f.faixa;
                return (
                  <tr
                    key={f.faixa}
                    className={cn("border-t border-line", active && "bg-navy/10 font-semibold text-ink")}
                  >
                    <td className="px-4 py-3">{f.label}</td>
                    <td className="px-4 py-3">
                      {f.faixa === 1
                        ? `Até ${formatMoney(f.max)}`
                        : `De ${formatMoney(f.min)} a ${formatMoney(f.max)}`}
                    </td>
                    <td className="px-4 py-3">{formatPercent(f.aliquota * 100)}</td>
                    <td className="px-4 py-3">{formatMoney(f.deduzir)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </article>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-2xl border border-line px-4 py-4", highlight ? "bg-navy text-white" : "bg-paper")}>
      <p className={cn("text-xs uppercase tracking-wide", highlight ? "text-white/80" : "text-mute")}>{label}</p>
      <p className="mt-1 font-display text-2xl">{value}</p>
    </div>
  );
}
