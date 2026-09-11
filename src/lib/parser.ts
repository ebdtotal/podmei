import type { Contact, DiscountKind, Entry, EntryKind, PaymentMethod, PaymentStatus, RevenueKind } from "./types";
import { calcEntryTotal } from "./entryPricing";
import { addDaysIso, parseMoney, todayIso, uid } from "./utils";

export type PagamentoModo = "avista" | "parcelado";

export interface ParsedDraft {
  kind: EntryKind;
  revenueKind?: RevenueKind;
  valor: number;
  contraparte: string;
  descricao: string;
  documentoFiscal: boolean;
  formaPagamento: PaymentMethod;
  status: PaymentStatus;
  documento: string;
  data: string;
  vencimento?: string;
  contactId?: string;
  productId?: string;
  quantidade?: number;
  precoUnitario?: number;
  descontoTipo?: DiscountKind;
  descontoValor?: number;
  /** À vista (padrão) ou parcelado (gera vários lançamentos). */
  pagamentoModo?: PagamentoModo;
  /** Quantidade de parcelas do saldo (após a entrada). */
  numParcelas?: number;
  /** Valor pago na entrada (liquidado na data da operação). */
  valorEntrada?: number;
  confidence: string;
}

function has(text: string, ...words: string[]) {
  return words.some((w) => text.includes(w));
}

function parseDueDate(raw: string): string | undefined {
  const m = raw.match(
    /(?:vence|vencimento|prazo)(?:\s*(?:em|para|:))?\s*(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?/i,
  );
  if (!m) return undefined;
  const day = m[1].padStart(2, "0");
  const month = m[2].padStart(2, "0");
  let year = m[3];
  if (!year) year = String(new Date().getFullYear());
  else if (year.length === 2) year = `20${year}`;
  return `${year}-${month}-${day}`;
}

export function parseLancamento(raw: string): ParsedDraft | null {
  const text = raw.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const valorMatch = raw.match(/r\$\s*[\d.]+,\d{2}|r\$\s*[\d.]+|\b\d{1,3}(?:\.\d{3})*,\d{2}\b|\b\d+[.,]\d{2}\b|\b\d{2,}\b/i);
  if (!valorMatch) return null;
  const valor = parseMoney(valorMatch[0]);
  if (valor <= 0) return null;

  const isCompra = has(text, "compra", "comprei", "fornecedor", "mercadoria");
  const isDespesa = has(text, "despesa", "paguei", "pagar", "das", "inss", "contabil", "aluguel", "imposto");
  const isVenda = has(text, "venda", "vendi", "recebi", "faturei", "servico", "cliente", "recibo");

  let kind: EntryKind = "venda";
  if (isCompra && !isVenda) kind = "compra";
  else if (isDespesa && !isVenda) kind = "despesa";
  else if (isCompra) kind = "compra";
  else if (isDespesa) kind = "despesa";

  let revenueKind: RevenueKind | undefined;
  if (kind === "venda") {
    if (has(text, "industria", "fabric", "industrializado")) revenueKind = "industria";
    else if (has(text, "passageiro")) revenueKind = "transporte_passageiros";
    else if (has(text, "carga", "frete")) revenueKind = "transporte_carga";
    else if (has(text, "comercio", "mercadoria", "produto")) revenueKind = "comercio";
    else revenueKind = "servico";
  }

  const documentoFiscal = has(text, "nfe", "nf-e", "nota fiscal", "com nota", "com nf");
  let formaPagamento: PaymentMethod = "pix";
  if (has(text, "dinheiro")) formaPagamento = "dinheiro";
  else if (has(text, "debito")) formaPagamento = "debito";
  else if (has(text, "credito", "cartao")) formaPagamento = "credito";
  else if (has(text, "boleto")) formaPagamento = "boleto";
  else if (has(text, "ted", "transferencia")) formaPagamento = "transferencia";

  const pending = has(text, "a receber", "a pagar", "pendente", "aberto", "prazo", "vence");
  let status: PaymentStatus = "liquidado";
  if (pending) status = kind === "venda" ? "a_receber" : "a_pagar";

  const nameMatch = raw.match(/(?:cliente|fornecedor|de|para)\s+([A-Za-zÀ-ÿ0-9 .&-]{3,40})/i);
  const contraparte = nameMatch?.[1]?.trim() ?? (kind === "venda" ? "Cliente" : "Fornecedor");
  const data = todayIso();
  const vencimento = parseDueDate(raw);

  return {
    kind,
    revenueKind,
    valor,
    contraparte,
    descricao: raw.trim().slice(0, 120),
    documentoFiscal,
    formaPagamento,
    status,
    documento: kind === "venda" ? (documentoFiscal ? "NF-e" : "RECIBO") : "COMPROVANTE",
    data,
    vencimento: status === "liquidado" ? undefined : vencimento || data,
    confidence: "Interpretado do texto. Confirme antes de salvar.",
  };
}

function draftPricing(draft: ParsedDraft) {
  const qty = draft.quantidade && draft.quantidade > 0 ? draft.quantidade : 1;
  const unit = draft.precoUnitario != null ? draft.precoUnitario : draft.valor;
  const { liquido } = calcEntryTotal({
    quantidade: qty,
    precoUnitario: unit,
    descontoTipo: draft.descontoTipo,
    descontoValor: draft.descontoValor,
    valor: draft.valor,
  });
  return { qty, unit, liquido };
}

/** Divide centavos: primeiras parcelas arredondadas; a última absorve o residual. */
export function splitEqualCents(total: number, parts: number): number[] {
  const n = Math.max(1, Math.floor(parts));
  const cents = Math.round(Math.max(0, total) * 100);
  const base = Math.floor(cents / n);
  const rem = cents - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < rem ? 1 : 0)) / 100);
}

