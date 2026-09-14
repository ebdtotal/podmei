import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { isContadorPlan } from "@/lib/plans";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4">
        <p className="rounded-2xl border border-line bg-paper px-6 py-4 text-sm font-medium text-ink">
          Carregando PODMEI…
        </p>
      </div>
    );
  }
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/entrar?next=${next}`} replace />;
  }
  if (
    user.role === "master" &&
    !location.pathname.startsWith("/master") &&
    !location.pathname.startsWith("/app") &&
    !location.pathname.startsWith("/contador")
  ) {
    return <Navigate to="/master" replace />;
  }
  if (!isContadorPlan(user.plan) && user.role !== "master" && location.pathname.startsWith("/contador")) {
    return <Navigate to="/app" replace />;
  }
  return children;
}

export function RequireMaster({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4">
        <p className="rounded-2xl border border-line bg-paper px-6 py-4 text-sm font-medium text-ink">
          Carregando PODMEI…
        </p>
      </div>
    );
  }
  if (!user) {
    return <Navigate to={`/entrar?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  if (user.role !== "master") {
    return <Navigate to={isContadorPlan(user.plan) ? "/contador" : "/app"} replace />;
  }
  return children;
}
