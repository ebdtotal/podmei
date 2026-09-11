import { Copy, Download, MessageCircle, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { MoneyBrInput } from "@/components/ui/MoneyBrInput";
import { chargeMessage, chargePhone, pixKeyForCompany, pixPayloadForEntry, resolvePixTipo, whatsappHref } from "@/lib/charge";
import { exportContasExcel } from "@/lib/exportReports";
import { futureOpenRecurrenceIds } from "@/lib/parser";
import { printOrSharePdf } from "@/lib/print";
import { useStore } from "@/lib/store";
import type { Company, Entry, PaymentMethod } from "@/lib/types";
import { cn, formatDate, formatMoney, todayIso, uid } from "@/lib/utils";

export function ContasPage() {
  const { company, entries, contacts, updateEntry, addEntry, removeEntries } = useStore();
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

  function stopRecurrence(entry: Entry) {
    if (!entry.seriesId) return;
    const ids = futureOpenRecurrenceIds(entries, entry.seriesId);
    if (!ids.length) {
      window.alert("Não há parcelas futuras em aberto nesta recorrência.");
      return;
    }
    if (
      !window.confirm(
        `Parar recorrência? Serão excluídas ${ids.length} parcela${ids.length > 1 ? "s" : ""} futura${ids.length > 1 ? "s" : ""} em aberto. O que já foi recebido/pago permanece.`,
      )
    ) {
      return;
    }
    removeEntries(ids);
  }

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Contas a receber e a pagar</h1>
          <p className="mt-1 text-sm text-mute">
            A data da operação fica no lançamento. Ao receber ou pagar, informe a data e o valor — o saldo restante continua em aberto.
            Em recorrências, use Parar para excluir só as parcelas futuras.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-ghost gap-2"
            onClick={() => exportContasExcel(receber, pagar, "contas-receber-pagar.xlsx")}
          >
            <Download className="size-4" />
            Excel
          </button>
          <button type="button" className="btn-primary gap-2" onClick={() => void printOrSharePdf("contas.pdf")}>
            <Printer className="size-4" />
            Gerar PDF A4
          </button>
        </div>
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
          allEntries={entries}
          onPay={(entry) => setSettle({ entry, action: "Receber" })}
          action="Receber"
          onCharge={setCharge}
          onStopRecurrence={stopRecurrence}
        />
        <Board
          title="A pagar"
          dueLabel="Data a pagar"
          rows={pagar}
          allEntries={entries}
          onPay={(entry) => setSettle({ entry, action: "Pagar" })}
          action="Pagar"
          onStopRecurrence={stopRecurrence}
        />
        </article>
      {settle ? (
        <SettlePanel
          entry={settle.entry}
          action={settle.action}
          onClose={() => setSettle(null)}
          onConfirm={(payload) => {
            applySettlement(settle.entry, settle.action, payload, updateEntry, addEntry);
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
  allEntries,
  onPay,
  action,
  onCharge,
  onStopRecurrence,
}: {
  title: string;
  dueLabel: string;
  rows: Entry[];
  allEntries: Entry[];
  onPay: (entry: Entry) => void;
  action: string;
  onCharge?: (entry: Entry) => void;
  onStopRecurrence?: (entry: Entry) => void;
}) {
  const today = todayIso();
  return (
    <section className="max-w-full overflow-hidden rounded-2xl border border-line bg-paper">
      <div className="border-b border-line px-4 py-3 text-sm font-semibold">{title}</div>
      <div className="max-w-full overflow-x-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch]">
      <table className="w-full min-w-[48rem] text-sm">
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
              const canStop =
                Boolean(e.seriesId) &&
                (e.seriesKind === "recorrente" || !e.seriesKind) &&
                futureOpenRecurrenceIds(allEntries, e.seriesId!).length > 0;
              return (
                <tr key={e.id} className="border-t border-line">
                  <td className="px-4 py-3">{formatDate(e.data)}</td>
                  <td className={cn("font-semibold", late && "text-red")}>
                    {formatDate(due)}
                    {late ? <span className="ml-2 text-[10px] font-bold uppercase">Atrasado</span> : null}
                    {e.seriesKind === "recorrente" || (e.seriesId && !e.seriesKind) ? (
                      <span className="ml-2 text-[10px] font-bold uppercase text-navy">Recorrente</span>
                    ) : null}
                  </td>
                  <td>{e.contraparte}</td>
                  <td>{e.descricao}</td>
                  <td>{formatMoney(e.valor)}</td>
                  <td className="no-print sticky right-0 z-10 bg-paper pr-3 text-right shadow-[-10px_0_12px_-10px_rgba(0,0,0,.25)]">
                    <div className="flex flex-nowrap justify-end gap-2 whitespace-nowrap py-1">
                      {canStop && onStopRecurrence ? (
                        <button
                          className="btn-ghost text-xs"
                          type="button"
                          title="Exclui parcelas futuras em aberto; mantém as já recebidas/pagas"
                          onClick={() => onStopRecurrence(e)}
                        >
                          Parar
                        </button>
                      ) : null}
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

type SettlePayload = {
  date: string;
  amount: number;
  formaPagamento: PaymentMethod;
  descricao: string;
};

function applySettlement(
  entry: Entry,
  action: "Receber" | "Pagar",
  payload: SettlePayload,
  updateEntry: (id: string, patch: Partial<Entry>) => void,
  addEntry: (entry: Entry) => void,
) {
  const paid = round2(payload.amount);
  const saldo = round2(entry.valor);
  if (!payload.date || paid <= 0 || paid > saldo + 0.001) return;
  const full = paid >= saldo - 0.009;
  const note = entry.observacao?.trim() ? `${entry.observacao.trim()} ` : "";
  const descricao = payload.descricao.trim() || entry.descricao;

  if (full) {
    updateEntry(entry.id, {
      status: "liquidado",
      data: payload.date,
      valor: paid,
      formaPagamento: payload.formaPagamento,
      descricao,
      quantidade: 1,
      precoUnitario: paid,
      descontoValor: 0,
      vencimento: undefined,
      observacao:
        payload.date !== entry.data
          ? `${note}Operação em ${formatDate(entry.data)}.`.trim()
          : entry.observacao,
    });
    return;
  }

  const resto = round2(saldo - paid);
  const label = action === "Receber" ? "recebimento parcial" : "pagamento parcial";
  addEntry({
    ...entry,
    id: uid("mov"),
    data: payload.date,
    valor: paid,
    status: "liquidado",
    formaPagamento: payload.formaPagamento,
    quantidade: 1,
    precoUnitario: paid,
    descontoValor: 0,
    vencimento: undefined,
    descricao,
    observacao: `${note}Baixa parcial (${label}) de ${formatMoney(paid)} em ${formatDate(payload.date)}.`.trim(),
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
  onConfirm: (payload: SettlePayload) => void;
}) {
  const receive = action === "Receber";
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState(entry.valor);
  const [formaPagamento, setFormaPagamento] = useState<PaymentMethod>(entry.formaPagamento || "pix");
  const [descricao, setDescricao] = useState(entry.descricao || "");
  const paid = round2(amount);
  const saldo = round2(entry.valor);
  const valid = Boolean(date) && paid > 0 && paid <= saldo + 0.001;

  return (
    <Modal open title={receive ? "Receber" : "Pagar"} onClose={onClose}>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          onConfirm({ date, amount: paid, formaPagamento, descricao });
        }}
      >
        <label className="block text-xs font-medium text-mute">
          {receive ? "Data de recebimento" : "Data de pagamento"}
          <input
            className="input mt-1.5"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
        <label className="block text-xs font-medium text-mute">
          Valor
          <MoneyBrInput className="input mt-1.5" value={amount} onChange={setAmount} required />
        </label>
        <label className="block text-xs font-medium text-mute sm:col-span-2">
          Pagamento
          <select
            className="input mt-1.5"
            value={formaPagamento}
            onChange={(e) => setFormaPagamento(e.target.value as PaymentMethod)}
          >
            <option value="pix">PIX</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="debito">Débito</option>
            <option value="credito">Crédito</option>
            <option value="boleto">Boleto</option>
            <option value="transferencia">Transferência</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-mute sm:col-span-2">
          Descrição do lançamento
          <input
            className="input mt-1.5"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex.: parcela 2"
          />
        </label>
        <p className="text-xs text-mute sm:col-span-2">
          O saldo do lançamento original será zerado e um novo lançamento será criado com o histórico da parcela.
        </p>
        <button type="submit" className="btn-primary w-full sm:col-span-2" disabled={!valid}>
          Confirmar baixa
        </button>
      </form>
    </Modal>
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
  const [forma, setForma] = useState<PaymentMethod>(entry.formaPagamento || "pix");
  const text = chargeMessage(company, { ...entry, formaPagamento: forma });
  const [copied, setCopied] = useState("");
  const remindDays = company.lembreteContasDias ?? 3;

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
      <label className="mt-4 block text-xs font-medium text-mute">
        Forma de cobrança na mensagem
        <select className="input mt-1.5" value={forma} onChange={(e) => setForma(e.target.value as PaymentMethod)}>
          <option value="pix">PIX</option>
          <option value="boleto">Boleto</option>
          <option value="transferencia">Transferência</option>
          <option value="credito">Cartão / crédito</option>
          <option value="dinheiro">Dinheiro</option>
        </select>
      </label>
      <p className="mt-2 text-xs text-mute">
        Lembretes automáticos: contas que vencem em até {remindDays} dia{remindDays === 1 ? "" : "s"} aparecem nos
        avisos (ajuste em Metas).
      </p>
      {!chave && forma === "pix" ? (
        <p className="mt-3 text-sm text-red">Cadastre a chave Pix em Empresa para gerar a cobrança Pix.</p>
      ) : null}
      {chave && forma === "pix" ? (
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
      ) : null}
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
