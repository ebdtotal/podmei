import { useEffect, useState } from "react";
import { platform } from "@/lib/platform";
import type { EmailLog, PaymentRecord } from "@/lib/platform-types";
import { formatMoney } from "@/lib/utils";

export function MasterFinanceiroPage() {
  const [mrr, setMrr] = useState(0);
  const [received, setReceived] = useState(0);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");

  async function load() {
    const data = await platform.finance();
    setMrr(data.mrr);
    setReceived(data.receivedThisMonth);
    setPayments(data.payments);
    setEmails(data.emails);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Não foi possível carregar o financeiro."));
  }, []);

  async function removePayment(id: string) {
    if (!window.confirm("Excluir este pagamento do relatório? A assinatura/conta do cliente não é removida.")) {
      return;
    }
    setBusyId(id);
    setError("");
    setNotice("");
    try {
      await platform.deletePayment(id);
      setPayments((prev) => prev.filter((p) => p.id !== id));
      setNotice("Pagamento excluído do relatório.");
      const data = await platform.finance();
      setMrr(data.mrr);
      setReceived(data.receivedThisMonth);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir o pagamento.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl text-ink">Financeiro</h1>
        <p className="mt-1 text-sm text-mute">Receita recorrente das assinaturas ativas e histórico de pagamentos.</p>
      </div>
      {error ? <p className="text-sm text-red">{error}</p> : null}
      {notice ? <p className="text-sm text-green-700">{notice}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-3xl border border-line bg-paper p-5">
          <p className="text-xs uppercase tracking-wide text-mute">MRR estimado</p>
          <p className="mt-2 font-display text-3xl">{formatMoney(mrr)}</p>
        </article>
        <article className="rounded-3xl border border-line bg-paper p-5">
          <p className="text-xs uppercase tracking-wide text-mute">Recebido neste mês</p>
          <p className="mt-2 font-display text-3xl">{formatMoney(received)}</p>
        </article>
      </div>
      <section className="overflow-x-auto rounded-3xl border border-line bg-paper">
        <h2 className="border-b border-line px-4 py-3 font-semibold">Pagamentos</h2>
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-mute">
            <tr>
              <th className="px-4 py-2">Quando</th>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Valor</th>
              <th className="px-4 py-2">Meio</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-mute" colSpan={6}>
                  Nenhum pagamento registrado.
                </td>
              </tr>
            ) : (
              payments.map((pay) => (
                <tr key={pay.id} className="border-t border-line">
                  <td className="px-4 py-3 text-mute">{new Date(pay.createdAt).toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3">
                    {pay.nome}
                    <span className="block text-xs text-mute">{pay.email}</span>
                  </td>
                  <td className="px-4 py-3">{formatMoney(pay.amount)}</td>
                  <td className="px-4 py-3">{pay.method === "mercadopago" ? "Mercado Pago" : pay.method}</td>
                  <td className="px-4 py-3">{pay.status}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="btn-ghost text-xs text-red"
                      disabled={busyId === pay.id}
                      onClick={() => void removePayment(pay.id)}
                    >
                      {busyId === pay.id ? "Excluindo…" : "Excluir"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
      <section className="overflow-x-auto rounded-3xl border border-line bg-paper">
        <h2 className="border-b border-line px-4 py-3 font-semibold">E-mails de senha provisória</h2>
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-mute">
            <tr>
              <th className="px-4 py-2">Quando</th>
              <th className="px-4 py-2">Para</th>
              <th className="px-4 py-2">Assunto</th>
              <th className="px-4 py-2">Envio</th>
            </tr>
          </thead>
          <tbody>
            {emails.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-mute" colSpan={4}>
                  Nenhum e-mail registrado.
                </td>
              </tr>
            ) : (
              emails.map((mail) => (
                <tr key={mail.id} className="border-t border-line">
                  <td className="px-4 py-3 text-mute">{new Date(mail.at).toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3">{mail.to}</td>
                  <td className="px-4 py-3">{mail.subject}</td>
                  <td className="px-4 py-3">{mail.ok ? "Enviado" : "Falhou"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
