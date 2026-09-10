import { Link } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";

/** Shown when iOS tries to open checkout / payment routes (Guideline 3.1.1). */
export function IosPurchaseBlocked() {
  return (
    <div className="min-h-screen bg-bg px-4 py-10">
      <div className="mx-auto max-w-lg rounded-3xl border border-line bg-paper p-8">
        <Logo full />
        <h1 className="mt-6 font-display text-3xl text-ink">Assinatura no site</h1>
        <p className="mt-3 text-sm text-mute">
          Neste app iOS não há compra nem upgrade de plano. Se você já é assinante, entre com seu usuário e senha. Novas
          assinaturas são feitas apenas em{" "}
          <span className="font-semibold text-ink">podmei.com</span> pelo navegador.
        </p>
        <Link to="/entrar" className="btn-primary mt-8 inline-flex w-full justify-center">
          Entrar
        </Link>
        <Link to="/" className="mt-3 block text-center text-sm font-semibold text-ink">
          Início
        </Link>
      </div>
    </div>
  );
}
