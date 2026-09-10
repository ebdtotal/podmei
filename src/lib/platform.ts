import { Capacitor } from "@capacitor/core";
import type { Workspace } from "./types";
import type {
  AccountRecord,
  CheckoutInput,
  ConfirmPaymentResult,
  EmailLog,
  Lead,
  PaymentRecord,
  SessionUser,
  Subscription,
  WorkspaceSnapshot,
} from "./platform-types";
import { allowsExternalPurchaseUi } from "./native";
import { clearLocalSession, localPlatform, readLocalSession, SESSION_KEY } from "./platform-local";

const API = "/api/index.php";
const CHECKOUT_API = "/api/checkout.php";
const PROD_ORIGIN = "https://podmei.com";

function timeoutSignal(ms: number) {
  const controller = new AbortController();
  window.setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

function apiBase(path: string) {
  try {
    const host = window.location.hostname;
    if (host === "podmei.com" || host.endsWith(".podmei.com")) {
      return `${window.location.origin}${path}`;
    }
    // App iOS/Android (Capacitor): API sempre na produção
    if (Capacitor.isNativePlatform()) {
      return `${PROD_ORIGIN}${path}`;
    }
  } catch {
    /* ignore */
  }
  return path;
}

function parseJsonPayload<T>(text: string, status: number): T & { error?: string } {
  const clean = text.replace(/^\uFEFF/, "").trim();
  const start = clean.indexOf("{");
  const jsonText = start >= 0 ? clean.slice(start) : clean;
  try {
    return JSON.parse(jsonText) as T & { error?: string };
  } catch {
    if (status === 503) {
      throw new Error("Servidor ocupado ao gerar o pagamento. Aguarde alguns segundos e tente de novo.");
    }
    throw new Error(`Resposta inválida do servidor (HTTP ${status}). Tente novamente.`);
  }
}

async function request<T>(
  action: string,
  body?: unknown,
  token?: string | null,
  timeoutMs = 35_000,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${apiBase(API)}?action=${encodeURIComponent(action)}`, {
      method: "POST",
      headers,
      body: body ? JSON.stringify(body) : "{}",
      signal: timeoutSignal(timeoutMs),
      cache: "no-store",
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "AbortError" || name === "TimeoutError") {
      throw new Error("O Mercado Pago demorou demais para responder. Tente novamente.");
    }
    throw new Error("Falha na comunicação com o servidor. Verifique a internet e tente de novo.");
  }
  const text = await res.text();
  const data = parseJsonPayload<T>(text, res.status);
  if (!res.ok) {
    const msg = String((data as { error?: string }).error || `Erro ${res.status} no servidor.`);
    if (res.status === 401 && /usuário não encontrado|sessão inválida/i.test(msg)) {
      clearLocalSession();
      throw new Error("Sessão expirada. Entre de novo no master.");
    }
    throw new Error(msg);
  }
  return data;
}

async function requestCheckout<T>(body: unknown, timeoutMs = 45_000): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  let res: Response;
  try {
    res = await fetch(apiBase(CHECKOUT_API), {
      method: "POST",
      headers,
      body: JSON.stringify(body ?? {}),
      signal: timeoutSignal(timeoutMs),
      cache: "no-store",
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "AbortError" || name === "TimeoutError") {
      throw new Error("O Mercado Pago demorou demais para responder. Tente novamente.");
    }
    throw new Error("Falha na comunicação com o servidor. Verifique a internet e tente de novo.");
  }
  const text = await res.text();
  const data = parseJsonPayload<T>(text, res.status);
  if (!res.ok) throw new Error(data.error || `Erro ${res.status} no servidor.`);
  return data;
}

async function requestCheckoutLikeLogin(username: string, password: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  let res: Response;
  try {
    res = await fetch(apiBase("/api/login.php"), {
      method: "POST",
      headers,
      body: JSON.stringify({ username, password }),
      signal: timeoutSignal(12_000),
      cache: "no-store",
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "AbortError" || name === "TimeoutError") {
      throw new Error("Login demorou demais. Tente novamente.");
    }
    throw new Error("Falha na comunicação com o servidor. Verifique a internet e tente de novo.");
  }
  const data = parseJsonPayload<{ token: string; user: SessionUser; error?: string }>(
    await res.text(),
    res.status,
  );
  if (!res.ok) throw new Error(data.error || `Erro ${res.status} no servidor.`);
  return data;
}

async function phpAvailable() {
  try {
    const res = await fetch(`${apiBase(API)}?action=ping`, {
      method: "GET",
      cache: "no-store",
      signal: timeoutSignal(4000),
    });
    if (!res.ok) return false;
    const data = parseJsonPayload<{ ok?: boolean }>(await res.text(), res.status);
    return data.ok === true;
  } catch {
    return false;
  }
}

function forcePhpBackend() {
  try {
    const host = window.location.hostname;
    if (host === "podmei.com" || host.endsWith(".podmei.com")) return true;
    if (Capacitor.isNativePlatform()) return true;
  } catch {
    /* ignore */
  }
  return false;
}

let usePhp: boolean | null = null;
let phpCheckedAt = 0;
async function backend() {
  if (forcePhpBackend()) return true;
  const now = Date.now();
  // Re-check every 5 minutes so a server restart is picked up
  if (usePhp === null || now - phpCheckedAt > 300_000) {
    usePhp = await phpAvailable();
    phpCheckedAt = now;
  }
  return usePhp;
}

function token() {
  return readLocalSession()?.token ?? null;
}

function saveSession(session: { token: string; user: SessionUser }) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export const platform = {
  session: readLocalSession,

  logout() {
    clearLocalSession();
  },

  async login(username: string, password: string) {
    if (forcePhpBackend() || (await backend())) {
      try {
        const data = await requestCheckoutLikeLogin(username, password);
        saveSession(data);
        return data.user;
      } catch (err) {
        // fallback para index.php se login.php ainda não estiver no ar
        try {
          const data = await request<{ token: string; user: SessionUser }>("login", { username, password });
          saveSession(data);
          return data.user;
        } catch {
          throw err;
        }
      }
    }
    const data = await localPlatform.login(username, password);
    return data.user;
  },

  async checkout(input: CheckoutInput) {
    if (!allowsExternalPurchaseUi()) {
      throw new Error("Compra de plano não está disponível neste app iOS. Use podmei.com no navegador.");
    }
    if (await backend()) {
      const data = await requestCheckout<{
        lead: Lead;
        checkoutUrl?: string;
        signupId?: string;
        leadId?: string;
        email?: string;
        nome?: string;
        error?: string;
      }>(input);
      const signupId = (data.signupId || data.leadId || data.lead?.id || "").trim();
      const lead = data.lead || ({ id: signupId, email: data.email || "", nome: data.nome || "" } as Lead);
      if (!signupId) {
        throw new Error(data.error || "Resposta incompleta do checkout.");
      }
      lead.id = signupId;
      const checkoutUrl = (data.checkoutUrl || lead.mpInitPoint || "").trim();
      if (!checkoutUrl.startsWith("http") || !checkoutUrl.includes("mercadopago")) {
        throw new Error("O Mercado Pago não devolveu o link de pagamento. Tente novamente.");
      }
      lead.mpInitPoint = checkoutUrl;
      lead.paymentUrl = checkoutUrl;
      if (data.email) lead.email = data.email;
      if (data.nome) lead.nome = data.nome;
      return Object.assign(lead, { checkoutUrl, signupId }) as Lead & { checkoutUrl: string; signupId: string };
    }
    if (forcePhpBackend()) {
      throw new Error("Não foi possível falar com o servidor de pagamento. Atualize a página e tente de novo.");
    }
    return localPlatform.checkout(input);
  },

  async paymentStatus(id: string, paymentId?: string, preapprovalId?: string) {
    if (await backend()) {
      const params = new URLSearchParams({ sid: id });
      if (paymentId) params.set("payment_id", paymentId);
      if (preapprovalId) params.set("preapproval_id", preapprovalId);
      let res: Response;
      try {
        res = await fetch(`${apiBase("/api/pagamento.php")}?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
          signal: timeoutSignal(30_000),
          headers: { Accept: "application/json" },
        });
      } catch (err) {
        const name = err instanceof Error ? err.name : "";
        if (name === "AbortError" || name === "TimeoutError") {
          throw new Error("Confirmando pagamento… tente atualizar a página.");
        }
        throw new Error("Falha na comunicação com o servidor. Verifique a internet e tente de novo.");
      }
      const data = parseJsonPayload<{
        status: "pago" | "pendente";
        signupId: string;
        leadId: string;
        email: string;
        nome: string;
        lead?: Lead;
        emailSent?: boolean;
        emailError?: string;
        username?: string;
        tempPassword?: string;
        error?: string;
      }>(await res.text(), res.status);
      if (!res.ok) throw new Error(data.error || `Erro ${res.status} no servidor.`);
      return data;
    }
    const lead = await localPlatform.getLead(id);
    return {
      status: lead.status === "ativo" ? ("pago" as const) : ("pendente" as const),
      signupId: id,
      leadId: id,
      email: lead.email,
      nome: lead.nome,
      lead,
    };
  },

  async getLead(id: string) {
    if (await backend()) {
      const data = await request<{ lead: Lead }>("lead", { id });
      return data.lead;
    }
    return localPlatform.getLead(id);
  },

  async confirmPayment(id: string, paymentId?: string) {
    if (await backend()) {
      // Liberação manual no padrão EDB (ativar_signup_pago)
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      const tok = token();
      if (tok) headers.Authorization = `Bearer ${tok}`;
      const res = await fetch(apiBase("/api/assinaturas.php"), {
        method: "POST",
        headers,
        body: JSON.stringify({ acao: "confirmar_signup", id, paymentId }),
        signal: timeoutSignal(35_000),
        cache: "no-store",
      });
      const data = parseJsonPayload<ConfirmPaymentResult & { error?: string; lead?: Lead; emailSent?: boolean }>(
        await res.text(),
        res.status,
      );
      if (!res.ok) {
        const msg = data.error || `Erro ${res.status}`;
        if (res.status === 401) {
          clearLocalSession();
          throw new Error("Sessão expirada. Entre de novo no master.");
        }
        throw new Error(msg);
      }
      return {
        lead: data.lead!,
        emailSent: data.emailSent,
        username: data.username,
        tempPassword: data.tempPassword,
      } as ConfirmPaymentResult;
    }
    return localPlatform.confirmPayment(id);
  },

  async changePassword(password: string) {
    const session = readLocalSession();
    if (!session) throw new Error("Sessão inválida.");
    if (await backend()) {
      try {
        const res = await fetch(apiBase("/api/alterar-senha.php"), {
          method: "POST",
          cache: "no-store",
          signal: timeoutSignal(20_000),
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify({ password }),
        });
        const data = parseJsonPayload<{ user?: SessionUser; error?: string }>(await res.text(), res.status);
        if (res.ok && data.user) {
          saveSession({ token: session.token, user: data.user });
          return data.user;
        }
        if (data.error) throw new Error(data.error);
      } catch (err) {
        if (err instanceof Error && !/Resposta inválida|Failed to fetch|NetworkError|fetch/i.test(err.message)) {
          throw err;
        }
      }
      const data = await request<{ user: SessionUser }>("change-password", { password }, session.token);
      saveSession({ token: session.token, user: data.user });
      return data.user;
    }
    const user = await localPlatform.changePassword(password, session.user.id);
    saveSession({ token: session.token, user });
    return user;
  },

  async leads() {
    if (await backend()) {
      // Preferência: signups SQLite (fluxo EDB). Fallback: index.php
      try {
        const headers: Record<string, string> = { Accept: "application/json" };
        const tok = token();
        if (tok) headers.Authorization = `Bearer ${tok}`;
        const res = await fetch(apiBase("/api/assinaturas.php"), {
          method: "GET",
          headers,
          cache: "no-store",
          signal: timeoutSignal(20_000),
        });
        const data = parseJsonPayload<{ leads?: Lead[]; error?: string }>(await res.text(), res.status);
        if (res.ok && Array.isArray(data.leads)) return data.leads;
        if (res.status === 401) {
          clearLocalSession();
          throw new Error("Sessão expirada. Entre de novo no master.");
        }
      } catch (err) {
        if (err instanceof Error && /Sessão expirada/.test(err.message)) throw err;
      }
      const data = await request<{ leads: Lead[] }>("leads", {}, token());
      return data.leads;
    }
    return localPlatform.leads();
  },

  async accounts() {
    if (await backend()) {
      const data = await request<{ accounts: AccountRecord[] }>("accounts", {}, token());
      return data.accounts;
    }
    return localPlatform.accounts();
  },

  async subscriptions() {
    if (await backend()) {
      const data = await request<{ subscriptions: Subscription[] }>("subscriptions", {}, token());
      return data.subscriptions;
    }
    return localPlatform.subscriptions();
  },

  async finance() {
    if (await backend()) {
      return request<{
        mrr: number;
        receivedThisMonth: number;
        payments: PaymentRecord[];
        emails: EmailLog[];
      }>("finance", {}, token());
    }
    return localPlatform.finance();
  },

  async setSubscription(id: string, status: Subscription["status"]) {
    if (await backend()) {
      const data = await request<{ subscription: Subscription }>("set-subscription", { id, status }, token());
      return data.subscription;
    }
    return localPlatform.setSubscription(id, status);
  },

  async mySubscription() {
    const session = readLocalSession();
    if (!session || session.user.role === "master") return null;
    if (await backend()) {
      const data = await request<{ subscription: Subscription | null }>("my-subscription", {}, session.token);
      return data.subscription ?? null;
    }
    const all = await localPlatform.subscriptions();
    return all.find((s) => s.userId === session.user.id) ?? null;
  },

  async cancelMySubscription() {
    const session = readLocalSession();
    if (!session) throw new Error("Sessão inválida.");
    if (await backend()) {
      const data = await request<{ ok: boolean; subscription: Subscription }>("cancel-subscription", {}, session.token);
      return data.subscription;
    }
    const all = await localPlatform.subscriptions();
    const mine = all.find((s) => s.userId === session.user.id);
    if (!mine) throw new Error("Assinatura não encontrada.");
    return localPlatform.setSubscription(mine.id, "cancelada");
  },

  async updateSubscription(
    id: string,
    patch: Partial<Pick<Subscription, "status" | "plan" | "cycle" | "amount" | "nextDue">>,
  ) {
    if (await backend()) {
      const data = await request<{ subscription: Subscription }>("update-subscription", { id, ...patch }, token());
      return data.subscription;
    }
    return localPlatform.updateSubscription(id, patch);
  },

  async deleteAccount(userId: string) {
    if (await backend()) {
      await request<{ ok: boolean }>("delete-account", { userId }, token());
      return;
    }
    return localPlatform.deleteAccount(userId);
  },

  /** Exclusão da própria conta (exigência App Store / Apple). */
  async deleteMyAccount() {
    if (await backend()) {
      await request<{ ok: boolean }>("delete-my-account", {}, token());
      clearLocalSession();
      return;
    }
    return localPlatform.deleteMyAccount();
  },

  async deletePayment(id: string) {
    if (await backend()) {
      await request<{ ok: boolean }>("delete-payment", { id }, token());
      return;
    }
    return localPlatform.deletePayment(id);
  },

  async resendPassword(userId: string) {
    if (await backend()) {
      return request<{ emailSent: boolean; tempPassword?: string; username: string }>(
        "resend-password",
        { userId },
        token(),
      );
    }
    return localPlatform.resendPassword(userId);
  },

  async forgotPassword(usuario: string) {
    const login = usuario.trim();
    if (!login) throw new Error("Informe o usuário ou o e-mail cadastrado.");
    if (await backend()) {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      let res: Response;
      try {
        res = await fetch(apiBase("/api/senha.php"), {
          method: "POST",
          headers,
          body: JSON.stringify({ acao: "esqueci", usuario: login }),
          signal: timeoutSignal(25_000),
          cache: "no-store",
        });
      } catch (err) {
        const name = err instanceof Error ? err.name : "";
        if (name === "AbortError" || name === "TimeoutError") {
          throw new Error("O envio demorou demais. Tente novamente.");
        }
        throw new Error("Falha na comunicação com o servidor. Verifique a internet e tente de novo.");
      }
      const data = parseJsonPayload<{ ok?: boolean; mensagem?: string; error?: string }>(
        await res.text(),
        res.status,
      );
      if (!res.ok) throw new Error(data.error || `Erro ${res.status} no servidor.`);
      return data.mensagem || "Se este cadastro existir, enviamos uma senha nova por e-mail.";
    }
    throw new Error("Recuperação de senha disponível apenas no site online.");
  },

  async syncWorkspace(workspace: Workspace) {
    const session = readLocalSession();
    if (!session) return { accepted: false as const, updatedAt: workspace.updatedAt };
    if (await backend()) {
      try {
        const res = await fetch(apiBase("/api/sync-workspace.php"), {
          method: "POST",
          cache: "no-store",
          signal: timeoutSignal(45_000),
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify({ workspace }),
        });
        const data = parseJsonPayload<{
          ok?: boolean;
          accepted?: boolean;
          updatedAt?: string;
          error?: string;
        }>(await res.text(), res.status);
        if (res.ok) {
          return {
            accepted: data.accepted !== false,
            updatedAt: data.updatedAt ?? workspace.updatedAt,
          };
        }
        if (data.error) throw new Error(data.error);
        throw new Error(`Erro ${res.status} ao salvar na nuvem.`);
      } catch (err) {
        if (err instanceof Error && !/Resposta inválida|Failed to fetch|NetworkError/i.test(err.message)) {
          // endpoint dedicado falhou com erro claro — tenta index.php
          if (!/Erro \d+|Não foi possível|Workspace|Sessão|bloqueada/i.test(err.message)) throw err;
        }
        const data = await request<{ ok?: boolean; accepted?: boolean; updatedAt?: string }>(
          "sync-workspace",
          { workspace },
          session.token,
        );
        return {
          accepted: data.accepted !== false,
          updatedAt: data.updatedAt ?? workspace.updatedAt,
        };
      }
    }
    await localPlatform.syncWorkspace(session.user.id, workspace);
    return { accepted: true as const, updatedAt: workspace.updatedAt };
  },

  async myWorkspace() {
    const session = readLocalSession();
    if (!session) return { snapshot: null as WorkspaceSnapshot | null, onboarding: undefined };
    if (await backend()) {
      try {
        const res = await fetch(apiBase("/api/my-workspace.php"), {
          method: "POST",
          cache: "no-store",
          signal: timeoutSignal(30_000),
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify({}),
        });
        const data = parseJsonPayload<{
          snapshot?: WorkspaceSnapshot | null;
          onboarding?: SessionUser;
          error?: string;
        }>(await res.text(), res.status);
        if (res.ok) {
          return { snapshot: data.snapshot ?? null, onboarding: data.onboarding };
        }
      } catch {
        /* fallback index.php */
      }
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 30000);
      try {
        const result = await request<{ snapshot: WorkspaceSnapshot | null; onboarding?: SessionUser }>(
          "my-workspace",
          {},
          session.token,
        );
        return result;
      } finally {
        window.clearTimeout(timer);
      }
    }
    return { snapshot: await localPlatform.myWorkspace(session.user.id), onboarding: session.user };
  },

  async workspaces() {
    if (await backend()) {
      const data = await request<{ workspaces: WorkspaceSnapshot[] }>("workspaces", {}, token());
      return data.workspaces;
    }
    return localPlatform.workspaces();
  },

  async backupStatus() {
    const t = token();
    if (!t) throw new Error("Sessão inválida.");
    const res = await fetch(apiBase("/api/backup-status.php"), {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${t}` },
      cache: "no-store",
      signal: timeoutSignal(20_000),
    });
    const text = await res.text();
    const data = parseJsonPayload<{
      ok?: boolean;
      error?: string;
      timezone?: string;
      schedule?: string;
      keepDays?: number;
      lastDay?: string;
      lastAt?: string;
      lastOk?: boolean;
      backups?: Array<{
        day: string;
        hasDb: boolean;
        bytes: number;
        manifest?: { stats?: Record<string, number>; createdAt?: string } | null;
      }>;
      cron?: { midnight?: string; hourlySafety?: string; note?: string };
    }>(text, res.status);
    if (!res.ok) throw new Error(String(data.error || `Erro ${res.status}`));
    return data;
  },

  async runBackupNow() {
    const t = token();
    if (!t) throw new Error("Sessão inválida.");
    const res = await fetch(apiBase("/api/backup-status.php"), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${t}`,
      },
      body: JSON.stringify({ action: "run" }),
      cache: "no-store",
      signal: timeoutSignal(60_000),
    });
    const text = await res.text();
    const data = parseJsonPayload<{
      ok?: boolean;
      error?: string;
      result?: { message?: string; day?: string; skipped?: boolean };
    }>(text, res.status);
    if (!res.ok || !data.ok) throw new Error(String(data.error || data.result?.message || `Erro ${res.status}`));
    return data;
  },
};
