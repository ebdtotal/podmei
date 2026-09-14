import { useEffect, useRef } from "react";
import { emptyWorkspaceFromUser, useAuth } from "./auth";
import { platform } from "./platform";
import {
  adoptSharedWorkspaceForUser,
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
    if (!user) {
      bindStoreUser(null);
      lastHydrated.current = null;
      return;
    }

    const userId = user.id;
    bindStoreUser(userId);
    if (user.role === "master") adoptSharedWorkspaceForUser(userId);
    let cancelled = false;

    const hydrate = async (force = false) => {
      if (!force && lastHydrated.current === userId) return;
      emitSyncStatus("syncing", "Carregando dados da nuvem…");

      let local = loadWorkspaceFor(userId);
      if (isDemoWorkspace(local)) {
        local = emptyWorkspace(
          user.plan === "contador_premium"
            ? "contador_premium"
            : user.plan === "contador" || user.role === "master"
              ? "contador"
              : user.plan === "premium"
                ? "premium"
                : "pro",
        );
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
        } else if (hasRealData(local) && ts(local) > ts(remoteWs)) {
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
        // Hidratação silenciosa: não re-estampa nem dispara sync via evento.
        methods.current.replaceWorkspace(chosen, { stamp: false, emitSync: false });
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
        methods.current.replaceWorkspace(local, { stamp: false, emitSync: false });
        lastHydrated.current = userId;
        emitSyncStatus("error", "Sem conexão com a nuvem. Usando cópia deste navegador.");
      }
    };

    void hydrate(false);

    /** Ao voltar ao app/aba, puxa a nuvem se houver versão mais nova (app ↔ site). */
    const pullIfNewer = async () => {
      if (cancelled || syncing.current || pending.current) return;
      try {
        const remote = await platform.myWorkspace();
        if (cancelled) return;
        const remoteRaw = remote.snapshot?.workspace as Workspace | undefined;
        if (!remoteRaw || isDemoWorkspace(remoteRaw)) return;
        const local = loadWorkspaceFor(userId);
        if (ts(remoteRaw) > ts(local)) {
          methods.current.replaceWorkspace(remoteRaw, { stamp: false, emitSync: false });
          emitSyncStatus("ok", "Dados atualizados da nuvem.");
        }
      } catch {
        /* offline — ignora */
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void pullIfNewer();
    };
    const onFocus = () => {
      void pullIfNewer();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const flush = async () => {
      const ws = pending.current;
      if (!ws || syncing.current) return;
      if (isDemoWorkspace(ws)) {
        pending.current = null;
        return;
      }
      // Mantém a referência até sucesso — se falhar, re-enfileira.
      const snapshot = ws;
      pending.current = null;
      syncing.current = true;
      emitSyncStatus("syncing", "Salvando na nuvem…");
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const result = await platform.syncWorkspace(snapshot);
          if (result && result.accepted === false) {
            // Servidor tinha versão mais nova — puxa a nuvem para não achar que salvou.
            try {
              const remote = await platform.myWorkspace();
              const remoteWs = remote.snapshot?.workspace as Workspace | undefined;
              if (remoteWs && !isDemoWorkspace(remoteWs)) {
                methods.current.replaceWorkspace(remoteWs, { stamp: false, emitSync: false });
              }
            } catch {
              /* ignore */
            }
            emitSyncStatus(
              "error",
              "Há uma versão mais nova na nuvem. Atualizamos a tela — refaça a alteração se ainda precisar.",
            );
            syncing.current = false;
            if (pending.current) void flush();
            return;
          }
          emitSyncStatus("ok", "Alterações salvas na nuvem.");
          syncing.current = false;
          if (pending.current) void flush();
          return;
        } catch (err) {
          lastError = err;
          await new Promise((r) => window.setTimeout(r, 400 * (attempt + 1)));
        }
      }
      // Re-enfileira o que falhou, sem sobrescrever edição mais nova já pendente.
      if (!pending.current || ts(snapshot) >= ts(pending.current)) {
        pending.current = snapshot;
      }
      syncing.current = false;
      emitSyncStatus(
        "error",
        lastError instanceof Error
          ? `${lastError.message} Tentaremos de novo ao voltar online.`
          : "Falha ao salvar na nuvem. Tentaremos de novo ao voltar online.",
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
      if (document.visibilityState === "visible" && pending.current) void flush();
    };

    const onOnline = () => {
      if (pending.current) void flush();
    };

    window.addEventListener("podmei-workspace", onChange);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("podmei-workspace", onChange);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearTimeout(timer.current);
      void flush();
    };
  }, [user]);

  return null;
}
