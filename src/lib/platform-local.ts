import { pixCopiaECola } from "./pix";
import { planPrice } from "./plans";
import type { BillingCycle, PlanKey, Workspace } from "./types";
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
import { MASTER_BOOTSTRAP_PASSWORD, MASTER_USERNAME } from "./platform-types";

const KEY = "pod-mei-platform-v1";
const SESSION_KEY = "pod-mei-session";

type UserRow = AccountRecord & { passwordHash: string };

interface StoreFile {
  users: UserRow[];
  leads: Lead[];
  subscriptions: Subscription[];
  payments: PaymentRecord[];
  emails: EmailLog[];
  workspaces: WorkspaceSnapshot[];
}

async function sha(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`podmei:${text}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addMonths(iso: string, months: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function origin() {
  if (typeof window === "undefined") return "https://podmei.com";
  return window.location.origin;
}

function publicUser(u: UserRow): SessionUser & AccountRecord {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    nome: u.nome,
    role: u.role,
    plan: u.plan,
    mustChangePassword: u.mustChangePassword,
    telefone: u.telefone,
    cnpj: u.cnpj,
    empresa: u.empresa,
    status: u.status,
    createdAt: u.createdAt,
  };
}

function emptyStore(): StoreFile {
  return {
    users: [],
    leads: [],
    subscriptions: [],
    payments: [],
    emails: [],
    workspaces: [],
  };
}

function read(): StoreFile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as StoreFile;
  } catch {
    /* ignore */
  }
  return emptyStore();
}

function write(store: StoreFile) {
  localStorage.setItem(KEY, JSON.stringify(store));
}

async function ensureMaster(store: StoreFile) {
  if (store.users.some((u) => u.role === "master")) return store;
  store.users.push({
    id: uid("usr"),
    username: MASTER_USERNAME,
    email: "itanosampaio@podmei.com",
    nome: "Itano Sampaio",
    role: "master",
    plan: "master",
    status: "ativo",
    mustChangePassword: false,
    createdAt: nowIso(),
    passwordHash: await sha(MASTER_BOOTSTRAP_PASSWORD),
  });
  write(store);
  return store;
}

function tempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${out}#1`;
}

function logEmail(store: StoreFile, to: string, subject: string) {
  store.emails.push({ id: uid("mail"), to, subject, at: nowIso(), ok: true });
}

async function activate(store: StoreFile, lead: Lead): Promise<ConfirmPaymentResult> {
  if (lead.status === "ativo" && lead.userId) return { lead };
  const temp = tempPassword();
  let username = lead.email;
  if (store.users.some((u) => u.email.toLowerCase() === lead.email.toLowerCase() || u.username === username)) {
    username = `${lead.email.replace(/@.*$/, "")}${lead.id.slice(-4)}`;
  }
  const user: UserRow = {
    id: uid("usr"),
    username,
    email: lead.email,
    nome: lead.nome,
    role: lead.plan === "contador" || lead.plan === "contador_premium" ? "contador" : "pro",
    plan: lead.plan,
    status: "ativo",
    mustChangePassword: false,
    createdAt: nowIso(),
    telefone: lead.telefone,
    cnpj: lead.cnpj,
    empresa: lead.empresa,
    passwordHash: await sha(temp),
  };
  store.users.push(user);
  const started = today();
  store.subscriptions.push({
    id: uid("sub"),
    userId: user.id,
    leadId: lead.id,
    nome: lead.nome,
    email: lead.email,
    plan: lead.plan,
    cycle: lead.cycle,
    amount: lead.amount,
    status: "ativa",
    startedAt: started,
    nextDue: addMonths(started, lead.cycle === "year" ? 12 : 1),
    lastPaidAt: started,
  });
  store.payments = store.payments.map((p) =>
    p.leadId === lead.id ? { ...p, status: "confirmado", confirmedAt: nowIso(), userId: user.id } : p,
  );
  lead.status = "ativo";
  lead.paidAt = nowIso();
  lead.userId = user.id;
  logEmail(store, lead.email, "Seu acesso PODMEI está pronto");
  write(store);
  return { lead, tempPassword: temp, emailSent: true, username };
}

