import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { PLAN_KEYS, plans } from "@/lib/plans";
import { platform } from "@/lib/platform";
import type { Subscription } from "@/lib/platform-types";
import { useStore } from "@/lib/store";
import { formatMoney } from "@/lib/utils";

const statusLabel: Record<string, string> = {
  ativa: "Ativa (recorrente)",
  atrasada: "Em atraso",
  cancelada: "Cancelada",
  pendente: "Pendente",
};

export function PlanosPage() {
  const { plan } = useStore();
  const { user, logout } = useAuth();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!user || user.role === "master") return;
    void platform.mySubscription().then(setSub).catch(() => setSub(null));
  }, [user]);

  async function onCancel() {
    if (!confirm("Cancelar a cobrança automática no Mercado Pago? O acesso será bloqueado após o cancelamento.")) {
      return;
    }
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const next = await platform.cancelMySubscription();
      setSub(next);
      setMsg("Assinatura cancelada. A cobrança recorrente foi interrompida.");
      window.setTimeout(() => {
        logout();
        window.location.href = "/entrar";
      }, 1800);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Não foi possível cancelar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink">Pacotes de acesso</h1>
        <p className="mt-1 text-sm text-mute">
          Cobrança recorrente no Mercado Pago até você cancelar. PODMEI Pro para o MEI. PODMEI Contador para o
          escritório.
        </p>
      </div>

      {user && user.role !== "master" ? (
        <section className="rounded-3xl border border-line bg-paper p-5">
          <h2 className="text-sm font-semibold">Sua assinatura</h2>
          {sub ? (
            <div className="mt-3 space-y-2 text-sm">
              <p>
                Plano: <strong>{plans[sub.plan]?.name ?? sub.plan}</strong> — {formatMoney(sub.amount)}/
                {sub.cycle === "year" ? "ano" : "mês"}
              </p>
              <p>
                Status: <strong>{statusLabel[sub.status] ?? sub.status}</strong>
                {sub.recurring || sub.mpPreapprovalId ? " · renovação automática" : ""}
              </p>
              {sub.nextDue ? <p className="text-mute">Próximo vencimento: {sub.nextDue}</p> : null}
              {sub.status !== "cancelada" ? (
                <button type="button" className="btn-ghost mt-2" disabled={busy} onClick={() => void onCancel()}>
                  {busy ? "Cancelando…" : "Cancelar assinatura"}
                </button>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-sm text-mute">Nenhuma assinatura ativa encontrada nesta conta.</p>
          )}
          {msg ? <p className="mt-2 text-sm text-green-700">{msg}</p> : null}
          {err ? <p className="mt-2 text-sm text-red">{err}</p> : null}
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {PLAN_KEYS.map((key) => {
          const p = plans[key];
          const active = plan === key;
          return (
            <article key={key} className={`rounded-3xl border bg-paper p-5 ${p.popular ? "border-green" : "border-line"}`}>
              {p.popular ? <p className="text-xs font-bold uppercase tracking-wide text-orange">Mais escolhido</p> : null}
              <h2 className="mt-1 font-display text-2xl">{p.name}</h2>
              <p className="mt-1 text-sm text-mute">{p.who}</p>
              <p className="mt-4 font-display text-3xl text-ink">
                {formatMoney(p.month)}
                <span className="text-base font-sans text-mute">/mês</span>
              </p>
              <p className="mt-1 text-xs text-mute">Renovação automática até cancelar</p>
              <ul className="mt-4 space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
              <Link to={`/assinar/${key}`} className="btn-primary mt-5 inline-flex w-full">
                {active ? "Trocar / renovar plano" : `Assinar ${p.name}`}
              </Link>
            </article>
          );
        })}
      </div>
    </div>
  );
}
