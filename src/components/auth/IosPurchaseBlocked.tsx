import { Link } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";

/** Fallback if a non-iOS client hits a blocked purchase path. */
export function IosPurchaseBlocked() {
  return (
    <div className="min-h-screen bg-bg px-4 py-10">
      <div className="mx-auto max-w-lg rounded-3xl border border-line bg-paper p-8">
        <Logo full />
        <h1 className="mt-6 font-display text-3xl text-ink">Assinatura no app</h1>
        <p className="mt-3 text-sm text-mute">
          No iPhone e iPad, novos planos são assinados pela App Store (In-App Purchase). Se você já tem conta, entre com
          usuário e senha.
        </p>
        <Link to="/assinar/pro" className="btn-primary mt-8 inline-flex w-full justify-center">
          Ver planos
        </Link>
        <Link to="/entrar" className="mt-3 block text-center text-sm font-semibold text-ink">
          Entrar
        </Link>
      </div>
    </div>
  );
}
