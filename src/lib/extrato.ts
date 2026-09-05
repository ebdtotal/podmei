import type { Entry, EntryKind, PaymentMethod, RevenueKind } from "./types";
import { parseMoney, uid } from "./utils";

export interface BankDraft {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  direcao: "entrada" | "saida";
  kind: EntryKind;
  revenueKind?: RevenueKind;
  contraparte: string;
  formaPagamento: PaymentMethod;
  selected: boolean;
  duplicate: boolean;
  raw: string;
}

const SKIP =
  /saldo\s+(anterior|atual|do dia|final|disponivel)|total\s+(creditos|debitos)|extrato|ag[eê]ncia|conta\s+corrente|p[aá]gina\s+\d/i;

const DATE_RE = /(\d{2})[\/.-](\d{2})(?:[\/.-](\d{2,4}))?/;
const MONEY_RE = /-?(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}|-?(?:R\$\s*)?\d+,\d{2}/g;

function toIso(d: string, m: string, y: string | undefined, fallbackYear: number) {
  let year = y ? Number(y.length === 2 ? `20${y}` : y) : fallbackYear;
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (!y) {
    const now = new Date();
    if (now.getFullYear() === fallbackYear && month > now.getMonth() + 1) year = fallbackYear - 1;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function paymentFrom(text: string): PaymentMethod {
  const t = text.toLowerCase();
  if (t.includes("pix")) return "pix";
  if (/\bted\b|\bdoc\b|transfer/.test(t)) return "transferencia";
  if (t.includes("boleto")) return "boleto";
  if (t.includes("crédito") || t.includes("credito") || t.includes("cartao") || t.includes("cartão")) return "credito";
  if (t.includes("débito") || t.includes("debito")) return "debito";
  if (t.includes("dinheiro") || t.includes("saque")) return "dinheiro";
  return "transferencia";
}

function partyFrom(text: string) {
  const cleaned = text
    .replace(DATE_RE, " ")
    .replace(MONEY_RE, " ")
    .replace(/\b(pix|ted|doc|cpmf|tarifa|compra|debito|crédito|credito|boleto)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 48) || "Extrato bancário";
}

function classify(descricao: string, direcao: "entrada" | "saida"): { kind: EntryKind; revenueKind?: RevenueKind } {
  const t = descricao.toLowerCase();
  if (direcao === "entrada") {
    let revenueKind: RevenueKind = "servico";
    if (/comercio|mercadoria|produto|venda/.test(t)) revenueKind = "comercio";
    else if (/frete|carga/.test(t)) revenueKind = "transporte_carga";
    return { kind: "venda", revenueKind };
  }
  if (/compra|fornecedor|mercadoria|insumo|estoque/.test(t)) return { kind: "compra" };
  return { kind: "despesa" };
}

function parseSignedMoney(raw: string) {
  const neg = raw.trim().startsWith("-") || /\(\s*[\d.,]+\s*\)/.test(raw);
  const valor = Math.abs(parseMoney(raw));
  return { valor, neg };
}

function detectDirecao(line: string, valorNeg: boolean): "entrada" | "saida" | null {
  const t = line.toLowerCase();
  if (/\b\d+[.,]\d{2}\s*[cd]\b/.test(t) || /\s[cd]\s*$/.test(t.trim())) {
    const m = t.trim().match(/([cd])\s*$/);
    if (m?.[1] === "c") return "entrada";
    if (m?.[1] === "d") return "saida";
  }
  if (/\bcredito\b|\bcrédito\b|\bc\b/.test(t) && /pix recebid|ted recebid|dep[oó]sito|rendimento/.test(t)) {
    return "entrada";
  }
  if (/pix enviad|ted enviad|tarifa|compra|pagamento|boleto|d[eé]bito|saque/.test(t)) return "saida";
  if (/pix recebid|ted recebid|dep[oó]sito|rendimento|estorno/.test(t)) return "entrada";
  if (valorNeg) return "saida";
  return null;
}

export function parseStatementLines(text: string, fallbackYear: number): BankDraft[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const drafts: BankDraft[] = [];

  for (const line of lines) {
    if (SKIP.test(line) || line.length < 8) continue;
    const dateMatch = line.match(DATE_RE);
    if (!dateMatch) continue;
    const data = toIso(dateMatch[1], dateMatch[2], dateMatch[3], fallbackYear);
    if (!data) continue;
    const moneys = line.match(MONEY_RE) ?? [];
    if (moneys.length === 0) continue;
    const movement = moneys.length >= 2 ? moneys[moneys.length - 2] : moneys[0];
    if (!movement) continue;
    const { valor, neg } = parseSignedMoney(movement);
    if (valor <= 0) continue;
    const guessed = detectDirecao(line, neg);
    const direcao = guessed ?? (neg ? "saida" : "entrada");
    const descricao = line.replace(DATE_RE, "").replace(MONEY_RE, "").replace(/\b[CD]\b/g, "").trim().slice(0, 160);
    const { kind, revenueKind } = classify(descricao, direcao);
    drafts.push({
      id: uid("ext"),
      data,
      descricao: descricao || (direcao === "entrada" ? "Receita do extrato" : "Despesa do extrato"),
      valor,
      direcao,
      kind,
      revenueKind,
      contraparte: partyFrom(descricao),
      formaPagamento: paymentFrom(line),
      selected: true,
      duplicate: false,
      raw: line,
    });
  }

  return drafts;
}

function headerIndex(headers: string[], ...aliases: string[]) {
  return headers.findIndex((h) => aliases.some((a) => h === a || (a.length > 2 && h.includes(a))));
}

function cellMoney(value: unknown) {
  if (typeof value === "number") return { valor: Math.abs(value), neg: value < 0 };
  const raw = String(value ?? "").trim();
  if (!raw) return { valor: 0, neg: false };
  return parseSignedMoney(raw);
}

function excelDate(value: unknown, fallbackYear: number): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "number" && value > 20000 && value < 80000) {
    const utc = new Date(Math.round((value - 25569) * 86400 * 1000));
    const y = utc.getUTCFullYear();
    const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
    const d = String(utc.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const raw = String(value ?? "").trim();
  const m = raw.match(DATE_RE);
  if (!m) return null;
  return toIso(m[1], m[2], m[3], fallbackYear);
}

export function parseExcelMatrix(rows: unknown[][], fallbackYear: number): BankDraft[] {
  if (rows.length === 0) return [];
  let headerAt = 0;
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const joined = rows[i].map((c) => String(c ?? "").toLowerCase()).join(" ");
    if (/data|historico|histórico|valor|d[eé]bito|cr[eé]dito/.test(joined)) {
      headerAt = i;
      break;
    }
  }
  const headers = rows[headerAt].map((c) =>
    String(c ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, ""),
  );
  const iData = headerIndex(headers, "data", "dt lanc", "dt_lanc", "date");
  const iHist = headerIndex(headers, "historico", "descricao", "historico", "lancamento", "memo", "detalhe");
  const iValor = headerIndex(headers, "valor", "montante", "amount");
  const iDeb = headerIndex(headers, "debito", "saida", "d");
  const iCred = headerIndex(headers, "credito", "entrada", "c");
  const iTipo = headerIndex(headers, "tipo", "natureza", "dc", "c/d");

  const drafts: BankDraft[] = [];
  for (let r = headerAt + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => c == null || String(c).trim() === "")) continue;
    const data = excelDate(iData >= 0 ? row[iData] : row[0], fallbackYear);
    if (!data) continue;
    const descricao = String((iHist >= 0 ? row[iHist] : row[1]) ?? "").trim();
    if (SKIP.test(descricao)) continue;

    let valor = 0;
    let direcao: "entrada" | "saida" = "saida";
    if (iDeb >= 0 || iCred >= 0) {
      const deb = cellMoney(row[iDeb]);
      const cred = cellMoney(row[iCred]);
      if (cred.valor > 0) {
        valor = cred.valor;
        direcao = "entrada";
      } else if (deb.valor > 0) {
        valor = deb.valor;
        direcao = "saida";
      }
    } else {
      const raw = row[iValor >= 0 ? iValor : 2];
      const parsed = cellMoney(raw);
      valor = parsed.valor;
      const tipo = String(row[iTipo] ?? "").toLowerCase();
      if (tipo.startsWith("c") || tipo.includes("entrada") || tipo.includes("credito")) direcao = "entrada";
      else if (tipo.startsWith("d") || tipo.includes("saida") || tipo.includes("debito")) direcao = "saida";
      else direcao = parsed.neg ? "saida" : detectDirecao(`${descricao} ${String(raw ?? "")}`, parsed.neg) ?? "entrada";
    }
    if (valor <= 0) continue;
    const { kind, revenueKind } = classify(descricao, direcao);
    drafts.push({
      id: uid("ext"),
      data,
      descricao: descricao || (direcao === "entrada" ? "Receita do extrato" : "Despesa do extrato"),
      valor,
      direcao,
      kind,
      revenueKind,
      contraparte: partyFrom(descricao),
      formaPagamento: paymentFrom(descricao),
      selected: true,
      duplicate: false,
      raw: row.map((c) => String(c ?? "")).join(" | "),
    });
  }
  return drafts;
}