export const localPlatform = {
  async login(username: string, password: string) {
    const store = await ensureMaster(read());
    const hash = await sha(password);
    const user = store.users.find(
      (u) =>
        (u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === username.toLowerCase()) &&
        u.passwordHash === hash,
    );
    if (!user) throw new Error("Usuário ou senha inválidos.");
    if (user.status !== "ativo") throw new Error("Conta bloqueada.");
    const token = `local.${user.id}`;
    writeLocalSession({ token, user: publicUser(user) });
    return { token, user: publicUser(user) };
  },

  async checkout(input: CheckoutInput) {
    const store = await ensureMaster(read());
    const id = uid("lead");
    const amount = input.test ? 2 : planPrice(input.plan, input.cycle);
    const pixKey = "";
    const lead: Lead = {
      id,
      createdAt: nowIso(),
      nome: input.nome.trim(),
      email: input.email.trim().toLowerCase(),
      telefone: input.telefone.trim(),
      cnpj: input.cnpj.trim(),
      empresa: input.empresa.trim(),
      plan: input.plan,
      cycle: input.cycle,
      amount,
      title: input.test ? "Teste PODMEI R$ 2,00" : undefined,
      status: "aguardando_pagamento",
      paymentUrl: `${origin()}/pagar/${id}`,
      pixKey,
      pixPayload: pixKey ? pixCopiaECola({ key: pixKey, name: "POD MEI", amount, txid: id }) : "",
    };
    store.leads.push(lead);
    store.payments.push({
      id: uid("pay"),
      leadId: id,
      nome: lead.nome,
      email: lead.email,
      amount,
      status: "pendente",
      method: "pix",
      createdAt: nowIso(),
    });
    write(store);
    return lead;
  },

  async getLead(id: string) {
    const store = await ensureMaster(read());
    const lead = store.leads.find((l) => l.id === id);
    if (!lead) throw new Error("Pagamento não encontrado.");
    return lead;
  },

  async confirmPayment(id: string) {
    const store = await ensureMaster(read());
    const lead = store.leads.find((l) => l.id === id);
    if (!lead) throw new Error("Pagamento não encontrado.");
    return activate(store, lead);
  },

  async changePassword(password: string, userId: string) {
    const store = await ensureMaster(read());
    const user = store.users.find((u) => u.id === userId);
    if (!user) throw new Error("Sessão inválida.");
    if (password.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
    user.passwordHash = await sha(password);
    user.mustChangePassword = false;
    write(store);
    return publicUser(user);
  },

  async leads() {
    const store = await ensureMaster(read());
    return [...store.leads].reverse();
  },
  async accounts() {
    const store = await ensureMaster(read());
    return store.users.map(publicUser);
  },
  async subscriptions() {
    const store = await ensureMaster(read());
    return [...store.subscriptions].reverse();
  },
  async finance() {
    const store = await ensureMaster(read());
    const mrr = store.subscriptions
      .filter((s) => s.status === "ativa")
      .reduce((sum, s) => sum + (s.cycle === "year" ? s.amount / 12 : s.amount), 0);
    const month = today().slice(0, 7);
    const receivedThisMonth = store.payments
      .filter((p) => p.status === "confirmado" && (p.confirmedAt || "").startsWith(month))
      .reduce((sum, p) => sum + p.amount, 0);
    return {
      mrr,
      receivedThisMonth,
      payments: [...store.payments].reverse(),
      emails: [...store.emails].reverse(),
    };
  },
  async setSubscription(id: string, status: Subscription["status"]) {
    const store = await ensureMaster(read());
    const sub = store.subscriptions.find((s) => s.id === id);
    if (!sub) throw new Error("Assinatura não encontrada.");
    sub.status = status;
    const user = store.users.find((u) => u.id === sub.userId);
    if (user && user.role !== "master") user.status = status === "cancelada" ? "bloqueado" : "ativo";
    write(store);
    return sub;
  },
  async updateSubscription(
    id: string,
    patch: Partial<{ status: Subscription["status"]; plan: PlanKey; cycle: BillingCycle; amount: number; nextDue: string }>,
  ) {
    const store = await ensureMaster(read());
    const sub = store.subscriptions.find((s) => s.id === id);
    if (!sub) throw new Error("Assinatura não encontrada.");
    if (patch.status) sub.status = patch.status;
    if (patch.plan) {
      sub.plan = patch.plan;
      const user = store.users.find((u) => u.id === sub.userId);
      if (user && user.role !== "master") {
        user.plan = patch.plan;
        user.role = patch.plan === "contador" || patch.plan === "contador_premium" ? "contador" : "pro";
      }
    }
    if (patch.cycle) sub.cycle = patch.cycle;
    if (typeof patch.amount === "number") sub.amount = patch.amount;
    if (patch.nextDue) sub.nextDue = patch.nextDue;
    const user = store.users.find((u) => u.id === sub.userId);
    if (user && user.role !== "master") {
      user.status = sub.status === "cancelada" ? "bloqueado" : "ativo";
    }
    write(store);
    return sub;
  },
  async deleteAccount(userId: string) {
    const store = await ensureMaster(read());
    const user = store.users.find((u) => u.id === userId);
    if (!user) throw new Error("Conta não encontrada.");
    if (user.role === "master") throw new Error("A conta master não pode ser excluída.");
    store.users = store.users.filter((u) => u.id !== userId);
    store.subscriptions = store.subscriptions.filter((s) => s.userId !== userId);
    store.workspaces = store.workspaces.filter((w) => w.userId !== userId);
    write(store);
  },
  async deleteMyAccount() {
    const session = readLocalSession();
    if (!session?.user?.id) throw new Error("Sessão inválida.");
    if (session.user.role === "master") throw new Error("A conta master não pode ser excluída.");
    const store = read();
    const userId = session.user.id;
    if (!store.users.some((u) => u.id === userId)) throw new Error("Conta não encontrada.");
    store.users = store.users.filter((u) => u.id !== userId);
    store.subscriptions = store.subscriptions.filter((s) => s.userId !== userId);
    store.workspaces = store.workspaces.filter((w) => w.userId !== userId);
    write(store);
    clearLocalSession();
  },
  async deletePayment(id: string) {
    const store = await ensureMaster(read());
    const before = store.payments.length;
    store.payments = store.payments.filter((p) => p.id !== id);
    if (store.payments.length === before) throw new Error("Pagamento não encontrado.");
    write(store);
  },
  async resendPassword(userId: string) {
    const store = await ensureMaster(read());
    const user = store.users.find((u) => u.id === userId);
    if (!user) throw new Error("Conta não encontrada.");
    const temp = tempPassword();
    user.passwordHash = await sha(temp);
    user.mustChangePassword = true;
    logEmail(store, user.email, "Seu acesso PODMEI está pronto");
    write(store);
    return { emailSent: true, tempPassword: temp, username: user.username };
  },
  async syncWorkspace(userId: string, workspace: Workspace) {
    const store = await ensureMaster(read());
    const user = store.users.find((u) => u.id === userId);
    if (!user) return;
    const snap: WorkspaceSnapshot = {
      userId,
      nome: user.nome,
      email: user.email,
      plan: user.plan,
      updatedAt: nowIso(),
      workspace,
    };
    const i = store.workspaces.findIndex((w) => w.userId === userId);
    if (i >= 0) store.workspaces[i] = snap;
    else store.workspaces.push(snap);
    write(store);
  },
  async myWorkspace(userId: string) {
    const store = await ensureMaster(read());
    return store.workspaces.find((w) => w.userId === userId) ?? null;
  },
  async workspaces() {
    const store = await ensureMaster(read());
    return store.workspaces;
  },
};

export function readLocalSession(): { token: string; user: SessionUser } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as { token: string; user: SessionUser }) : null;
  } catch {
    return null;
  }
}

export function writeLocalSession(session: { token: string; user: SessionUser }) {
  const raw = JSON.stringify(session);
  localStorage.setItem(SESSION_KEY, raw);
  void import("./session-persist").then((m) => m.persistSessionToNative(raw));
}

export function clearLocalSession() {
  localStorage.removeItem(SESSION_KEY);
  void import("./session-persist").then((m) => m.persistSessionToNative(null));
}

export { SESSION_KEY };
