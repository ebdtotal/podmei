import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";
import { iapBillingSupported, iapProductId, purchaseIapSubscription, usesNativeIap } from "@/lib/iap";
import { allowsExternalPurchaseUi } from "@/lib/native";
import { redirectToMercadoPago } from "@/lib/payment";
import { PLAN_KEYS, plans, planPrice } from "@/lib/plans";
import { platform } from "@/lib/platform";
import type { BillingCycle, PlanKey } from "@/lib/types";
import { formatMoney } from "@/lib/utils";

export function CheckoutPage() {
  if (usesNativeIap()) return <IosIapCheckout />;
  if (!allowsExternalPurchaseUi()) {
    return (
      <div className="min-h-screen bg-bg px-4 py-10">
        <div className="mx-auto max-w-lg rounded-3xl border border-line bg-paper p-8">
          <Logo full />
          <h1 className="mt-6 font-display text-3xl text-ink">Entre com sua conta</h1>
          <p className="mt-3 text-sm text-mute">Este app é para quem já tem acesso ao PODMEI.</p>
          <Link to="/entrar" className="btn-primary mt-8 inline-flex w-full justify-center">
            Entrar
          </Link>
        </div>
      </div>
    );
  }
  return <CheckoutPageInner />;
}

function IosIapCheckout() {
  const navigate = useNavigate();
  const params = useParams();
  const plan = (PLAN_KEYS.includes(params.plan as PlanKey) ? params.plan : "pro") as PlanKey;
  const pack = plans[plan];
  const [cycle, setCycle] = useState<BillingCycle>("month");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ username?: string; email?: string; tempPassword?: string | null } | null>(null);
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
      const ok = await iapBillingSupported();
      if (!ok) throw new Error("Compras na App Store não estão disponíveis neste dispositivo.");
      const purchase = await purchaseIapSubscription(plan, cycle);
      if (!purchase.transactionId) throw new Error("A App Store não confirmou a transação.");
      const result = await platform.checkoutApple({
        ...form,
        plan,
        cycle,
        productId: purchase.productIdentifier || iapProductId(plan, cycle),
        transactionId: purchase.transactionId,
        receipt: purchase.receipt,
      });
      setDone({
        username: result.username,
        email: result.email,
        tempPassword: result.tempPassword,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não foi possível concluir a compra.";
      if (/cancel|cancelled|canceled/i.test(msg)) {
        setError("Compra cancelada.");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-bg px-4 py-10">
        <div className="mx-auto max-w-lg rounded-3xl border border-line bg-paper p-8">
          <Logo full />
          <h1 className="mt-6 font-display text-3xl text-ink">Assinatura ativada</h1>
          <p className="mt-3 text-sm text-mute">
            Pagamento pela App Store confirmado. Use o acesso abaixo (também enviamos por e-mail quando possível).
          </p>
          <ul className="mt-4 space-y-1 text-sm">
            <li>
              Usuário: <strong>{done.username || done.email}</strong>
            </li>
            {done.tempPassword ? (
              <li>
                Senha temporária: <strong>{done.tempPassword}</strong>
              </li>
            ) : (
              <li className="text-mute">Se já tinha conta, continue com a senha atual.</li>
            )}
          </ul>
          <button type="button" className="btn-primary mt-8 w-full" onClick={() => navigate("/entrar")}>
            Entrar no PODMEI
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <Logo full />
        <h1 className="mt-8 font-display text-4xl text-ink">Assinar {pack.name}</h1>
        <p className="mt-2 text-mute">
          Assinatura pela App Store (In-App Purchase). Após a confirmação, liberamos o acesso na sua conta.
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
              {busy ? "Abrindo App Store…" : `Assinar ${formatMoney(planPrice(plan, cycle))} na App Store`}
            </button>
          </form>
          <aside className="rounded-3xl border border-line bg-paper p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-mute">Resumo</p>
            <h2 className="mt-2 font-display text-2xl">{pack.name}</h2>
            <p className="mt-4 font-display text-3xl">{formatMoney(planPrice(plan, cycle))}</p>
            <p className="mt-2 text-xs text-mute">Produto: {iapProductId(plan, cycle)}</p>
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

function CheckoutPageInner() {
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
