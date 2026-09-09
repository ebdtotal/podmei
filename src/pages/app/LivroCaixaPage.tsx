import { Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { BackToReports } from "@/components/layout/BackToReports";
import { livroCaixa } from "@/lib/books";
import { printOrSharePdf } from "@/lib/print";
import { useStore } from "@/lib/store";
import { MONTHS } from "@/lib/types";
import { currentYear, formatDate, formatMoney } from "@/lib/utils";

export function LivroCaixaPage() {
  const { company, entries } = useStore();
  const [year, setYear] = useState(currentYear());
  const [month, setMonth] = useState<number | "ano">("ano");
  const rows = useMemo(
    () => livroCaixa(entries, year, month === "ano" ? undefined : month),
    [entries, year, month],
  );
  const entradas = rows.reduce((s, r) => s + r.entrada, 0);
  const saidas = rows.reduce((s, r) => s + r.saida, 0);
  const saldo = rows.at(-1)?.saldo ?? 0;
  const periodo = month === "ano" ? String(year) : `${MONTHS[month]}/${year}`;

  return (
    <div className="space-y-6">
      <BackToReports />
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Livro-caixa</h1>
          <p className="mt-1 text-sm text-mute">
            Entradas e saídas liquidadas em ordem cronológica, com saldo acumulado — o livro que o MEI deve manter.
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
          <button className="btn-primary gap-2" onClick={() => void printOrSharePdf("livro-caixa.pdf")}>
            <Printer className="size-4" />
            Imprimir
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Mini label="Entradas" value={entradas} />
        <Mini label="Saídas" value={saidas} />
        <Mini label="Saldo" value={saldo} />
      </div>

      <article className="print-sheet overflow-hidden rounded-2xl border border-ink bg-paper">
        <div className="border-b border-ink px-5 py-4">
          <h2 className="text-center text-sm font-bold">LIVRO-CAIXA DO MEI</h2>
          <p className="mt-1 text-center text-xs">
            {company.nome} · CNPJ {company.cnpj} · {periodo}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead className="bg-bg text-left text-xs">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th>Histórico</th>
                <th>Documento</th>
                <th className="text-right">Entrada</th>
                <th className="text-right">Saída</th>
                <th className="text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-mute">
                    Nenhum lançamento liquidado neste período.
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <tr key={`${row.data}-${i}`} className="border-t border-line">
                    <td className="px-3 py-1.5">{formatDate(row.data)}</td>
                    <td>{row.historico}</td>
                    <td>{row.documento}</td>
                    <td className="text-right">{row.entrada ? formatMoney(row.entrada) : ""}</td>
                    <td className="text-right">{row.saida ? formatMoney(row.saida) : ""}</td>
                    <td className="text-right font-medium">{formatMoney(row.saldo)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ink font-bold">
                <td className="px-3 py-2" colSpan={3}>
                  Totais
                </td>
                <td className="text-right">{formatMoney(entradas)}</td>
                <td className="text-right">{formatMoney(saidas)}</td>
                <td className="text-right">{formatMoney(saldo)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </article>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-paper p-4">
      <p className="text-xs text-mute">{label}</p>
      <p className="mt-1 font-display text-2xl text-ink">{formatMoney(value)}</p>
    </div>
  );
}
