import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { hasPremiumAccess, isPremiumPath } from "@/lib/plans";

/** Bloqueia rotas Premium para assinantes Pro. Contador/Master passam. */
export function RequirePremium({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4">
        <p className="text-sm text-mute">Carregando…</p>
      </div>
    );
  }
  if (!user) {
    return <Navigate to={`/entrar?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  if (!isPremiumPath(location.pathname) || hasPremiumAccess(user)) {
    return children;
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-3xl border border-line bg-paper p-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mute">PODMEI Premium</p>
      <h1 className="font-display text-3xl text-ink">Recurso do plano Premium</h1>
      <p className="text-sm text-mute">
        Fluxo de caixa, investimentos, calendário, metas, folha, DRE, livro-razão e alertas avançados estão no Premium
        (R$&nbsp;49,90/mês ou R$&nbsp;499/ano).
      </p>
      <div className="flex flex-wrap justify-center gap-2 pt-2">
        <Link to="/assinar/premium" className="btn-primary">
          Assinar Premium
        </Link>
        <Link to="/app" className="btn-ghost">
          Voltar ao painel
        </Link>
      </div>
    </div>
  );
}