export function draftToEntry(draft: ParsedDraft, source: Entry["source"], valorOverride?: number): Entry {
  const pending = draft.status === "a_receber" || draft.status === "a_pagar";
  const { qty, unit, liquido } = draftPricing(draft);
  const valor = valorOverride != null ? valorOverride : liquido;
  return {
    id: uid("lan"),
    data: draft.data,
    contraparte: draft.contraparte,
    documento: draft.documento,
    kind: draft.kind,
    revenueKind: draft.revenueKind,
    valor,
    descricao: draft.descricao,
    status: draft.status,
    documentoFiscal: draft.documentoFiscal,
    formaPagamento: draft.formaPagamento,
    source,
    vencimento: pending ? draft.vencimento || draft.data : draft.vencimento,
    contactId: draft.contactId,
    productId: draft.productId,
    quantidade: qty,
    precoUnitario: unit,
    descontoTipo: draft.descontoTipo ?? "reais",
    descontoValor: draft.descontoValor ?? 0,
  };
}

/**
 * À vista → 1 lançamento.
 * Parcelado → entrada liquidada (se > 0) + N contas a receber/pagar iguais a cada 30 dias.
 */
export function draftToEntries(draft: ParsedDraft, source: Entry["source"]): Entry[] {
  if (draft.pagamentoModo !== "parcelado") {
    return [draftToEntry(draft, source)];
  }

  const { liquido } = draftPricing(draft);
  const n = Math.max(1, Math.floor(draft.numParcelas || 1));
  const entrada = Math.max(0, Math.min(draft.valorEntrada || 0, liquido));
  const saldo = Math.round((liquido - entrada) * 100) / 100;
  const pendingStatus: PaymentStatus = draft.kind === "venda" ? "a_receber" : "a_pagar";
  const firstDue = draft.vencimento || draft.data;
  const baseDesc = (draft.descricao || "").trim();
  const out: Entry[] = [];

  if (entrada > 0) {
    out.push({
      ...draftToEntry(
        {
          ...draft,
          status: "liquidado",
          vencimento: undefined,
          descricao: baseDesc ? `${baseDesc} · entrada` : "Entrada",
        },
        source,
        entrada,
      ),
      quantidade: 1,
      precoUnitario: entrada,
      descontoTipo: "reais",
      descontoValor: 0,
    });
  }

  if (saldo <= 0) return out.length ? out : [draftToEntry(draft, source)];

  const parts = splitEqualCents(saldo, n);
  parts.forEach((valor, i) => {
    const vencimento = addDaysIso(firstDue, i * 30);
    out.push({
      ...draftToEntry(
        {
          ...draft,
          status: pendingStatus,
          vencimento,
          descricao: baseDesc
            ? `${baseDesc} · parcela ${i + 1}/${n}`
            : `Parcela ${i + 1}/${n}`,
          documento: draft.documento ? `${draft.documento} ${i + 1}/${n}` : `${i + 1}/${n}`,
        },
        source,
        valor,
      ),
      quantidade: 1,
      precoUnitario: valor,
      descontoTipo: "reais",
      descontoValor: 0,
    });
  });

  return out;
}

export function entryToDraft(entry: Entry): ParsedDraft {
  return {
    kind: entry.kind,
    revenueKind: entry.revenueKind,
    valor: entry.valor,
    contraparte: entry.contraparte,
    descricao: entry.descricao,
    documentoFiscal: entry.documentoFiscal,
    formaPagamento: entry.formaPagamento,
    status: entry.status,
    documento: entry.documento,
    data: entry.data,
    vencimento: entry.vencimento,
    contactId: entry.contactId,
    productId: entry.productId,
    quantidade: entry.quantidade ?? 1,
    precoUnitario: entry.precoUnitario ?? entry.valor,
    descontoTipo: entry.descontoTipo ?? "reais",
    descontoValor: entry.descontoValor ?? 0,
    confidence: "",
  };
}

export function matchContact(nome: string, contacts: Contact[]): Contact | undefined {
  const key = nome.trim().toLowerCase();
  if (!key) return undefined;
  return contacts.find((c) => c.nome.toLowerCase() === key);
}
