import type { Company, CompanyType, Entry, RevenueKind } from "./types";

export const MEI_FATURAMENTO = 81_000;
export const MEI_COMPRAS_RATIO = 0.8;
export const MEI_EXCESSO_RATIO = 1.2;
export const IRPF_LIMITE = 33_888;

export const companyTypeLabel: Record<CompanyType, string> = {
  servicos: "Serviços",
  comercio: "Comércio",
  comercio_servicos: "Comércio / Serviços",
  industria: "Indústria",
  transporte_carga: "Transporte de cargas",
  transporte_passageiros: "Transporte de passageiros",
};

export const revenueKindLabel: Record<RevenueKind, string> = {
  comercio: "Comércio",
  industria: "Indústria",
  servico: "Serviço",
  transporte_carga: "Transp. carga",
  transporte_passageiros: "Transp. passageiros",
};

export function presumedProfitRate(kind: RevenueKind) {
  if (kind === "servico") return 0.32;
  if (kind === "transporte_passageiros") return 0.16;
  return 0.08;
}

export function isSale(entry: Entry) {
  return entry.kind === "venda";
}

export function isExpense(entry: Entry) {
  return entry.kind === "despesa" || entry.kind === "compra";
}

export function isPurchase(entry: Entry) {
  return entry.kind === "compra";
}

export function yearEntries(entries: Entry[], year: number) {
  return (entries ?? []).filter((e) => e.data.startsWith(String(year)));
}

export function monthEntries(entries: Entry[], year: number, month: number) {
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  return (entries ?? []).filter((e) => e.data.startsWith(prefix));
}

export function sum(values: number[]) {
  return values.reduce((acc, n) => acc + n, 0);
}

export function revenueByKind(entries: Entry[], kind: RevenueKind) {
  return sum(entries.filter((e) => isSale(e) && e.revenueKind === kind).map((e) => e.valor));
}

export function totalRevenue(entries: Entry[]) {
  return sum(entries.filter(isSale).map((e) => e.valor));
}

export function totalExpenses(entries: Entry[]) {
  return sum(entries.filter(isExpense).map((e) => e.valor));
}

export function totalPurchases(entries: Entry[]) {
  return sum(entries.filter(isPurchase).map((e) => e.valor));
}

export function netProfit(entries: Entry[]) {
  return totalRevenue(entries) - totalExpenses(entries);
}

export function limitStatus(used: number, limit: number) {
  const pct = limit <= 0 ? 0 : (used / limit) * 100;
  if (pct >= 100) return { pct, label: "ESTOUROU O LIMITE", tone: "danger" as const };
  if (pct >= 80) return { pct, label: "PERTO DO LIMITE", tone: "warn" as const };
  return { pct, label: "DENTRO DO LIMITE", tone: "ok" as const };
}

export function irpfSplit(entries: Entry[]) {
  const revenue = totalRevenue(entries);
  const lucro = netProfit(entries);
  const weightedExempt = entries
    .filter(isSale)
    .reduce((acc, e) => acc + e.valor * presumedProfitRate(e.revenueKind ?? "servico"), 0);
  const isento = Math.min(lucro, weightedExempt);
  const tributavel = Math.max(0, lucro - isento);
  return { revenue, lucro, isento, tributavel, precisaDeclarar: lucro > IRPF_LIMITE };
}

export function dasnSummary(entries: Entry[]) {
  const comercioIndustria =
    revenueByKind(entries, "comercio") +
    revenueByKind(entries, "industria") +
    revenueByKind(entries, "transporte_carga");
  const servicos =
    revenueByKind(entries, "servico") + revenueByKind(entries, "transporte_passageiros");
  return { comercioIndustria, servicos };
}

export function monthlySeries(entries: Entry[], year: number) {
  return Array.from({ length: 12 }, (_, month) => {
    const list = monthEntries(entries, year, month);
    const faturamento = totalRevenue(list);
    const despesas = totalExpenses(list);
    const compras = totalPurchases(list);
    return {
      month,
      comercio: revenueByKind(list, "comercio") + revenueByKind(list, "transporte_carga"),
      servico: revenueByKind(list, "servico"),
      passageiros: revenueByKind(list, "transporte_passageiros"),
      faturamento,
      despesas,
      compras,
      lucro: faturamento - despesas,
    };
  });
}

