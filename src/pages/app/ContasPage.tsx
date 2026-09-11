import { Copy, MessageCircle, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { chargeMessage, chargePhone, pixKeyForCompany, pixPayloadForEntry, resolvePixTipo, whatsappHref } from "@/lib/charge";
import { printOrSharePdf } from "@/lib/print";
import { useStore } from "@/lib/store";
import type { Company, Entry } from "@/lib/types";
import { cn, formatDate, formatMoney, todayIso, uid } from "@/lib/utils";

export function ContasPage() {
  const { company, entries, contacts, updateEntry, addEntry } = useStore();
  const [charge, setCharge] = useState<Entry | null>(null);
  const [settle, setSettle] = useState<{ entry: Entry; action: "Receber" | "Pagar" } | null>(null);
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
    <div className="min-w-0 max-w-full space-y-6">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Contas a receber e a pagar</h1>
          <p className="mt-1 text-sm text-mute">
            A data da operação fica no lançamento. Ao receber ou pagar, informe a data e o valor — o saldo restante continua em aberto.
          </p>
        </div>
        <button type="button" className="btn-primary gap-2" onClick={() => void printOrSharePdf("contas.pdf")}>
          <Printer className="size-4" />
          Gerar PDF A4
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
      <article className="print-sheet min-w-0 max-w-full space-y-6">
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
          onPay={(entry) => setSettle({ entry, action: "Receber" })}
          action="Receber"
          onCharge={setCharge}
        />
        <Board
          title="A pagar"
          dueLabel="Data a pagar"
          rows={pagar}
          onPay={(entry) => setSettle({ entry, action: "Pagar" })}
          action="Pagar"
        />
        </article>
      {settle ? (
        <SettlePanel
          entry={settle.entry}
          action={settle.action}
          onClose={() => setSettle(null)}
          onConfirm={(date, amount) => {
            applySettlement(settle.entry, settle.action, date, amount, updateEntry, addEntry);
            setSettle(null);
          }}
        />
      ) : null}
      {charge ? (
        <ChargePanel
          company={company}
          entry={charge}
          phone={chargePhone(charge, contacts)}
          onClose={() => setCharge(null)}
        />
      ) : null}
    </div>
  );
}

