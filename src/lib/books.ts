import { isPurchase, isSale, monthEntries, yearEntries } from "./mei";
import type { Entry, PaymentMethod } from "./types";
import { MONTHS } from "./types";

export type AccountNature = "devedora" | "credora";

export interface Account {
  code: string;
  name: string;
  nature: AccountNature;
}

export const ACCOUNTS = {
  caixa: { code: "1.1", name: "Caixa", nature: "devedora" as const },
  banco: { code: "1.2", name: "Banco", nature: "devedora" as const },
  clientes: { code: "1.3", name: "Clientes", nature: "devedora" as const },
  fornecedores: { code: "2.1", name: "Fornecedores", nature: "credora" as const },
  recServico: { code: "3.1", name: "Receita de serviços", nature: "credora" as const },
  recComercio: { code: "3.2", name: "Receita de comércio", nature: "credora" as const },
  recIndustria: { code: "3.3", name: "Receita de indústria", nature: "credora" as const },
  recTransporte: { code: "3.4", name: "Receita de transporte", nature: "credora" as const },
  compras: { code: "4.1", name: "Compras / CMV", nature: "devedora" as const },
  trib: { code: "5.1", name: "DAS e tributos", nature: "devedora" as const },
  contabil: { code: "5.2", name: "Honorários contábeis", nature: "devedora" as const },
  admin: { code: "5.3", name: "Despesas administrativas", nature: "devedora" as const },
  outras: { code: "5.9", name: "Outras despesas", nature: "devedora" as const },
} satisfies Record<string, Account>;

export interface CaixaRow {
  data: string;
  historico: string;
  documento: string;
  entrada: number;
  saida: number;
  saldo: number;
}

export interface LedgerLine {
  data: string;
  historico: string;
  documento: string;
  debito: number;
  credito: number;
  vencimento?: string;
}

export interface LedgerAccount {
  account: Account;
  lines: LedgerLine[];
  totalDebito: number;
  totalCredito: number;
  saldo: number;
}

export interface DreLine {
  label: string;
  value: number;
  bold?: boolean;
  muted?: boolean;
  indent?: number;
}

function cashAccount(method: PaymentMethod): Account {
  return method === "dinheiro" ? ACCOUNTS.caixa : ACCOUNTS.banco;
}

function revenueAccount(entry: Entry): Account {
  const kind = entry.revenueKind ?? "servico";
  if (kind === "comercio") return ACCOUNTS.recComercio;
  if (kind === "industria") return ACCOUNTS.recIndustria;
  if (kind === "transporte_carga" || kind === "transporte_passageiros") return ACCOUNTS.recTransporte;
  return ACCOUNTS.recServico;
}

function expenseAccount(entry: Entry): Account {
  const t = `${entry.descricao} ${entry.documento} ${entry.contraparte}`.toLowerCase();
  if (/\bdas\b|simei|imposto|iss|icms|inss/.test(t)) return ACCOUNTS.trib;
  if (/contab|contador/.test(t)) return ACCOUNTS.contabil;
  if (/aluguel|internet|energia|agua|telefone|material|escritorio/.test(t)) return ACCOUNTS.admin;
  return ACCOUNTS.outras;
}

export function livroCaixa(entries: Entry[], year: number, month?: number): CaixaRow[] {
  const list = (month == null ? yearEntries(entries, year) : monthEntries(entries, year, month))
    .filter((e) => e.status === "liquidado")
    .sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id));
  let saldo = 0;
  return list.map((e) => {
    const entrada = isSale(e) ? e.valor : 0;
    const saida = isSale(e) ? 0 : e.valor;
    saldo += entrada - saida;
    return {
      data: e.data,
      historico: `${e.contraparte} — ${e.descricao}`,
      documento: e.documento,
      entrada,
      saida,
      saldo,
    };
  });
}

