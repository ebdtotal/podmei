import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";
import { redirectToMercadoPago } from "@/lib/payment";
import { PLAN_KEYS, plans, planPrice } from "@/lib/plans";
import { platform } from "@/lib/platform";
import type { BillingCycle, PlanKey } from "@/lib/types";
import { formatMoney } from "@/lib/utils";

export function CheckoutPage() {
  const params = useParams();
  const plan = (PLAN_KEYS.includes(params.plan as PlanKey) ? params.plan : "pro") as PlanKey;
  const pack = plans[plan];
  const [cycle, setCycle] = useState<BillingCycle>("month");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    cnpj: "",
    empresa: "",
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const lead = await platform.checkout({ ...form, plan, cycle });
      if (!redirectToMercadoPago(lead)) {
        throw new Error("Link do Mercado Pago ausente. Tente novamente.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível gerar o pagamento.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <Logo full />
        <h1 className="mt-8 font-display text-4xl text-ink">Assinar {pack.name}</h1>
        <p className="mt-2 text-mute">
          {pack.who} Assinatura com cobrança automática no Mercado Pago até você cancelar. Após a aprovação, enviamos
          usuário e senha no e-mail.
        </p>
        <div className="mt-8 grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
          <form className="space-y-3 rounded-3xl border border-line bg-paper p-6" onSubmit={onSubmit}>
            <label className="block text-sm">
              Nome completo
              <input className="input mt-1" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </label>
            <label className="block text-sm">
              E-mail
              <input
                className="input mt-1"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              Telefone
              <input className="input mt-1" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
            </label>
            <label className="block text-sm">
              Empresa / nome fantasia
              <input className="input mt-1" value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} />
            </label>
            <label className="block text-sm">
              CNPJ
              <input className="input mt-1" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
            </label>
            <div className="flex gap-2 pt-1">
              <button type="button" className={cycle === "month" ? "btn-primary" : "btn-ghost"} onClick={() => setCycle("month")}>
                Mensal · {formatMoney(pack.month)}
              </button>
              <button type="button" className={cycle === "year" ? "btn-primary" : "btn-ghost"} onClick={() => setCycle("year")}>
                Anual · {formatMoney(pack.year)}
              </button>
            </div>
            {error ? <p className="text-sm text-red">{error}</p> : null}
            <button className="btn-primary w-full" disabled={busy}>
              {busy
                ? "Abrindo Mercado Pago…"
                : `Pagar ${formatMoney(planPrice(plan, cycle))} no Mercado Pago`}
            </button>
          </form>
          <aside className="rounded-3xl border border-line bg-paper p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-mute">Resumo</p>
            <h2 className="mt-2 font-display text-2xl">{pack.name}</h2>
            <p className="mt-4 font-display text-3xl">{formatMoney(planPrice(plan, cycle))}</p>
            <ul className="mt-4 space-y-2 text-sm text-mute">
              {pack.features.slice(0, 6).map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
            <Link to="/entrar" className="mt-6 inline-flex text-sm font-semibold text-ink">
              Já tenho acesso
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
}
