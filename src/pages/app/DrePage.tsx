import { Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { BackToReports } from "@/components/layout/BackToReports";
import { dre } from "@/lib/books";
import { printOrSharePdf } from "@/lib/print";
import { useStore } from "@/lib/store";
import { MONTHS } from "@/lib/types";
import { cn, currentYear, formatMoney } from "@/lib/utils";

export function DrePage() {
  const { company, entries } = useStore();
  const [year, setYear] = useState(currentYear());
  const [month, setMonth] = useState<number | "ano">("ano");
  const lines = useMemo(
    () => dre(entries, year, month === "ano" ? undefined : month),
    [entries, year, month],
  );
  const resultado = lines.find((l) => l.label.startsWith("Resultado"))?.value ?? 0;
  const periodo = month === "ano" ? String(year) : `${MONTHS[month]}/${year}`;

  return (
    <div className="space-y-6">
      <BackToReports />
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">DRE</h1>
          <p className="mt-1 text-sm text-mute">
            Demonstração do resultado do exercício a partir das vendas, compras e despesas lançadas.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            className="input w-auto"
            value={month}
            onChange={(e) => setMonth(e.target.value === "ano" ? "ano" : Number(e.target.value))}
          >
            <option value="ano">Ano inteiro</option>
            {MONTHS.map((name, i) => (
              <option key={name} value={i}>
                {name}
              </option>
            ))}
          </select>
          <input type="number" className="input w-28" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          <button className="btn-primary gap-2" onClick={() => void printOrSharePdf("dre.pdf")}>
            <Printer className="size-4" />
            Imprimir
          </button>
        </div>
      </div>

      <div className={cn("rounded-2xl px-5 py-4 text-white", resultado >= 0 ? "bg-green" : "bg-red")}>
        <p className="text-xs uppercase tracking-wide text-white/80">Resultado {periodo}</p>
        <p className="mt-1 font-display text-3xl">{formatMoney(resultado)}</p>
      </div>

      <article className="print-sheet mx-auto max-w-3xl border border-ink bg-paper p-8 text-[13px]">
        <h2 className="text-center text-base font-bold">DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO</h2>
        <p className="mt-1 text-center text-[11px]">
          {company.nome} · CNPJ {company.cnpj} · {periodo}
        </p>
        <div className="mt-6 border border-ink">
          {lines
            .filter((l) => !l.muted || l.indent)
            .filter((l) => !l.label.startsWith("DRE"))
            .map((line) => (
              <div
                key={line.label}
                className={cn(
                  "grid grid-cols-[1fr_160px] border-b border-ink last:border-b-0",
                  line.bold && "bg-bg font-bold",
                )}
              >
                <div className="px-3 py-2" style={{ paddingLeft: `${12 + (line.indent ?? 0) * 16}px` }}>
                  {line.label}
                </div>
                <div className={cn("px-3 py-2 text-right", line.muted && "text-mute")}>{formatMoney(line.value)}</div>
              </div>
            ))}
        </div>
        <p className="mt-6 text-[11px] text-mute">
          Peça gerencial. O MEI não entrega DRE à Receita; use junto do livro-caixa e do relatório mensal de receitas
          brutas.
        </p>
      </article>
    </div>
  );
}
