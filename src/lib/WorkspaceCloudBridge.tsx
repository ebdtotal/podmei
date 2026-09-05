import { useEffect, useRef } from "react";
import { emptyWorkspaceFromUser, useAuth } from "./auth";
import { platform } from "./platform";
import {
  bindStoreUser,
  emptyWorkspace,
  isDemoWorkspace,
  loadWorkspaceFor,
  useStore,
} from "./store";
import type { Workspace } from "./types";

function emitSyncStatus(status: "syncing" | "ok" | "error" | "idle", detail?: string) {
  window.dispatchEvent(
    new CustomEvent("podmei-sync-status", {
      detail: { status, detail, at: new Date().toISOString() },
    }),
  );
}

function normalizeWorkspace(raw: unknown, fallback: Workspace): Workspace | null {
  if (!raw || typeof raw !== "object") return null;
  const w = raw as Workspace;
  if (!Array.isArray(w.clients) || !w.clients.length) return null;
  if (isDemoWorkspace(w)) return null;
  return {
    accountant: w.accountant ?? fallback.accountant,
    clients: w.clients,
    activeClientId: w.activeClientId || w.clients[0]?.id || fallback.activeClientId,
    updatedAt: w.updatedAt,
  };
}

function ts(ws: Workspace | null | undefined): number {
  if (!ws?.updatedAt) return 0;
  const n = Date.parse(ws.updatedAt);
  return Number.isFinite(n) ? n : 0;
}

function hasRealData(ws: Workspace): boolean {
  if (isDemoWorkspace(ws)) return false;
  return (ws.clients ?? []).some(
    (c) =>
      (c.entries?.length ?? 0) > 0 ||
      (c.contacts?.length ?? 0) > 0 ||
      (c.products?.length ?? 0) > 0 ||
      Boolean(c.company?.cnpj) ||
      Boolean(c.company?.nome && c.company.nome !== "Novo MEI"),
  );
}

/**
 * Carrega a área do cliente do SQLite online em todo login/sessão
 * e mantém o cache local alinhado por usuário.
 */
export function WorkspaceCloudBridge() {
  const { user } = useAuth();
  const { importBackup, replaceWorkspace } = useStore();
  const methods = useRef({ importBackup, replaceWorkspace });
  methods.current = { importBackup, replaceWorkspace };
  const lastHydrated = useRef<string | null>(null);
  const pending = useRef<Workspace | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const syncing = useRef(false);

  useEffect(() => {
    if (!user || user.role === "master") {
      bindStoreUser(null);
      lastHydrated.current = null;
      return;
    }

    const userId = user.id;
    bindStoreUser(userId);
    let cancelled = false;

    const hydrate = async () => {
      if (lastHydrated.current === userId) return;
      emitSyncStatus("syncing", "Carregando dados da nuvem…");

      let local = loadWorkspaceFor(userId);
      if (isDemoWorkspace(local)) {
        local = emptyWorkspace(user.plan === "contador" ? "contador" : "pro");
      }

      try {
        const remote = await platform.myWorkspace();
        if (cancelled) return;

        const seed = emptyWorkspaceFromUser(remote.onboarding ?? user);
        const remoteRaw = remote.snapshot?.workspace as Workspace | undefined;
        const remoteWasDemo = Boolean(remoteRaw && isDemoWorkspace(remoteRaw));
        const remoteWs = remoteRaw ? normalizeWorkspace(remoteRaw, seed) : null;

        let chosen: Workspace = seed;
        let push = true;

        if (remoteWasDemo) {
          chosen = seed;
          push = true;
        } else if (remoteWs && ts(remoteWs) > ts(local)) {
          chosen = remoteWs;
          push = false;
        } else if (hasRealData(local) && ts(local) >= ts(remoteWs)) {
          chosen = local;
          push = true;
        } else if (remoteWs && hasRealData(remoteWs)) {
          chosen = remoteWs;
          push = false;
        } else if (hasRealData(local)) {
          chosen = local;
          push = true;
        } else {
          chosen = seed;
          push = true;
        }

        if (cancelled) return;
        methods.current.replaceWorkspace(chosen);
        if (push) await platform.syncWorkspace(chosen);
        lastHydrated.current = userId;
        emitSyncStatus(
          "ok",
          remoteWasDemo
            ? "Dados de demonstração removidos. Área limpa pronta."
            : push
              ? "Dados salvos na nuvem."
              : "Dados sincronizados com a nuvem.",
        );
      } catch {
        if (cancelled) return;
        methods.current.replaceWorkspace(local);
        lastHydrated.current = userId;
        emitSyncStatus("error", "Sem conexão com a nuvem. Usando cópia deste navegador.");
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || user.role === "master") return;

    const flush = async () => {
      const ws = pending.current;
      if (!ws || syncing.current) return;
      if (isDemoWorkspace(ws)) {
        pending.current = null;
        return;
      }
      pending.current = null;
      syncing.current = true;
      emitSyncStatus("syncing", "Salvando na nuvem…");
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await platform.syncWorkspace(ws);
          emitSyncStatus("ok", "Alterações salvas na nuvem.");
          syncing.current = false;
          if (pending.current) void flush();
          return;
        } catch (err) {
          lastError = err;
          await new Promise((r) => window.setTimeout(r, 400 * (attempt + 1)));
        }
      }
      syncing.current = false;
      emitSyncStatus(
        "error",
        lastError instanceof Error ? lastError.message : "Falha ao salvar na nuvem.",
      );
    };

    const onChange = (event: Event) => {
      pending.current = (event as CustomEvent<Workspace>).detail;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        void flush();
      }, 350);
    };

    const onHide = () => {
      window.clearTimeout(timer.current);
      void flush();
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") onHide();
    };

    window.addEventListener("podmei-workspace", onChange);
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("podmei-workspace", onChange);
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearTimeout(timer.current);
      void flush();
    };
  }, [user]);

  return null;
}