export function livroRazao(entries: Entry[], year: number, month?: number): LedgerAccount[] {
  const list = (month == null ? yearEntries(entries, year) : monthEntries(entries, year, month)).sort(
    (a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id),
  );
  const buckets = new Map<string, { account: Account; lines: LedgerLine[] }>();

  function post(account: Account, line: LedgerLine) {
    const cur = buckets.get(account.code) ?? { account, lines: [] };
    cur.lines.push(line);
    buckets.set(account.code, cur);
  }

  for (const e of list) {
    const hist = `${e.contraparte} — ${e.descricao}`;
    if (isSale(e)) {
      const rec = revenueAccount(e);
      const dest = e.status === "a_receber" ? ACCOUNTS.clientes : cashAccount(e.formaPagamento);
      post(dest, {
        data: e.data,
        historico: hist,
        documento: e.documento,
        debito: e.valor,
        credito: 0,
        vencimento: e.status === "a_receber" ? e.vencimento : undefined,
      });
      post(rec, { data: e.data, historico: hist, documento: e.documento, debito: 0, credito: e.valor });
    } else {
      const cost = isPurchase(e) ? ACCOUNTS.compras : expenseAccount(e);
      const orig = e.status === "a_pagar" ? ACCOUNTS.fornecedores : cashAccount(e.formaPagamento);
      post(cost, { data: e.data, historico: hist, documento: e.documento, debito: e.valor, credito: 0 });
      post(orig, {
        data: e.data,
        historico: hist,
        documento: e.documento,
        debito: 0,
        credito: e.valor,
        vencimento: e.status === "a_pagar" ? e.vencimento : undefined,
      });
    }
  }

  return [...buckets.values()]
    .sort((a, b) => a.account.code.localeCompare(b.account.code))
    .map(({ account, lines }) => {
      const totalDebito = lines.reduce((s, l) => s + l.debito, 0);
      const totalCredito = lines.reduce((s, l) => s + l.credito, 0);
      const raw = totalDebito - totalCredito;
      const saldo = account.nature === "devedora" ? raw : -raw;
      return { account, lines, totalDebito, totalCredito, saldo };
    });
}

export function dre(entries: Entry[], year: number, month?: number): DreLine[] {
  const list = month == null ? yearEntries(entries, year) : monthEntries(entries, year, month);
  const receita = list.filter(isSale).reduce((s, e) => s + e.valor, 0);
  const compras = list.filter(isPurchase).reduce((s, e) => s + e.valor, 0);
  const despesas = list.filter((e) => e.kind === "despesa");
  const das = despesas.filter((e) => expenseAccount(e).code === ACCOUNTS.trib.code).reduce((s, e) => s + e.valor, 0);
  const contabil = despesas.filter((e) => expenseAccount(e).code === ACCOUNTS.contabil.code).reduce((s, e) => s + e.valor, 0);
  const admin = despesas.filter((e) => expenseAccount(e).code === ACCOUNTS.admin.code).reduce((s, e) => s + e.valor, 0);
  const outras = despesas.filter((e) => expenseAccount(e).code === ACCOUNTS.outras.code).reduce((s, e) => s + e.valor, 0);
  const despOp = das + contabil + admin + outras;
  const receitaLiq = receita;
  const lucroBruto = receitaLiq - compras;
  const resultado = lucroBruto - despOp;

  const periodo = month == null ? String(year) : `${MONTHS[month]}/${year}`;

  return [
    { label: `DRE — ${periodo}`, value: 0, muted: true },
    { label: "Receita bruta de vendas e serviços", value: receita },
    { label: "(−) Deduções da receita", value: 0, indent: 1 },
    { label: "Receita líquida", value: receitaLiq, bold: true },
    { label: "(−) Custo das mercadorias e insumos (compras)", value: compras, indent: 1 },
    { label: "Lucro bruto", value: lucroBruto, bold: true },
    { label: "(−) Despesas operacionais", value: despOp, indent: 1 },
    { label: "DAS / tributos", value: das, indent: 2, muted: true },
    { label: "Honorários contábeis", value: contabil, indent: 2, muted: true },
    { label: "Despesas administrativas", value: admin, indent: 2, muted: true },
    { label: "Outras despesas", value: outras, indent: 2, muted: true },
    { label: "Resultado do exercício (lucro ou prejuízo)", value: resultado, bold: true },
  ];
}
