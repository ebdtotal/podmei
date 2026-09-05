import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
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
  const isContador = user.plan === "contador" || user.role === "master";
  const client = createMeiClient({
    plan: isContador ? "contador" : "pro",
    company: {
      nome: user.empresa || "Novo MEI",
      email: user.email,
      telefone: user.telefone || "",
      cnpj: user.cnpj || "",
    },
  });
  return {
    accountant: {
      nome: isContador ? user.nome : "",
      crc: "",
      email: user.email,
      telefone: user.telefone || "",
      escritorio: user.empresa || (user.role === "master" ? "Master PODMEI" : "Escritório"),
    },
    clients: [client],
    activeClientId: client.id,
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
