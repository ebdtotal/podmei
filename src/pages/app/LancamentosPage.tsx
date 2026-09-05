import { useEffect, useMemo, useRef, useState } from "react";
import { EntryForm, SmartCapture } from "@/components/entries/EntryForm";
import { entryDiscountAmount, entryGross } from "@/lib/entryPricing";
import { draftToEntry, entryToDraft, type ParsedDraft } from "@/lib/parser";
import { useStore } from "@/lib/store";
import type { Entry } from "@/lib/types";
import { cn, formatDate, formatMoney } from "@/lib/utils";

const statusClass: Record<Entry["status"], string> = {
  liquidado: "bg-green/15 text-green",
  a_receber: "bg-blue/15 text-blue",
  a_pagar: "bg-orange/15 text-orange",
};

const statusLabel: Record<Entry["status"], string> = {
  liquidado: "Liquidado",
  a_receber: "A receber",
  a_pagar: "A pagar",
};

export function LancamentosPage() {
  const { entries, addEntry, updateEntry, removeEntry } = useStore();
  const [draft, setDraft] = useState<{ data: ParsedDraft; source: Entry["source"] } | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [draftStamp, setDraftStamp] = useState(0);
  const [q, setQ] = useState("");
  const confirmRef = useRef<HTMLElement>(null);
  const editRef = useRef<HTMLElement>(null);
  const manualRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (editing) editRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    else if (draft) confirmRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [draft, draftStamp, editing]);

  const filtered = useMemo(() => {
    const t = q.toLowerCase();
    return entries.filter(
      (e) =>
        e.contraparte.toLowerCase().includes(t) ||
        e.descricao.toLowerCase().includes(t) ||
        e.documento.toLowerCase().includes(t),
    );
  }, [entries, q]);

  function startEdit(entry: Entry) {
    setDraft(null);
    setEditing(entry);
    setDraftStamp(Date.now());
  }

  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink sm:text-3xl">Livro diário</h1>
          <p className="mt-1 text-sm text-mute">
            Produto, quantidade e desconto. O líquido alimenta dashboard e relatórios.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary shrink-0 md:hidden"
          onClick={() => {
            setEditing(null);
            manualRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          Novo
        </button>
      </div>

      <SmartCapture
        onDraft={(data, source) => {
          setEditing(null);
          setDraftStamp(Date.now());
          setDraft({ data, source });
        }}
      />

      {editing ? (
        <section ref={editRef} className="rounded-2xl border border-navy bg-paper p-4">
          <p className="mb-3 text-sm font-semibold">Editar lançamento</p>
          <EntryForm
            key={`edit-${editing.id}-${draftStamp}`}
            initial={entryToDraft(editing)}
            onCancel={() => setEditing(null)}
            onSave={(next) => {
              const patched = draftToEntry(next, editing.source);
              updateEntry(editing.id, { ...patched, id: editing.id, source: editing.source });
              setEditing(null);
            }}
          />
        </section>
      ) : draft ? (
        <section ref={confirmRef} className="rounded-2xl border border-gold bg-paper p-4">
          <p className="mb-3 text-sm font-semibold">Confirme o lançamento ({draft.source})</p>
          {draft.data.confidence ? <p className="mb-3 text-xs text-mute">{draft.data.confidence}</p> : null}
          <EntryForm
            key={draftStamp}
            autoFocusValor
            initial={draft.data}
            onCancel={() => setDraft(null)}
            onSave={(next) => {
              addEntry(draftToEntry(next, draft.source));
              setDraft(null);
            }}
          />
        </section>
      ) : (
        <section ref={manualRef} className="rounded-2xl border border-line bg-paper p-4">
          <p className="mb-3 text-sm font-semibold">Lançamento manual</p>
          <EntryForm
            onSave={(next) => {
              addEntry(draftToEntry(next, "manual"));
            }}
          />
        </section>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold">Movimentações ({filtered.length})</h2>
        <input
          className="input w-full sm:max-w-xs"
          placeholder="Filtrar cliente, documento…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="space-y-3 md:hidden">
        {filtered.length === 0 ? (
          <p className="rounded-2xl border border-line bg-paper px-4 py-8 text-center text-sm text-mute">
            Nenhum lançamento nesta lista.
          </p>
        ) : (
          filtered.map((e) => {
            const bruto = entryGross(e);
            const desc = entryDiscountAmount(bruto, e.descontoTipo, e.descontoValor);
            return (
              <article key={e.id} className="rounded-2xl border border-line bg-paper p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{e.contraparte}</p>
                    <p className="mt-0.5 truncate text-xs text-mute">{e.descricao || "Sem descrição"}</p>
                  </div>
                  <p className="shrink-0 text-base font-bold text-ink">{formatMoney(e.valor)}</p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-mute">
                  <span>{formatDate(e.data)}</span>
                  <span className={cn("rounded-full px-2 py-0.5 font-semibold", statusClass[e.status])}>
                    {statusLabel[e.status]}
                  </span>
                  <span className="uppercase">{e.formaPagamento}</span>
                  {desc > 0 ? (
                    <span>
                      Desc.{" "}
                      {e.descontoTipo === "percent"
                        ? `${e.descontoValor ?? 0}%`
                        : formatMoney(desc)}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 flex justify-end gap-3">
                  <button type="button" className="text-xs font-semibold text-navy" onClick={() => startEdit(e)}>
                    Editar
                  </button>
                  <button type="button" className="text-xs font-semibold text-red" onClick={() => removeEntry(e.id)}>
                    Excluir
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-line bg-paper md:block">
        <table className="w-full min-w-[1180px] text-sm">
          <thead className="bg-navy text-white">
            <tr className="text-left text-xs">
              <th className="px-3 py-3">Data</th>
              <th>Vencimento</th>
              <th>Cliente / fornecedor</th>
              <th>Qtd</th>
              <th>Unitário</th>
              <th>Desconto</th>
              <th>Líquido</th>
              <th>Produto / serviço</th>
              <th>Status</th>
              <th>Pagamento</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((e, i) => {
              const bruto = entryGross(e);
              const desc = entryDiscountAmount(bruto, e.descontoTipo, e.descontoValor);
              return (
                <tr key={e.id} className={cn(i % 2 ? "bg-bg/70" : "bg-paper")}>
                  <td className="px-3 py-2">{formatDate(e.data)}</td>
                  <td>
                    {e.status === "a_receber" || e.status === "a_pagar"
                      ? formatDate(e.vencimento || e.data)
                      : "—"}
                  </td>
                  <td>{e.contraparte}</td>
                  <td>{e.quantidade ?? 1}</td>
                  <td>{formatMoney(e.precoUnitario ?? e.valor)}</td>
                  <td>
                    {desc > 0
                      ? e.descontoTipo === "percent"
                        ? `${e.descontoValor ?? 0}% (${formatMoney(desc)})`
                        : formatMoney(desc)
                      : "—"}
                  </td>
                  <td className="font-medium">{formatMoney(e.valor)}</td>
                  <td>{e.descricao}</td>
                  <td>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", statusClass[e.status])}>
                      {statusLabel[e.status]}
                    </span>
                  </td>
                  <td className="uppercase">{e.formaPagamento}</td>
                  <td className="whitespace-nowrap pr-3 text-right">
                    <button type="button" className="mr-3 text-xs font-semibold text-navy" onClick={() => startEdit(e)}>
                      Editar
                    </button>
                    <button type="button" className="text-xs text-red" onClick={() => removeEntry(e.id)}>
                      Excluir
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
