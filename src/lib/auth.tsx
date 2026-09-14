import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BiometricLockScreen } from "@/components/auth/BiometricLockScreen";
import { biometricAvailable } from "./biometric";
import { isContadorPlan, normalizePlan } from "./plans";
import { platform } from "./platform";
import type { SessionUser } from "./platform-types";
import { isBiometricLoginEnabled } from "./session-persist";
import { createMeiClient } from "./store";
import type { Workspace } from "./types";

interface AuthValue {
  user: SessionUser | null;
  ready: boolean;
  locked: boolean;
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

async function shouldLockSession() {
  if (!Capacitor.isNativePlatform()) return false;
  if (!(await isBiometricLoginEnabled())) return false;
  const avail = await biometricAvailable();
  return avail.ok;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const userRef = useRef<SessionUser | null>(null);
  userRef.current = user;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const sessionUser = platform.session()?.user ?? null;
      if (cancelled) return;
      setUser(sessionUser);
      if (sessionUser && (await shouldLockSession())) {
        if (!cancelled) setLocked(true);
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle: { remove: () => Promise<void> } | undefined;
    let inactiveSince = 0;
    let unlockGraceUntil = 0;

    const onUnlockedFlag = () => {
      unlockGraceUntil = Date.now() + 2500;
    };
    window.addEventListener("podmei-bio-unlocked", onUnlockedFlag);

    void CapApp.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) {
        inactiveSince = Date.now();
        return;
      }
      const awayMs = inactiveSince ? Date.now() - inactiveSince : 0;
      inactiveSince = 0;
      // Face ID / digital deixa o app “inativo” por pouco tempo; só relock após pause real.
      if (awayMs < 1200) return;
      if (Date.now() < unlockGraceUntil) return;
      void (async () => {
        if (!userRef.current) return;
        if (await shouldLockSession()) setLocked(true);
      })();
    }).then((h) => {
      handle = h;
    });
    return () => {
      window.removeEventListener("podmei-bio-unlocked", onUnlockedFlag);
      void handle?.remove();
    };
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      ready,
      locked,
      login: async (username, password) => {
        const next = await platform.login(username, password);
        setUser(next);
        setLocked(false);
        return next;
      },
      logout: () => {
        platform.logout();
        setUser(null);
        setLocked(false);
      },
      refresh: (next) => setUser(next),
    }),
    [user, ready, locked],
  );

  return (
    <AuthContext.Provider value={value}>
      {ready && user && locked ? (
        <BiometricLockScreen
          onUnlocked={() => {
            window.dispatchEvent(new Event("podmei-bio-unlocked"));
            setLocked(false);
          }}
          onLogout={() => value.logout()}
        />
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth fora do provider");
  return ctx;
}
