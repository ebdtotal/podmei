/**
 * Creates Apple Review Pro demo account + seeds workspace + fills ASC review detail.
 * Usage (PowerShell): set ASC env + node scripts/setup-apple-review-demo.mjs
 */
import crypto from "node:crypto";

const ORIGIN = "https://podmei.com";
const SEED_KEY = "PodmeiContadorTeste2026";
const DEMO_USER = process.env.ASC_DEMO_USER || "appreview";
const DEMO_PASS = process.env.ASC_DEMO_PASS || "AppleReview#Podmei26";
const DEMO_EMAIL = process.env.ASC_DEMO_EMAIL || "apple.review@podmei.com";
const APP_ID = "6809059844";
const VERSION_ID = "6c8d2873-4399-4d5c-ab17-0428af4ec2a7";

const KEY_ID = process.env.APP_STORE_CONNECT_KEY_IDENTIFIER;
const ISSUER = process.env.APP_STORE_CONNECT_ISSUER_ID;
const P8 = process.env.APP_STORE_CONNECT_PRIVATE_KEY;

function reviewWorkspace() {
  const entries = [];
  const sales = [
    ["2026-01-31", 6883],
    ["2026-02-28", 6456],
    ["2026-03-30", 6595.11],
    ["2026-04-30", 6957.03],
    ["2026-05-31", 8531],
    ["2026-06-30", 7237.37],
    ["2026-07-31", 8431],
  ];
  sales.forEach(([data, valor], i) => {
    entries.push({
      id: `rev_sale_${i}`,
      data,
      contraparte: "CLÍNICA SOLAR",
      documento: "RECIBO",
      kind: "venda",
      revenueKind: "servico",
      valor,
      descricao: "SERVIÇOS",
      status: "liquidado",
      documentoFiscal: false,
      formaPagamento: "pix",
      source: "manual",
    });
  });
  [
    ["2026-01-20", 80.9, "DAS 12/2025"],
    ["2026-02-20", 80.9, "DAS 01/2026"],
    ["2026-03-20", 81.9, "DAS 02/2026"],
    ["2026-04-20", 81.9, "DAS 03/2026"],
    ["2026-05-20", 86.05, "DAS 04/2026"],
    ["2026-06-20", 86.05, "DAS 05/2026"],
    ["2026-07-20", 86.05, "DAS 06/2026"],
  ].forEach(([data, valor, doc], i) => {
    entries.push({
      id: `rev_das_${i}`,
      data,
      contraparte: "IMPOSTO",
      documento: doc,
      kind: "despesa",
      valor,
      descricao: "DAS MENSAL",
      status: "liquidado",
      documentoFiscal: false,
      formaPagamento: "pix",
      source: "manual",
    });
  });
  entries.push({
    id: "rev_compra_1",
    data: "2026-04-12",
    contraparte: "PAPELARIA CENTRAL",
    documento: "NF 441",
    kind: "compra",
    valor: 92.05,
    descricao: "MATERIAL DE ESCRITÓRIO",
    status: "liquidado",
    documentoFiscal: true,
    formaPagamento: "pix",
    source: "manual",
  });

  const client = {
    id: "mei_review_pro",
    status: "ativo",
    createdAt: "2026-01-10",
    notes: "Conta demo App Review — dados fictícios para inspeção.",
    honorario: 150,
    plan: "pro",
    whatsappPhone: "",
    whatsapp: [],
    company: {
      cnpj: "64.083.362/0001-76",
      nome: "AMANDA REVIEW PODMEI",
      telefone: "(18) 98163-5607",
      email: DEMO_EMAIL,
      endereco: "RUA JAGUAR",
      bairro: "JARDIM AEROPORTO II",
      cidade: "MIRANDOPOLIS",
      uf: "SP",
      tipo: "servicos",
      dataAbertura: "2025-12-16",
      capitalSocial: 5000,
      limiteFaturamento: 81000,
      dasPerfil: "servicos",
    },
    entries,
    contacts: [
      {
        id: "rev_cad_clinica",
        kind: "cliente",
        nome: "CLÍNICA SOLAR",
        documento: "23.456.789/0001-10",
        telefone: "(18) 3333-1200",
        email: "contato@clinicasolar.com",
        endereco: "",
        cidade: "MIRANDOPOLIS",
        uf: "SP",
        observacao: "",
        createdAt: "2026-01-10",
      },
      {
        id: "rev_cad_papel",
        kind: "fornecedor",
        nome: "PAPELARIA CENTRAL",
        documento: "",
        telefone: "(18) 3521-4411",
        email: "",
        endereco: "",
        cidade: "MIRANDOPOLIS",
        uf: "SP",
        observacao: "",
        createdAt: "2026-01-10",
      },
    ],
    products: [
      {
        id: "rev_prod_1",
        kind: "servico",
        nome: "Consultoria MEI",
        preco: 350,
        unidade: "hora",
        createdAt: "2026-01-10",
      },
    ],
  };

  return {
    accountant: {
      nome: "",
      crc: "",
      email: DEMO_EMAIL,
      telefone: "",
      escritorio: "",
    },
    clients: [client],
    activeClientId: client.id,
    updatedAt: new Date().toISOString(),
  };
}