export function markDuplicates(drafts: BankDraft[], entries: Entry[]): BankDraft[] {
  return drafts.map((d) => {
    const duplicate = entries.some(
      (e) => e.data === d.data && Math.abs(e.valor - d.valor) < 0.009 && (d.kind === "venda" ? e.kind === "venda" : e.kind !== "venda"),
    );
    return { ...d, duplicate, selected: duplicate ? false : d.selected };
  });
}

export function draftToBankEntry(draft: BankDraft): Entry {
  return {
    id: uid("lan"),
    data: draft.data,
    contraparte: draft.contraparte,
    documento: "EXTRATO",
    kind: draft.kind,
    revenueKind: draft.kind === "venda" ? (draft.revenueKind ?? "servico") : undefined,
    valor: draft.valor,
    descricao: draft.descricao,
    status: "liquidado",
    documentoFiscal: false,
    formaPagamento: draft.formaPagamento,
    source: "extrato",
    observacao: draft.raw.slice(0, 180),
  };
}

export async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const buckets = new Map<number, { x: number; str: string }[]>();
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5] / 3) * 3;
      const list = buckets.get(y) ?? [];
      list.push({ x: item.transform[4], str: item.str });
      buckets.set(y, list);
    }
    pages.push(
      [...buckets.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, parts]) =>
          parts
            .sort((a, b) => a.x - b.x)
            .map((p) => p.str)
            .join(" "),
        )
        .join("\n"),
    );
  }
  return pages.join("\n");
}

export async function parseSpreadsheet(data: ArrayBuffer, fallbackYear: number): Promise<BankDraft[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(data, { type: "array", cellDates: true });
  const name = wb.SheetNames[0];
  if (!name) return [];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: "" }) as unknown[][];
  return parseExcelMatrix(rows, fallbackYear);
}

export const EXTRATO_MODELO_CSV = `Data,Historico,Valor,Tipo
01/09/2026,PIX recebido Cliente Ana Silva,1500.00,C
02/09/2026,Tarifa bancaria,12.90,D
05/09/2026,PIX enviado Fornecedor Papelaria,92.05,D
10/09/2026,TED recebida Clinica Solar,1800.00,C
`;