export function officialRevenueRows(entries: Entry[]) {
  const comercioSem = sum(
    entries.filter((e) => isSale(e) && e.revenueKind === "comercio" && !e.documentoFiscal).map((e) => e.valor),
  );
  const comercioCom = sum(
    entries.filter((e) => isSale(e) && e.revenueKind === "comercio" && e.documentoFiscal).map((e) => e.valor),
  );
  const industriaSem = sum(
    entries.filter((e) => isSale(e) && e.revenueKind === "industria" && !e.documentoFiscal).map((e) => e.valor),
  );
  const industriaCom = sum(
    entries.filter((e) => isSale(e) && e.revenueKind === "industria" && e.documentoFiscal).map((e) => e.valor),
  );
  const servicoSem = sum(
    entries
      .filter(
        (e) =>
          isSale(e) &&
          (e.revenueKind === "servico" || e.revenueKind === "transporte_passageiros") &&
          !e.documentoFiscal,
      )
      .map((e) => e.valor),
  );
  const servicoCom = sum(
    entries
      .filter(
        (e) =>
          isSale(e) &&
          (e.revenueKind === "servico" || e.revenueKind === "transporte_passageiros") &&
          e.documentoFiscal,
      )
      .map((e) => e.valor),
  );
  const iii = comercioSem + comercioCom;
  const vi = industriaSem + industriaCom;
  const ix = servicoSem + servicoCom;
  return {
    i: comercioSem,
    ii: comercioCom,
    iii,
    iv: industriaSem,
    v: industriaCom,
    vi,
    vii: servicoSem,
    viii: servicoCom,
    ix,
    x: iii + vi + ix,
  };
}

export function companyLimit(company: Company) {
  return company.limiteFaturamento || MEI_FATURAMENTO;
}

export function purchaseLimit(company: Company, year: number = new Date().getFullYear()) {
  return proportionalLimit(company, year) * MEI_COMPRAS_RATIO;
}

export function monthsActiveInYear(company: Company, year: number) {
  const opened = company?.dataAbertura || "";
  const y = Number(opened.slice(0, 4));
  const m = Number(opened.slice(5, 7));
  if (!y || !m) return 12;
  if (y < year) return 12;
  if (y > year) return 0;
  return 13 - m;
}

export function proportionalLimit(company: Company, year: number) {
  const annual = companyLimit(company);
  const months = monthsActiveInYear(company, year);
  return (annual / 12) * months;
}

export function monthlyCeiling(company: Company) {
  return companyLimit(company) / 12;
}

/** Teto linear do mês (0 antes da data de abertura). `month` é 0–11. */
export function monthlyCeilingForMonth(company: Company, year: number, month: number) {
  const opened = company?.dataAbertura || "";
  const y = Number(opened.slice(0, 4));
  const m = Number(opened.slice(5, 7));
  if (!y || !m) return monthlyCeiling(company);
  if (y > year) return 0;
  if (y < year) return monthlyCeiling(company);
  // Abertura no mês m (1–12): meses anteriores (índice < m-1) = 0
  if (month < m - 1) return 0;
  return monthlyCeiling(company);
}

export function excessBand(used: number, limit: number) {
  const over = used - limit;
  if (over <= 0) return { band: "ok" as const, over: 0, tetoExcesso: limit * MEI_EXCESSO_RATIO };
  if (used <= limit * MEI_EXCESSO_RATIO) {
    return { band: "sublimite" as const, over, tetoExcesso: limit * MEI_EXCESSO_RATIO };
  }
  return { band: "desenquadramento" as const, over, tetoExcesso: limit * MEI_EXCESSO_RATIO };
}

export function monthsElapsedInYear(year: number, now = new Date()) {
  if (now.getFullYear() > year) return 12;
  if (now.getFullYear() < year) return 0;
  return now.getMonth() + 1;
}

export function forecastRevenue(billed: number, year: number, monthsOpen: number, now = new Date()) {
  const elapsed = Math.max(1, Math.min(monthsOpen, monthsElapsedInYear(year, now)));
  const pace = billed / elapsed;
  return { pace, forecast: pace * monthsOpen, elapsed };
}

export const GOV_LINKS = {
  das: "https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgmei.app/Identificacao",
  dasn: "https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/dasnsimei.app/Identificacao",
  nfse: "https://www.nfse.gov.br/EmissorNacional",
  inss: "https://www.gov.br/inss/pt-br",
  cpf: "https://servicos.receita.fazenda.gov.br/servicos/cpf/consultasituacao/consultapublica.asp",
  parcelamento: "https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgmei.app/Identificacao",
  esocialFolha:
    "https://www.gov.br/pt-br/servicos/elaborar-folha-de-pagamento-no-esocial-simplificado-pessoa-juridica-mei",
  esocialAdmissao: "https://www.gov.br/pt-br/servicos/admitir-empregado-no-esocial-simplificado-pessoa-juridica-mei",
};
