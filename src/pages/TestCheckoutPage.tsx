import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";
import { redirectToMercadoPago } from "@/lib/payment";
import { platform } from "@/lib/platform";
import { formatMoney } from "@/lib/utils";

export function TestCheckoutPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    empresa: "Teste PODMEI",
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const lead = await platform.checkout({
        ...form,
        cnpj: "",
        plan: "pro",
        cycle: "month",
        test: true,
      });
      if (!redirectToMercadoPago(lead)) {
        throw new Error("Link do Mercado Pago ausente. Tente novamente.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível gerar o teste de R$ 2,00.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg px-4 py-10">
      <div className="mx-auto max-w-lg">
        <Logo full />
        <h1 className="mt-8 font-display text-4xl text-ink">Teste de pagamento</h1>
        <p className="mt-2 text-mute">
          Cobra {formatMoney(2)} no Mercado Pago. Depois da aprovação, o login e a senha vão para o e-mail cadastrado.
        </p>
        <form className="mt-8 space-y-3 rounded-3xl border border-line bg-paper p-6" onSubmit={onSubmit}>
          <label className="block text-sm">
            Nome completo
            <input className="input mt-1" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </label>
          <label className="block text-sm">
            E-mail que vai receber o acesso
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
          {error ? <p className="text-sm text-red">{error}</p> : null}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Abrindo Mercado Pago…" : `Pagar ${formatMoney(2)} no Mercado Pago`}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-mute">
          <Link to="/" className="font-semibold text-ink">
            Voltar ao início
          </Link>
        </p>
      </div>
    </div>
  );
}
