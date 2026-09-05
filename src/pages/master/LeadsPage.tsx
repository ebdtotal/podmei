import { useEffect, useState } from "react";
import { plans } from "@/lib/plans";
import { platform } from "@/lib/platform";
import type { Lead } from "@/lib/platform-types";
import { formatMoney } from "@/lib/utils";

const statusLabel: Record<Lead["status"], string> = {
  aguardando_pagamento: "Aguardando pagamento",
  aguardando_confirmacao: "Aguardando confirmação",
  ativo: "Ativo",
  cancelado: "Cancelado",
};

function when(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR");
}

export function MasterLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    try {
      setLeads(await platform.leads());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os leads.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function confirm(id: string) {
    setBusyId(id);
    setNotice("");
    try {
      const result = await platform.confirmPayment(id);
      await load();
      if (result.username && result.tempPassword) {
        setNotice(`Acesso criado: ${result.username} · senha provisória ${result.tempPassword}`);
      } else if (result.pending) {
        setNotice("Pagamento marcado como aguardando confirmação.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao confirmar.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl text-ink">Leads</h1>
        <p className="mt-1 text-sm text-mute">Quem preencheu o checkout e assinou (ou está no caminho do pagamento).</p>
      </div>
      {error ? <p className="text-sm text-red">{error}</p> : null}
      {notice ? <p className="rounded-2xl bg-bg p-3 text-sm">{notice}</p> : null}
      <div className="overflow-x-auto rounded-3xl border border-line bg-paper">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-mute">
            <tr>
              <th className="px-4 py-3">Quando</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Contato</th>
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">Plano</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-mute" colSpan={7}>
                  Nenhum lead ainda. Os dados aparecem quando alguém assina um plano.
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id} className="border-t border-line align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-mute">{when(lead.createdAt)}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{lead.nome}</p>
                    <p className="text-xs text-mute">{lead.id}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{lead.email}</p>
                    <p className="text-xs text-mute">{lead.telefone || "sem telefone"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{lead.empresa || "—"}</p>
                    <p className="text-xs text-mute">{lead.cnpj || "sem CNPJ"}</p>
                  </td>
                  <td className="px-4 py-3">
                    {plans[lead.plan]?.name} · {formatMoney(lead.amount)} / {lead.cycle === "year" ? "ano" : "mês"}
                    {lead.mpPreferenceId ? <span className="block text-xs text-mute">Mercado Pago</span> : null}
                  </td>
                  <td className="px-4 py-3">{statusLabel[lead.status]}</td>
                  <td className="px-4 py-3">
                    {lead.status !== "ativo" && lead.status !== "cancelado" ? (
                      <div className="flex flex-col items-start gap-2">
                        {lead.paymentUrl ? (
                          <a className="text-xs font-semibold text-ink" href={lead.paymentUrl} target="_blank" rel="noreferrer">
                            Abrir link
                          </a>
                        ) : null}
                        <button className="btn-ghost text-xs" disabled={busyId === lead.id} onClick={() => void confirm(lead.id)}>
                          {busyId === lead.id ? "Confirmando…" : "Confirmar pagamento"}
                        </button>
                      </div>
                    ) : (
                      <a className="text-xs font-semibold text-ink" href={lead.paymentUrl} target="_blank" rel="noreferrer">
                        Ver link
                      </a>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
