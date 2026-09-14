import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { isContadorPlan, normalizePlan } from "./plans";
import { platform } from "./platform";
import type { SessionUser } from "./platform-types";
import { createMeiClient } from "./store";
import type { Workspace } from "./types";

interface AuthValue {
  user: SessionUser | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<SessionUser>;
  logout: () => void;
  refresh: (user: SessionUser) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function emptyWorkspaceFromUser(user: SessionUser): Workspace {
  const plan = user.role === "master" ? "contador" : normalizePlan(user.plan);
  const contador = isContadorPlan(plan) || user.role === "master";
  const sn = plan === "contador_premium";
  const client = createMeiClient({
    plan,
    company: {
      nome: user.empresa || (sn ? "Escritório Contábil" : "Novo MEI"),
      email: user.email,
      telefone: user.telefone || "",
      cnpj: user.cnpj || "",
      ...(sn ? { regimeTributario: "simples_nacional" as const, limiteFaturamento: 0 } : {}),
    },
  });
  return {
    accountant: {
      nome: contador ? user.nome : "",
      crc: "",
      email: user.email,
      telefone: user.telefone || "",
      escritorio: user.empresa || (user.role === "master" ? "Master PODMEI" : "Escritório"),
    },
    clients: [client],
    activeClientId: client.id,
    updatedAt: new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => platform.session()?.user ?? null);
  const [ready] = useState(true);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      ready,
      login: async (username, password) => {
        const next = await platform.login(username, password);
        setUser(next);
        return next;
      },
      logout: () => {
        platform.logout();
        setUser(null);
      },
      refresh: (next) => setUser(next),
    }),
    [user, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth fora do provider");
  return ctx;
}
