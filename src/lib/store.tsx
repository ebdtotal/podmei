import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Accountant, AppState, CalendarEvent, Company, Contact, Employee, Entry, Investment, InvestmentMovement, MeiClient, PayrollRun, PlanKey, Product, WhatsAppMessage, Workspace } from "./types";
import { normalizePlan } from "./plans";
import { demoAccountant, demoClients, welcomeWhatsapp } from "./seed";
import { todayIso, uid } from "./utils";

const STORAGE_V1 = "mei-em-ordem-v1";
const STORAGE_KEY = "mei-em-ordem-v2";
const DEMO_CLIENT_IDS = new Set(["mei_amanda", "mei_joao", "mei_maria"]);

/** Cache local por conta — a fonte da verdade online é o SQLite (sync-workspace). */
let activeUserId: string | null = null;

export function bindStoreUser(userId: string | null) {
  activeUserId = userId;
}

/**
 * Master usava a chave compartilhada (sem userId). Quando a conta passa a syncar,
 * copia esse cache para mei-em-ordem-v2:{userId} se a chave por usuário estiver vazia.
 */
export function adoptSharedWorkspaceForUser(userId: string) {
  if (!userId) return;
  try {
    const keyed = parseWorkspaceRaw(localStorage.getItem(storageKeyFor(userId)));
    if (keyed && !isDemoWorkspace(keyed)) return;
    const shared = parseWorkspaceRaw(localStorage.getItem(STORAGE_KEY));
    if (!shared || isDemoWorkspace(shared)) return;
    localStorage.setItem(storageKeyFor(userId), JSON.stringify(shared));
  } catch {
    /* ignore */
  }
}

function storageKeyFor(userId?: string | null) {
  return userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY;
}

export function isDemoClientId(id: string): boolean {
  return DEMO_CLIENT_IDS.has(id);
}

export function isDemoWorkspace(ws: Workspace | null | undefined): boolean {
  if (!ws?.clients?.length) return false;
  return ws.clients.some((c) => isDemoClientId(c.id));
}

function stampWorkspace(ws: Workspace): Workspace {
  return { ...ws, updatedAt: new Date().toISOString() };
}

function emptyCompany(): Company {
  return {
    cnpj: "",
    nome: "Novo MEI",
    telefone: "",
    email: "",
    endereco: "",
    bairro: "",
    cidade: "",
    uf: "SP",
    tipo: "servicos",
    dataAbertura: todayIso(),
    capitalSocial: 1000,
    limiteFaturamento: 81000,
  };
}

type ClientDraft = Partial<Omit<MeiClient, "company">> & { company?: Partial<Company> };

export function createMeiClient(patch?: ClientDraft): MeiClient {
  const { company, ...rest } = patch ?? {};
  return {
    id: uid("mei"),
    status: "ativo",
    createdAt: todayIso(),
    notes: "",
    honorario: 150,
    entries: [],
    plan: "pro",
    whatsapp: welcomeWhatsapp(),
    whatsappPhone: "",
    employee: null,
    payrolls: [],
    contacts: [],
    products: [],
    events: [],
    investments: [],
    investmentMovements: [],
    ...rest,
    company: { ...emptyCompany(), ...company },
  };
}

function defaultWorkspace(): Workspace {
  const clients = demoClients();
  return stampWorkspace({
    accountant: demoAccountant,
    clients,
    activeClientId: clients[0]?.id ?? "",
  });
}

/** Workspace limpo para contas reais (nunca demo Amanda/João). */
export function emptyWorkspace(plan: PlanKey = "pro"): Workspace {
  const client = createMeiClient({ plan });
  return stampWorkspace({
    accountant: {
      nome: "",
      crc: "",
      email: "",
      telefone: "",
      escritorio: "Escritório",
    },
    clients: [client],
    activeClientId: client.id,
  });
}

function isWorkspace(data: unknown): data is Workspace {
  if (!data || typeof data !== "object") return false;
  const w = data as Workspace;
  return Array.isArray(w.clients) && w.clients.length > 0;
}

function isAppState(data: unknown): data is AppState {
  if (!data || typeof data !== "object") return false;
  const s = data as AppState;
  return Boolean(s.company) && Array.isArray(s.entries);
}

function fromV1(state: AppState): Workspace {
  const client = createMeiClient({
    id: "mei_importado",
    company: state.company,
    entries: state.entries,
    plan: normalizePlan(state.plan),
    whatsapp: state.whatsapp?.length ? state.whatsapp : welcomeWhatsapp(),
    whatsappPhone: state.whatsappPhone ?? "",
    contacts: state.contacts ?? [],
    notes: "Importado da versão anterior.",
  });
  const extras = demoClients().filter((c) => c.company.cnpj !== state.company.cnpj);
  return {
    accountant: demoAccountant,
    clients: [client, ...extras],
    activeClientId: client.id,
  };
}