async function apiJson(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text.slice(0, 500) };
  }
  if (!res.ok) {
    throw new Error(`${url} → ${res.status} ${JSON.stringify(data).slice(0, 400)}`);
  }
  return data;
}

function ascToken() {
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: KEY_ID, typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({ iss: ISSUER, iat: now, exp: now + 1100, aud: "appstoreconnect-v1" }),
  ).toString("base64url");
  const sign = crypto.createSign("SHA256");
  sign.update(`${header}.${payload}`);
  const sig = sign.sign({ key: P8.replace(/\\n/g, "\n"), dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `${header}.${payload}.${sig}`;
}

async function asc(pathname, init = {}) {
  const res = await fetch(`https://api.appstoreconnect.apple.com/v1${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${ascToken()}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  console.log(`ASC ${init.method || "GET"} ${pathname} → ${res.status}`);
  if (!res.ok) console.log(JSON.stringify(data).slice(0, 800));
  return data;
}

console.log("1) Criando/atualizando conta demo Pro…");
const created = await apiJson(`${ORIGIN}/api/criar-conta-teste.php`, {
  method: "POST",
  body: JSON.stringify({
    key: SEED_KEY,
    plan: "pro",
    email: DEMO_EMAIL,
    username: DEMO_USER,
    nome: "Apple Review PODMEI",
    password: DEMO_PASS,
  }),
});
console.log("conta", {
  username: created.username || created.user?.username || DEMO_USER,
  email: created.email || DEMO_EMAIL,
  ok: created.ok ?? true,
});

console.log("2) Login…");
let login;
try {
  login = await apiJson(`${ORIGIN}/api/login.php`, {
    method: "POST",
    body: JSON.stringify({ username: DEMO_USER, password: DEMO_PASS }),
  });
} catch {
  login = await apiJson(`${ORIGIN}/api/index.php?action=login`, {
    method: "POST",
    body: JSON.stringify({ username: DEMO_USER, password: DEMO_PASS }),
  });
}
if (!login.token) throw new Error(`login sem token: ${JSON.stringify(login).slice(0, 300)}`);
console.log("login ok", login.user?.username || DEMO_USER);

console.log("3) Sincronizando workspace com conteúdo…");
const workspace = reviewWorkspace();
const synced = await apiJson(`${ORIGIN}/api/index.php?action=sync-workspace`, {
  method: "POST",
  headers: { Authorization: `Bearer ${login.token}` },
  body: JSON.stringify({ workspace }),
});
console.log("sync", synced.ok ? "ok" : synced);

console.log("4) Verificando my-workspace…");
const mine = await apiJson(`${ORIGIN}/api/index.php?action=my-workspace`, {
  method: "POST",
  headers: { Authorization: `Bearer ${login.token}` },
  body: "{}",
});
const clients = mine.snapshot?.workspace?.clients || [];
const entries = clients[0]?.entries?.length || 0;
console.log("workspace clients", clients.length, "entries", entries);

if (!KEY_ID || !ISSUER || !P8) {
  console.log("ASC credentials ausentes — conta demo pronta, pulei App Review Information.");
  process.exit(0);
}

console.log("5) Preenchendo App Review Information no ASC…");
const notes = [
  "App de gestão financeira para MEI. API em https://podmei.com (HTTPS).",
  "",
  `Demo: usuário ${DEMO_USER} / senha ${DEMO_PASS}`,
  "Conta Pro com empresa, lançamentos, clientes, produtos e relatórios pré-carregados.",
  "",
  "IMPORTANTE (Guideline 3.1.1): no app iOS NÃO há compra, upgrade nem Mercado Pago.",
  "Assinatura só em podmei.com no navegador. Sem IAP.",
  "",
  "Exclusão de conta: Empresa → Excluir minha conta.",
].join("\n");

const details = await asc(`/appStoreVersions/${VERSION_ID}/appStoreReviewDetail`);
const detailId = details.data?.id;
const attrs = {
  contactFirstName: "PODMEI",
  contactLastName: "Suporte",
  contactPhone: "+5598981258852",
  contactEmail: "suporte@podmei.com",
  demoAccountName: DEMO_USER,
  demoAccountPassword: DEMO_PASS,
  demoAccountRequired: true,
  notes,
};
if (detailId) {
  await asc(`/appStoreReviewDetails/${detailId}`, {
    method: "PATCH",
    body: JSON.stringify({
      data: { type: "appStoreReviewDetails", id: detailId, attributes: attrs },
    }),
  });
} else {
  await asc("/appStoreReviewDetails", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "appStoreReviewDetails",
        attributes: attrs,
        relationships: {
          appStoreVersion: { data: { type: "appStoreVersions", id: VERSION_ID } },
        },
      },
    }),
  });
}

const check = await asc(`/appStoreVersions/${VERSION_ID}/appStoreReviewDetail`);
console.log("review detail", {
  demoAccountName: check.data?.attributes?.demoAccountName,
  demoAccountRequired: check.data?.attributes?.demoAccountRequired,
  hasPassword: Boolean(check.data?.attributes?.demoAccountPassword),
});
console.log("OK app", APP_ID);