function Board({
  title,
  dueLabel,
  rows,
  onPay,
  action,
  onCharge,
}: {
  title: string;
  dueLabel: string;
  rows: ReturnType<typeof useStore>["entries"];
  onPay: (entry: Entry) => void;
  action: string;
  onCharge?: (entry: Entry) => void;
}) {
  const today = todayIso();
  return (
    <section className="max-w-full overflow-hidden rounded-2xl border border-line bg-paper">
      <div className="border-b border-line px-4 py-3 text-sm font-semibold">{title}</div>
      <div className="max-w-full overflow-x-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch]">
      <table className="w-full min-w-[44rem] text-sm">
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
                  <td className="no-print sticky right-0 z-10 bg-paper pr-3 text-right shadow-[-10px_0_12px_-10px_rgba(0,0,0,.25)]">
                    <div className="flex flex-nowrap justify-end gap-2 whitespace-nowrap py-1">
                      {onCharge ? (
                        <button className="btn-ghost" type="button" onClick={() => onCharge(e)}>
                          Cobrar
                        </button>
                      ) : null}
                      <button className="btn-primary" onClick={() => onPay(e)}>
                        {action}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      </div>
    </section>
  );
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function applySettlement(
  entry: Entry,
  action: "Receber" | "Pagar",
  date: string,
  amount: number,
  updateEntry: (id: string, patch: Partial<Entry>) => void,
  addEntry: (entry: Entry) => void,
) {
  const paid = round2(amount);
  const saldo = round2(entry.valor);
  if (!date || paid <= 0 || paid > saldo + 0.001) return;
  const full = paid >= saldo - 0.009;
  const note = entry.observacao?.trim() ? `${entry.observacao.trim()} ` : "";
  if (full) {
    updateEntry(entry.id, {
      status: "liquidado",
      data: date,
      valor: paid,
      quantidade: 1,
      precoUnitario: paid,
      descontoValor: 0,
      observacao:
        date !== entry.data ? `${note}Operação em ${formatDate(entry.data)}.`.trim() : entry.observacao,
    });
    return;
  }
  const resto = round2(saldo - paid);
  const label = action === "Receber" ? "recebimento parcial" : "pagamento parcial";
  addEntry({
    ...entry,
    id: uid("mov"),
    data: date,
    valor: paid,
    status: "liquidado",
    quantidade: 1,
    precoUnitario: paid,
    descontoValor: 0,
    descricao: `${entry.descricao} (${label})`.trim(),
    observacao: `${note}Baixa parcial de ${formatMoney(paid)} em ${formatDate(date)}.`.trim(),
  });
  updateEntry(entry.id, {
    valor: resto,
    quantidade: 1,
    precoUnitario: resto,
    descontoValor: 0,
    observacao: `${note}Saldo após baixa parcial.`.trim(),
  });
}

function SettlePanel({
  entry,
  action,
  onClose,
  onConfirm,
}: {
  entry: Entry;
  action: "Receber" | "Pagar";
  onClose: () => void;
  onConfirm: (date: string, amount: number) => void;
}) {
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState(String(entry.valor));
  const paid = round2(Number(String(amount).replace(",", ".")) || 0);
  const saldo = round2(entry.valor);
  const resto = round2(saldo - paid);
  const valid = Boolean(date) && paid > 0 && paid <= saldo + 0.001;
  const receive = action === "Receber";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-paper p-5 shadow-xl">
        <h2 className="font-display text-2xl text-ink">{receive ? "Receber" : "Pagar"}</h2>
        <p className="mt-1 text-sm text-mute">
          {entry.contraparte || "Lançamento"} · saldo {formatMoney(saldo)}
        </p>
        <div className="mt-4 grid gap-3">
          <label className="text-xs font-medium text-mute">
            {receive ? "Data do recebimento" : "Data do pagamento"}
            <input className="input mt-1" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="text-xs font-medium text-mute">
            {receive ? "Valor recebido" : "Valor pago"}
            <input
              className="input mt-1"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
        </div>
        <p className="mt-3 text-sm text-mute">
          {valid && resto > 0.009
            ? `Saldo que continua ${receive ? "a receber" : "a pagar"}: ${formatMoney(resto)}.`
            : valid
              ? "Este valor quita o lançamento."
              : "Informe uma data e um valor até o saldo."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" disabled={!valid} onClick={() => onConfirm(date, paid)}>
            Confirmar
          </button>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function ChargePanel({
  company,
  entry,
  phone,
  onClose,
}: {
  company: Company;
  entry: Entry;
  phone: string;
  onClose: () => void;
}) {
  const tipo = resolvePixTipo(company);
  const chave = pixKeyForCompany(company);
  const pix = pixPayloadForEntry(company, entry);
  const text = chargeMessage(company, entry);
  const [copied, setCopied] = useState("");

  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1600);
  }

  return (
    <section className="no-print rounded-2xl border border-line bg-paper p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Cobrar {entry.contraparte || "cliente"}</h2>
          <p className="mt-1 text-sm text-mute">
            {formatMoney(entry.valor)} · vence {formatDate(entry.vencimento || entry.data)}
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={onClose}>
          Fechar
        </button>
      </div>
      {!chave ? (
        <p className="mt-3 text-sm text-red">
          Cadastre a chave Pix em Empresa para gerar a cobrança.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl bg-bg p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-mute">
              {tipo === "copia_e_cola" ? "Pix copia e cola" : "Chave Pix enviada no WhatsApp"}
            </p>
            <p className="mt-2 break-all font-semibold">{chave}</p>
            <button type="button" className="btn-ghost mt-3 gap-2" onClick={() => void copy("chave", chave)}>
              <Copy className="size-4" />
              {copied === "chave" ? "Copiado" : "Copiar chave"}
            </button>
          </div>
          {tipo !== "copia_e_cola" && pix ? (
            <div className="rounded-2xl bg-bg p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-mute">Pix copia e cola</p>
              <p className="mt-2 break-all text-xs">{pix}</p>
              <button type="button" className="btn-ghost mt-3 gap-2" onClick={() => void copy("pix", pix)}>
                <Copy className="size-4" />
                {copied === "pix" ? "Copiado" : "Copiar Pix"}
              </button>
            </div>
          ) : null}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <a className="btn-primary gap-2" href={whatsappHref(phone, text)} target="_blank" rel="noreferrer">
          <MessageCircle className="size-4" />
          {phone ? "Enviar no WhatsApp" : "Abrir WhatsApp"}
        </a>
        <button type="button" className="btn-ghost" onClick={() => void copy("msg", text)}>
          {copied === "msg" ? "Mensagem copiada" : "Copiar mensagem"}
        </button>
      </div>
      {!phone ? <p className="mt-2 text-xs text-mute">Sem telefone no cadastro — o WhatsApp abre para você escolher o contato.</p> : null}
    </section>
  );
}