function hydrateClient(client: MeiClient): MeiClient {
  return createMeiClient({
    ...client,
    entries: client.entries ?? [],
    whatsapp: client.whatsapp?.length ? client.whatsapp : welcomeWhatsapp(),
    contacts: client.contacts ?? [],
    products: client.products ?? [],
    payrolls: client.payrolls ?? [],
    events: client.events ?? [],
    investments: client.investments ?? [],
    investmentMovements: client.investmentMovements ?? [],
    company: client.company,
  });
}

function parseWorkspaceRaw(raw: string | null): Workspace | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Workspace;
    if (isWorkspace(parsed) && parsed.clients.length) {
      return {
        ...parsed,
        clients: parsed.clients.map((c) => hydrateClient({ ...c, plan: normalizePlan(c.plan) })),
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function loadWorkspaceFor(userId?: string | null): Workspace {
  // Conta logada: só o cache dessa conta. Nunca herda demo/compartilhado do navegador.
  if (userId) {
    const keyed = parseWorkspaceRaw(localStorage.getItem(storageKeyFor(userId)));
    if (keyed && !isDemoWorkspace(keyed)) return keyed;
    return emptyWorkspace();
  }

  try {
    const shared = parseWorkspaceRaw(localStorage.getItem(STORAGE_KEY));
    if (shared) return shared;
  } catch {
    /* ignore */
  }
  try {
    const legacy = localStorage.getItem(STORAGE_V1);
    if (legacy) {
      const parsed = JSON.parse(legacy) as AppState;
      if (isAppState(parsed)) return fromV1(parsed);
    }
  } catch {
    /* ignore */
  }
  return emptyWorkspace();
}

function loadWorkspace(): Workspace {
  return loadWorkspaceFor(activeUserId);
}

type PersistOptions = {
  /** Atualiza updatedAt (padrão: true). Hidratação da nuvem deve usar false. */
  stamp?: boolean;
  /** Emite evento para sync na nuvem (padrão: true). */
  emitSync?: boolean;
};

function persist(state: Workspace, options: PersistOptions = {}) {
  const stamp = options.stamp !== false;
  const emitSync = options.emitSync !== false;
  try {
    const next = stamp ? stampWorkspace(state) : state;
    const json = JSON.stringify(next);
    localStorage.setItem(storageKeyFor(activeUserId), json);
    // Não espelhar dados de um usuário no storage genérico (evita vazar Amanda p/ outra conta).
    if (!activeUserId) localStorage.setItem(STORAGE_KEY, json);
    if (emitSync) {
      window.dispatchEvent(new CustomEvent("podmei-workspace", { detail: next }));
    }
    return next;
  } catch {
    /* quota or private mode: keep the session in memory */
    return state;
  }
}

function activeOf(state: Workspace): MeiClient {
  return state.clients.find((c) => c.id === state.activeClientId) ?? state.clients[0] ?? createMeiClient();
}

function patchActive(prev: Workspace, patch: Partial<MeiClient>): Workspace {
  const id = prev.activeClientId;
  return {
    ...prev,
    clients: prev.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  };
}

interface StoreValue {
  accountant: Accountant;
  clients: MeiClient[];
  activeClientId: string;
  company: Company;
  entries: Entry[];
  plan: PlanKey;
  whatsapp: WhatsAppMessage[];
  whatsappPhone: string;
  employee: Employee | null;
  payrolls: PayrollRun[];
  contacts: Contact[];
  products: Product[];
  events: CalendarEvent[];
  investments: Investment[];
  investmentMovements: InvestmentMovement[];
  setAccountant: (accountant: Accountant) => void;
  setCompany: (company: Company) => void;
  addEntry: (entry: Entry) => void;
  addEntries: (entries: Entry[]) => void;
  updateEntry: (id: string, patch: Partial<Entry>) => void;
  removeEntry: (id: string) => void;
  removeEntries: (ids: string[]) => void;
  setPlan: (plan: PlanKey) => void;
  addWhatsapp: (msg: WhatsAppMessage) => void;
  setWhatsappPhone: (phone: string) => void;
  setEmployee: (employee: Employee | null) => void;
  upsertPayroll: (run: PayrollRun) => void;
  addContact: (contact: Omit<Contact, "id" | "createdAt"> & { id?: string; createdAt?: string }) => Contact;
  updateContact: (id: string, patch: Partial<Contact>) => void;
  removeContact: (id: string) => void;
  addProduct: (product: Omit<Product, "id" | "createdAt"> & { id?: string; createdAt?: string }) => Product;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  removeProduct: (id: string) => void;
  addEvent: (event: Omit<CalendarEvent, "id" | "createdAt"> & { id?: string; createdAt?: string }) => CalendarEvent;
  addEvents: (events: Array<Omit<CalendarEvent, "id" | "createdAt"> & { id?: string; createdAt?: string }>) => CalendarEvent[];
  updateEvent: (id: string, patch: Partial<CalendarEvent>) => void;
  removeEvent: (id: string) => void;
  addInvestment: (investment: Omit<Investment, "id" | "createdAt"> & { id?: string; createdAt?: string }) => Investment;
  updateInvestment: (id: string, patch: Partial<Investment>) => void;
  removeInvestment: (id: string) => void;
  addInvestmentMovement: (
    move: Omit<InvestmentMovement, "id" | "createdAt"> & { id?: string; createdAt?: string },
  ) => InvestmentMovement;
  removeInvestmentMovement: (id: string) => void;
  addClient: (client?: ClientDraft) => MeiClient;
  updateClient: (id: string, patch: Partial<MeiClient>) => void;
  removeClient: (id: string) => void;
  selectClient: (id: string) => void;
  openSharedClient: (client: MeiClient) => void;
  importClient: (data: AppState) => MeiClient;
  resetDemo: () => void;
  exportBackup: () => void;
  exportWorkspace: () => void;
  importBackup: (data: unknown) => void;
  replaceWorkspace: (workspace: Workspace, options?: PersistOptions) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Workspace>(loadWorkspace);

  const value = useMemo<StoreValue>(() => {
    const commit = (updater: (prev: Workspace) => Workspace) => {
      setState((prev) => {
        const next = updater(prev);
        // Persist devolve o snapshot com updatedAt — React deve usar o mesmo
        // valor que vai para a nuvem (senão o LWW do servidor rejeita).
        return persist(next);
      });
    };
    const active = activeOf(state);
    return {
      accountant: state.accountant,
      clients: state.clients,
      activeClientId: active.id,
      company: active.company,
      entries: active.entries,
      plan: active.plan,
      whatsapp: active.whatsapp,
      whatsappPhone: active.whatsappPhone,
      employee: active.employee ?? null,
      payrolls: active.payrolls ?? [],
      contacts: active.contacts ?? [],
      products: active.products ?? [],
      events: active.events ?? [],
      investments: active.investments ?? [],
      investmentMovements: active.investmentMovements ?? [],
      setAccountant: (accountant) => commit((prev) => ({ ...prev, accountant })),
      setCompany: (company) => commit((prev) => patchActive(prev, { company })),
      addEntry: (entry) =>
        commit((prev) => {
          const cur = activeOf(prev);
          return patchActive(prev, {
            entries: [...cur.entries, entry].sort((a, b) => a.data.localeCompare(b.data)),
          });
        }),
      addEntries: (list) =>
        commit((prev) => {
          const cur = activeOf(prev);
          return patchActive(prev, {
            entries: [...cur.entries, ...list].sort((a, b) => a.data.localeCompare(b.data)),
          });
        }),
      updateEntry: (id, patch) =>
        commit((prev) => {
          const cur = activeOf(prev);
          return patchActive(prev, {
            entries: cur.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
          });
        }),
      removeEntry: (id) =>
        commit((prev) => {
          const cur = activeOf(prev);
          return patchActive(prev, { entries: cur.entries.filter((e) => e.id !== id) });
        }),
      removeEntries: (ids) => {
        const set = new Set(ids);
        if (!set.size) return;
        commit((prev) => {
          const cur = activeOf(prev);
          return patchActive(prev, { entries: cur.entries.filter((e) => !set.has(e.id)) });
        });
      },
      setPlan: (plan) => commit((prev) => patchActive(prev, { plan })),
      addWhatsapp: (msg) =>
        commit((prev) => {
          const cur = activeOf(prev);
          return patchActive(prev, { whatsapp: [...cur.whatsapp, msg] });
        }),
      setWhatsappPhone: (whatsappPhone) => commit((prev) => patchActive(prev, { whatsappPhone })),
      setEmployee: (employee) => commit((prev) => patchActive(prev, { employee })),
      upsertPayroll: (run) =>
        commit((prev) => {
          const cur = activeOf(prev);
          const list = cur.payrolls ?? [];
          const i = list.findIndex((p) => p.id === run.id);
          const payrolls = i >= 0 ? list.map((p) => (p.id === run.id ? run : p)) : [...list, run];
          return patchActive(prev, { payrolls });
        }),
      addContact: (partial) => {
        const contact: Contact = {
          ...partial,
          id: partial.id || uid("cad"),
          createdAt: partial.createdAt || todayIso(),
        };
        commit((prev) => {
          const cur = activeOf(prev);
          return patchActive(prev, { contacts: [...(cur.contacts ?? []), contact] });
        });
        return contact;
      },
      updateContact: (id, patch) =>
        commit((prev) => {
          const cur = activeOf(prev);
          return patchActive(prev, {
            contacts: (cur.contacts ?? []).map((c) => (c.id === id ? { ...c, ...patch } : c)),
          });
        }),
      removeContact: (id) =>
        commit((prev) => {
          const cur = activeOf(prev);
          return patchActive(prev, { contacts: (cur.contacts ?? []).filter((c) => c.id !== id) });
        }),
      addProduct: (partial) => {
        const product: Product = {
          ...partial,
          id: partial.id || uid("prd"),
          createdAt: partial.createdAt || todayIso(),
        };
        commit((prev) => {
          const cur = activeOf(prev);
          return patchActive(prev, { products: [...(cur.products ?? []), product] });
        });
        return product;
      },
      updateProduct: (id, patch) =>
        commit((prev) => {
          const cur = activeOf(prev);
          return patchActive(prev, {
            products: (cur.products ?? []).map((p) => (p.id === id ? { ...p, ...patch } : p)),
          });
        }),
      removeProduct: (id) =>
        commit((prev) => {
          const cur = activeOf(prev);
          return patchActive(prev, { products: (cur.products ?? []).filter((p) => p.id !== id) });
        }),
      addEvent: (partial) => {
        const event: CalendarEvent = {
          ...partial,
          id: partial.id || uid("evt"),
          createdAt: partial.createdAt || todayIso(),
        };
        commit((prev) => {
          const cur = activeOf(prev);
          return patchActive(prev, { events: [...(cur.events ?? []), event] });
        });
        return event;
      },
      addEvents: (partials) => {
        const created = partials.map((partial) => ({
          ...partial,
          id: partial.id || uid("evt"),
          createdAt: partial.createdAt || todayIso(),
        }));
        if (created.length) {
          commit((prev) => {
            const cur = activeOf(prev);
            return patchActive(prev, { events: [...(cur.events ?? []), ...created] });
          });
        }
        return created;
      },
      updateEvent: (id, patch) =>
        commit((prev) => {
          const cur = activeOf(prev);
          return patchActive(prev, {
            events: (cur.events ?? []).map((e) => (e.id === id ? { ...e, ...patch } : e)),
          });
        }),
      removeEvent: (id) =>
        commit((prev) => {
          const cur = activeOf(prev);
          return patchActive(prev, { events: (cur.events ?? []).filter((e) => e.id !== id) });
        }),
      addInvestment: (partial) => {
        const investment: Investment = {
          ...partial,
          id: partial.id || uid("inv"),
          createdAt: partial.createdAt || todayIso(),
        };
        commit((prev) => {
          const cur = activeOf(prev);
          return patchActive(prev, { investments: [...(cur.investments ?? []), investment] });
        });
        return investment;
      },
      updateInvestment: (id, patch) =>
        commit((prev) => {
          const cur = activeOf(prev);
          return patchActive(prev, {
            investments: (cur.investments ?? []).map((i) => (i.id === id ? { ...i, ...patch } : i)),
          });
        }),
      removeInvestment: (id) =>
        commit((prev) => {
          const cur = activeOf(prev);
          return patchActive(prev, {
            investments: (cur.investments ?? []).filter((i) => i.id !== id),
            investmentMovements: (cur.investmentMovements ?? []).filter((m) => m.investmentId !== id),
          });
        }),
      addInvestmentMovement: (partial) => {
        const move: InvestmentMovement = {
          ...partial,
          id: partial.id || uid("imov"),
          createdAt: partial.createdAt || todayIso(),
        };
        commit((prev) => {
          const cur = activeOf(prev);
          return patchActive(prev, {
            investmentMovements: [...(cur.investmentMovements ?? []), move].sort((a, b) =>
              a.data.localeCompare(b.data),
            ),
          });
        });
        return move;
      },
      removeInvestmentMovement: (id) =>
        commit((prev) => {
          const cur = activeOf(prev);
          return patchActive(prev, {
            investmentMovements: (cur.investmentMovements ?? []).filter((m) => m.id !== id),
          });
        }),
      addClient: (partial) => {
        const client = createMeiClient(partial);
        commit((prev) => ({
          ...prev,
          clients: [...prev.clients, client],
          activeClientId: client.id,
        }));
        return client;
      },
      updateClient: (id, patch) =>
        commit((prev) => ({
          ...prev,
          clients: prev.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      removeClient: (id) =>
        commit((prev) => {
          const remaining = prev.clients.filter((c) => c.id !== id);
          if (remaining.length === 0) {
            const fresh = createMeiClient();
            return { ...prev, clients: [fresh], activeClientId: fresh.id };
          }
          return {
            ...prev,
            clients: remaining,
            activeClientId: prev.activeClientId === id ? remaining[0].id : prev.activeClientId,
          };
        }),
      selectClient: (id) => commit((prev) => ({ ...prev, activeClientId: id })),
      openSharedClient: (client) => {
        if (!client?.company) return;
        const ready: MeiClient = {
          ...client,
          id: client.sharedInviteId ? `share_${client.sharedInviteId}` : client.id,
          sharedInviteId: client.sharedInviteId,
          status: client.status || "ativo",
          entries: client.entries ?? [],
          contacts: client.contacts ?? [],
          products: client.products ?? [],
          whatsapp: client.whatsapp ?? [],
          whatsappPhone: client.whatsappPhone ?? "",
          honorario: client.honorario ?? 0,
          notes: client.notes ?? "",
          createdAt: client.createdAt || new Date().toISOString().slice(0, 10),
          plan: client.plan || "pro",
        };
        commit((prev) => {
          const exists = prev.clients.some((c) => c.id === ready.id);
          return {
            ...prev,
            clients: exists ? prev.clients.map((c) => (c.id === ready.id ? { ...c, ...ready } : c)) : [...prev.clients, ready],
            activeClientId: ready.id,
          };
        });
      },
      importClient: (data) => {
        const client = createMeiClient({
          company: data.company,
          entries: data.entries,
          plan: normalizePlan(data.plan),
          whatsapp: data.whatsapp?.length ? data.whatsapp : welcomeWhatsapp(),
          whatsappPhone: data.whatsappPhone ?? "",
          contacts: data.contacts ?? [],
          notes: "Importado de arquivo.",
        });
        commit((prev) => ({
          ...prev,
          clients: [...prev.clients, client],
          activeClientId: client.id,
        }));
        return client;
      },
      resetDemo: () => {
        localStorage.removeItem(storageKeyFor(activeUserId));
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_V1);
        commit(() => defaultWorkspace());
      },
      exportBackup: () => {
        const payload: AppState = {
          company: active.company,
          entries: active.entries,
          plan: active.plan,
          whatsapp: active.whatsapp,
          whatsappPhone: active.whatsappPhone,
          contacts: active.contacts ?? [],
        };
        downloadJson(payload, `mei-${slug(active.company.nome)}-${todayIso()}.json`);
      },
      exportWorkspace: () => {
        downloadJson(state, `carteira-contador-${todayIso()}.json`);
      },
      importBackup: (data) => {
        try {
          if (isWorkspace(data) && data.clients.length) {
            commit(() => ({
              ...(data as Workspace),
              clients: (data as Workspace).clients.map((c) => hydrateClient({ ...c, plan: normalizePlan(c.plan) })),
            }));
            return;
          }
          if (isAppState(data)) {
            commit((prev) =>
              patchActive(prev, {
                company: data.company,
                entries: data.entries,
                plan: normalizePlan(data.plan ?? prev.clients.find((c) => c.id === prev.activeClientId)?.plan),
                whatsapp: data.whatsapp?.length ? data.whatsapp : welcomeWhatsapp(),
                whatsappPhone: data.whatsappPhone ?? "",
                contacts: data.contacts ?? prev.clients.find((c) => c.id === prev.activeClientId)?.contacts ?? [],
              }),
            );
            return;
          }
        } catch {
          /* ignora erro de importação, mantém workspace atual */
        }
      },
      replaceWorkspace: (workspace, options) => {
        setState(() => {
          const next = persist(workspace, options) ?? workspace;
          return next;
        });
      },
    };
  }, [state]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore fora do provider");
  return {
    ...ctx,
    clients: ctx.clients ?? [],
    products: ctx.products ?? [],
    contacts: ctx.contacts ?? [],
    accountant: ctx.accountant ?? {
      nome: "",
      crc: "",
      email: "",
      telefone: "",
      escritorio: "Escritório",
    },
    activeClientId: ctx.activeClientId ?? "",
    selectClient: ctx.selectClient ?? (() => undefined),
    openSharedClient: ctx.openSharedClient ?? (() => undefined),
  };
}

function slug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "mei";
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
