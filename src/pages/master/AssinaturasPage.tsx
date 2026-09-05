import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { plans } from "@/lib/plans";
import { platform } from "@/lib/platform";
import type { AccountRecord, Subscription, SubscriptionStatus } from "@/lib/platform-types";
import type { BillingCycle, PlanKey } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";

const statusLabels: Record<SubscriptionStatus, string> = {
  pendente: "Pendente",
  ativa: "Ativa",
  atrasada: "Atrasada",
  cancelada: "Cancelada",
};

type Filter = "todas" | "ativas" | "inativas";

type Row = {
  account: AccountRecord;
  subscription: Subscription | null;
  active: boolean;
};

export function MasterAssinaturasPage() {
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [filter, setFilter] = useState<Filter>("todas");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState<{
    plan: PlanKey;
    cycle: BillingCycle;
    status: SubscriptionStatus;
    amount: string;
    nextDue: string;
  } | null>(null);

  async function load() {
    const [nextAccounts, nextSubs] = await Promise.all([platform.accounts(), platform.subscriptions()]);
    setAccounts(nextAccounts.filter((a) => a.role !== "master"));
    setSubs(nextSubs);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Não foi possível carregar as assinaturas."));
  }, []);

  const rows = useMemo<Row[]>(() => {
    const list: Row[] = accounts.map((account) => {
      const subscription = subs.find((s) => s.userId === account.id) ?? null;
      const active =
        account.status === "ativo" && (!subscription || subscription.status === "ativa" || subscription.status === "atrasada");
      return { account, subscription, active };
    });
    // Assinaturas órfãs (conta sumiu) ainda aparecem
    for (const subscription of subs) {
      if (accounts.some((a) => a.id === subscription.userId)) continue;
      list.push({
        account: {
          id: subscription.userId,
          username: subscription.email,
          email: subscription.email,
          nome: subscription.nome,
          role: subscription.plan,
          plan: subscription.plan,
          status: subscription.status === "cancelada" ? "bloqueado" : "ativo",
          mustChangePassword: false,
          createdAt: subscription.startedAt,
        },
        subscription,
        active: subscription.status === "ativa" || subscription.status === "atrasada",
      });
    }
    list.sort((a, b) => (b.subscription?.startedAt || b.account.createdAt || "").localeCompare(a.subscription?.startedAt || a.account.createdAt || ""));
    if (filter === "ativas") return list.filter((r) => r.active);
    if (filter === "inativas") return list.filter((r) => !r.active);
    return list;
  }, [accounts, subs, filter]);

  const counts = useMemo(() => {
    const full = accounts.map((account) => {
      const subscription = subs.find((s) => s.userId === account.id) ?? null;
      return (
        account.status === "ativo" &&
        (!subscription || subscription.status === "ativa" || subscription.status === "atrasada")
      );
    });
    return {
      todas: accounts.length,
      ativas: full.filter(Boolean).length,
      inativas: full.filter((v) => !v).length,
    };
  }, [accounts, subs]);

  function openEdit(row: Row) {
    if (!row.subscription) {
      setError("Esta conta ainda não tem assinatura registrada.");
      return;
    }
    setError("");
    setEditingId(row.subscription.id);
    setDraft({
      plan: row.subscription.plan,
      cycle: row.subscription.cycle,
      status: row.subscription.status,
      amount: String(row.subscription.amount),
      nextDue: row.subscription.nextDue,
    });
  }

  async function saveEdit() {
    if (!editingId || !draft) return;
    setBusy(editingId);
    setError("");
    setNotice("");
    try {
      await platform.updateSubscription(editingId, {
        plan: draft.plan,
        cycle: draft.cycle,
        status: draft.status,
        amount: Number(draft.amount.replace(",", ".")) || 0,
        nextDue: draft.nextDue,
      });
      setNotice("Assinatura atualizada.");
      setEditingId("");
      setDraft(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível alterar a assinatura.");
    } finally {
      setBusy("");
    }
  }

  async function setStatus(id: string, status: SubscriptionStatus) {
    setBusy(id + status);
    setError("");
    setNotice("");
    try {
      await platform.setSubscription(id, status);
      setNotice(status === "ativa" ? "Plano ativado." : status === "cancelada" ? "Plano desativado." : "Status atualizado.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar.");
    } finally {
      setBusy("");
    }
  }

  async function removeAccount(userId: string, nome: string) {
    if (!window.confirm(`Excluir a conta de ${nome}? Isso remove login, assinatura e dados do workspace.`)) return;
    setBusy("del-" + userId);
    setError("");
    setNotice("");
    try {
      await platform.deleteAccount(userId);
      setNotice("Conta excluída.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir a conta.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl text-ink">Assinaturas</h1>
        <p className="mt-1 text-sm text-mute">Planos ativos e inativos: altere status, plano ou exclua a conta.</p>
      </div>
      {error ? <p className="text-sm text-red">{error}</p> : null}
      {notice ? <p className="rounded-2xl bg-bg p-3 text-sm">{notice}</p> : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["todas", `Todas (${counts.todas})`],
            ["ativas", `Ativas (${counts.ativas})`],
            ["inativas", `Inativas (${counts.inativas})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={cn("btn-ghost text-xs", filter === key && "bg-navy text-white")}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-3xl border border-line bg-paper">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-mute">
            <tr>
              <th className="px-4 py-3">Assinante</th>
              <th className="px-4 py-3">Plano</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Vencimento</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-mute" colSpan={6}>
                  Nenhuma assinatura nesta lista.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const sub = row.subscription;
                const isEditing = sub && editingId === sub.id && draft;
                return (
                  <tr key={row.account.id + (sub?.id || "")} className="border-t border-line align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{row.account.nome || row.account.username}</p>
                      <p className="text-xs text-mute">{row.account.email}</p>
                      <p className="mt-1 text-[11px] text-mute">
                        Conta: {row.account.status === "ativo" ? "ativa" : row.account.status}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select
                          className="input text-sm"
                          value={draft.plan}
                          onChange={(e) => setDraft({ ...draft, plan: e.target.value as PlanKey })}
                        >
                          <option value="pro">PODMEI Pro</option>
                          <option value="contador">PODMEI Contador</option>
                        </select>
                      ) : (
                        plans[row.account.plan === "master" ? "pro" : row.account.plan]?.name ||
                        (sub ? plans[sub.plan]?.name : "—")
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            className="input text-sm"
                            value={draft.amount}
                            onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                          />
                          <select
                            className="input text-sm"
                            value={draft.cycle}
                            onChange={(e) => setDraft({ ...draft, cycle: e.target.value as BillingCycle })}
                          >
                            <option value="month">Mensal</option>
                            <option value="year">Anual</option>
                          </select>
                        </div>
                      ) : sub ? (
                        `${formatMoney(sub.amount)} / ${sub.cycle === "year" ? "ano" : "mês"}`
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          className="input text-sm"
                          type="date"
                          value={draft.nextDue}
                          onChange={(e) => setDraft({ ...draft, nextDue: e.target.value })}
                        />
                      ) : (
                        sub?.nextDue || "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select
                          className="input text-sm"
                          value={draft.status}
                          onChange={(e) => setDraft({ ...draft, status: e.target.value as SubscriptionStatus })}
                        >
                          <option value="ativa">Ativa</option>
                          <option value="atrasada">Atrasada</option>
                          <option value="pendente">Pendente</option>
                          <option value="cancelada">Cancelada / inativa</option>
                        </select>
                      ) : (
                        <span className={cn("rounded-full px-2 py-1 text-xs font-semibold", row.active ? "bg-green/15 text-green-800" : "bg-line text-mute")}>
                          {sub ? statusLabels[sub.status] : row.active ? "Ativa" : "Inativa"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {isEditing ? (
                          <>
                            <button className="btn-primary text-xs" disabled={!!busy} onClick={() => void saveEdit()}>
                              {busy === editingId ? "Salvando…" : "Salvar"}
                            </button>
                            <button
                              className="btn-ghost text-xs"
                              disabled={!!busy}
                              onClick={() => {
                                setEditingId("");
                                setDraft(null);
                              }}
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            {sub ? (
                              <button className="btn-ghost text-xs" disabled={!!busy} onClick={() => openEdit(row)}>
                                Alterar
                              </button>
                            ) : null}
                            {sub && sub.status !== "ativa" ? (
                              <button className="btn-ghost text-xs" disabled={!!busy} onClick={() => void setStatus(sub.id, "ativa")}>
                                Ativar
                              </button>
                            ) : null}
                            {sub && sub.status !== "cancelada" ? (
                              <button className="btn-ghost text-xs" disabled={!!busy} onClick={() => void setStatus(sub.id, "cancelada")}>
                                Desativar
                              </button>
                            ) : null}
                            <Link className="btn-ghost text-xs" to={`/master/clientes/${row.account.id}`}>
                              Ver cliente
                            </Link>
                            <button
                              className="btn-ghost text-xs text-red"
                              disabled={!!busy}
                              onClick={() => void removeAccount(row.account.id, row.account.nome || row.account.email)}
                            >
                              {busy === "del-" + row.account.id ? "Excluindo…" : "Excluir conta"}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
