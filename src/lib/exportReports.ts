import * as XLSX from "xlsx";
import type { CashMonthSummary, CashYearSummary } from "./cashflow";
import { MONTHS } from "./types";
import type { Entry } from "./types";
import { formatDate, formatMoney } from "./utils";

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCashflowExcel(cash: CashMonthSummary, filename: string) {
  const rows = cash.days.map((d) => ({
    Data: formatDate(d.date),
    Entradas: d.entradas,
    Saídas: d.saidas,
    "A receber": d.receber,
    "A pagar": d.pagar,
    Saldo: d.saldo,
  }));
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Fluxo");
  const out = XLSX.write(book, { bookType: "xlsx", type: "array" });
  downloadBlob(filename, new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
}

export function exportCashYearExcel(cash: CashYearSummary, filename: string) {
  const rows = cash.months.map((m) => ({
    Mês: MONTHS[m.month],
    Entradas: m.entradas,
    Saídas: m.saidas,
    Lucro: m.lucro,
    "A receber": m.aReceber,
    "A pagar": m.aPagar,
    "Saldo projetado": m.saldoProjetado,
  }));
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, `Fluxo ${cash.year}`);
  const out = XLSX.write(book, { bookType: "xlsx", type: "array" });
  downloadBlob(filename, new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
}

export function exportContasExcel(receber: Entry[], pagar: Entry[], filename: string) {
  const map = (e: Entry, tipo: string) => ({
    Tipo: tipo,
    "Data operação": formatDate(e.data),
    Vencimento: formatDate(e.vencimento || e.data),
    Contraparte: e.contraparte,
    Descrição: e.descricao,
    Valor: e.valor,
    Status: e.status,
    Pagamento: e.formaPagamento,
  });
  const rows = [...receber.map((e) => map(e, "A receber")), ...pagar.map((e) => map(e, "A pagar"))];
  const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Tipo: "—", Valor: 0 }]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Contas");
  const out = XLSX.write(book, { bookType: "xlsx", type: "array" });
  downloadBlob(filename, new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
}

export function contasPrintHint(receber: Entry[], pagar: Entry[]) {
  const totR = receber.reduce((a, e) => a + e.valor, 0);
  const totP = pagar.reduce((a, e) => a + e.valor, 0);
  return `A receber ${formatMoney(totR)} · A pagar ${formatMoney(totP)}`;
}
