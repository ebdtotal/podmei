import { Printer } from "lucide-react";
import { useMemo } from "react";
import { printOrSharePdf } from "@/lib/print";
import { useStore } from "@/lib/store";
import { cn, formatDate, formatMoney, todayIso } from "@/lib/utils";

export function ContasPage() {
  const { company, entries, updateEntry } = useStore();
  const receber = useMemo(
    () =>
      entries
        .filter((e) => e.status === "a_receber")
        .sort((a, b) => (a.vencimento || a.data).localeCompare(b.vencimento || b.data)),
    [entries],
  );
  const pagar = useMemo(
    () =>
      entries
        .filter((e) => e.status === "a_pagar")
        .sort((a, b) => (a.vencimento || a.data).localeCompare(b.vencimento || b.data)),
    [entries],
  );
  const totR = receber.reduce((a, e) => a + e.valor, 0);
  const totP = pagar.reduce((a, e) => a + e.valor, 0);

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Contas a receber e a pagar</h1>
          <p className="mt-1 text-sm text-mute">
            A data da operação fica no lançamento. Aqui entra a data em que o valor deve ser recebido ou pago.
          </p>
        </div>
        <button type="button" className="btn-primary gap-2" onClick={() => void printOrSharePdf("contas.pdf")}>
          <Printer className="size-4" />
          Imprimir
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-blue px-4 py-4 text-white">
          <p className="text-xs uppercase tracking-wide">A receber</p>
          <p className="font-display text-3xl">{formatMoney(totR)}</p>
        </div>
        <div className="rounded-2xl bg-orange px-4 py-4 text-white">
          <p className="text-xs uppercase tracking-wide">A pagar</p>
          <p className="font-display text-3xl">{formatMoney(totP)}</p>
        </div>
      </div>
      <article className="print-sheet space-y-6">
        <div className="hidden text-center print:block">
          <h2 className="text-sm font-bold">CONTAS A RECEBER E A PAGAR</h2>
          <p className="mt-1 text-xs">
            {company.nome} · CNPJ {company.cnpj}
          </p>
        </div>
        <Board
          title="A receber"
          dueLabel="Data a receber"
          rows={receber}
          onPay={(id) => updateEntry(id, { status: "liquidado" })}
          action="Receber"
        />
        <Board
          title="A pagar"
          dueLabel="Data a pagar"
          rows={pagar}
          onPay={(id) => updateEntry(id, { status: "liquidado" })}
          action="Pagar"
        />
      </article>
    </div>
  );
}

function Board({
  title,
  dueLabel,
  rows,
  onPay,
  action,
}: {
  title: string;
  dueLabel: string;
  rows: ReturnType<typeof useStore>["entries"];
  onPay: (id: string) => void;
  action: string;
}) {
  const today = todayIso();
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-paper">
      <div className="border-b border-line px-4 py-3 text-sm font-semibold">{title}</div>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-mute">
          <tr>
            <th className="px-4 py-2">Data da operação</th>
            <th>{dueLabel}</th>
            <th>Cliente / fornecedor</th>
            <th>Descrição</th>
            <th>Valor</th>
            <th className="no-print" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-6 text-mute" colSpan={6}>
                Nenhuma conta nesta lista.
              </td>
            </tr>
          ) : (
            rows.map((e) => {
              const due = e.vencimento || e.data;
              const late = due < today;
              return (
                <tr key={e.id} className="border-t border-line">
                  <td className="px-4 py-3">{formatDate(e.data)}</td>
                  <td className={cn("font-semibold", late && "text-red")}>
                    {formatDate(due)}
                    {late ? <span className="ml-2 text-[10px] font-bold uppercase">Atrasado</span> : null}
                  </td>
                  <td>{e.contraparte}</td>
                  <td>{e.descricao}</td>
                  <td>{formatMoney(e.valor)}</td>
                  <td className="no-print pr-4 text-right">
                    <button className="btn-primary" onClick={() => onPay(e.id)}>
                      {action}
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </section>
  );
}
