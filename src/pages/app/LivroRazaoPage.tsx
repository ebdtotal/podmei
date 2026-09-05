import { Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { BackToReports } from "@/components/layout/BackToReports";
import { livroRazao } from "@/lib/books";
import { useStore } from "@/lib/store";
import { MONTHS } from "@/lib/types";
import { currentYear, formatDate, formatMoney } from "@/lib/utils";

export function LivroRazaoPage() {
  const { company, entries } = useStore();
  const [year, setYear] = useState(currentYear());
  const [month, setMonth] = useState<number | "ano">("ano");
  const accounts = useMemo(
    () => livroRazao(entries, year, month === "ano" ? undefined : month),
    [entries, year, month],
  );
  const periodo = month === "ano" ? String(year) : `${MONTHS[month]}/${year}`;

  return (
    <div className="space-y-6">
      <BackToReports />
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Livro-razão</h1>
          <p className="mt-1 text-sm text-mute">
            Cada lançamento vira partida dobrada (débito e crédito) nas contas de caixa, banco, receita e despesa.
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
          <button className="btn-primary gap-2" onClick={() => window.print()}>
            <Printer className="size-4" />
            Imprimir
          </button>
        </div>
      </div>

      <article className="print-sheet space-y-6">
        <div className="text-center">
          <h2 className="text-sm font-bold">LIVRO-RAZÃO</h2>
          <p className="mt-1 text-xs">
            {company.nome} · CNPJ {company.cnpj} · {periodo}
          </p>
        </div>
        {accounts.length === 0 ? (
          <p className="rounded-2xl border border-line bg-paper p-8 text-center text-sm text-mute">
            Sem movimentos neste período.
          </p>
        ) : (
          accounts.map((acc) => (
            <section key={acc.account.code} className="overflow-hidden rounded-2xl border border-ink bg-paper">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink bg-navy px-4 py-2 text-white">
                <p className="text-sm font-semibold">
                  {acc.account.code} · {acc.account.name}
                </p>
                <p className="text-xs text-gold">
                  Natureza {acc.account.nature} · saldo {formatMoney(acc.saldo)}
                </p>
              </div>
              <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13px]">
                  <thead className="bg-bg text-left text-xs">
                    <tr>
                      <th className="px-3 py-2">Data</th>
                      <th>Vencimento</th>
                      <th>Histórico</th>
                      <th>Doc.</th>
                      <th className="text-right">Débito</th>
                      <th className="text-right">Crédito</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acc.lines.map((line, i) => (
                      <tr key={`${acc.account.code}-${i}`} className="border-t border-line">
                        <td className="px-3 py-1.5">{formatDate(line.data)}</td>
                        <td>{line.vencimento ? formatDate(line.vencimento) : "—"}</td>
                        <td>{line.historico}</td>
                        <td>{line.documento}</td>
                        <td className="text-right">{line.debito ? formatMoney(line.debito) : ""}</td>
                        <td className="text-right">{line.credito ? formatMoney(line.credito) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-ink font-bold">
                      <td className="px-3 py-2" colSpan={4}>
                        Totais
                      </td>
                      <td className="text-right">{formatMoney(acc.totalDebito)}</td>
                      <td className="text-right">{formatMoney(acc.totalCredito)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          ))
        )}
      </article>
    </div>
  );
}
