import type { Company, CompanyType, DasPerfil, Entry } from "./types";
import { isoDate, todayIso } from "./utils";

export const SALARIO_MINIMO = 1_621;
export const INSS_MEI = 0.05;
export const INSS_CAMINHONEIRO = 0.12;
export const ICMS_MEI = 1;
export const ISS_MEI = 5;

export const dasPerfilLabel: Record<DasPerfil, string> = {
  comercio: "Comércio / indústria (ICMS)",
  servicos: "Serviços (ISS)",
  misto: "Comércio e serviços (ICMS + ISS)",
  caminhoneiro: "Transportador de cargas (INSS 12% + ICMS)",
  caminhoneiro_servicos: "Caminhoneiro com serviços (INSS 12% + ICMS + ISS)",
};

export function dasPerfilFromTipo(tipo: CompanyType): DasPerfil {
  if (tipo === "transporte_carga") return "caminhoneiro";
  if (tipo === "servicos" || tipo === "transporte_passageiros") return "servicos";
  if (tipo === "comercio_servicos") return "misto";
  return "comercio";
}

export function resolveDasPerfil(company: Company): DasPerfil {
  return company.dasPerfil ?? dasPerfilFromTipo(company.tipo);
}

export function dasBreakdown(perfil: DasPerfil) {
  const caminhoneiro = perfil === "caminhoneiro" || perfil === "caminhoneiro_servicos";
  const inss = round2(SALARIO_MINIMO * (caminhoneiro ? INSS_CAMINHONEIRO : INSS_MEI));
  const icms =
    perfil === "comercio" || perfil === "misto" || perfil === "caminhoneiro" || perfil === "caminhoneiro_servicos"
      ? ICMS_MEI
      : 0;
  const iss = perfil === "servicos" || perfil === "misto" || perfil === "caminhoneiro_servicos" ? ISS_MEI : 0;
  return { inss, icms, iss, total: round2(inss + icms + iss) };
}

export function dasDueDate(year: number, month: number) {
  return isoDate(new Date(year, month + 1, 20));
}

export function competenceFromDueDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  d.setMonth(d.getMonth() - 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function isDasEntry(entry: Entry) {
  const blob = `${entry.descricao} ${entry.documento} ${entry.contraparte}`.toLowerCase();
  return entry.kind === "despesa" && /\bdas\b|simei|guia mei/.test(blob);
}

export function parseDasCompetence(entry: Entry): { year: number; month: number } | null {
  const blob = `${entry.documento} ${entry.descricao}`;
  const m = blob.match(/(\d{1,2})\s*[\/.-]\s*(\d{4})/);
  if (m) {
    const month = Number(m[1]) - 1;
    const year = Number(m[2]);
    if (month >= 0 && month < 12 && year > 2000) return { year, month };
  }
  return competenceFromDueDate(entry.data);
}

export function dasCompetenceKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function dasPaidMap(entries: Entry[]) {
  const map = new Map<string, Entry>();
  for (const entry of entries) {
    if (!isDasEntry(entry)) continue;
    const c = parseDasCompetence(entry);
    if (!c) continue;
    map.set(dasCompetenceKey(c.year, c.month), entry);
  }
  return map;
}

export function dasLateCount(entries: Entry[], year: number, today = todayIso()) {
  const paid = dasPaidMap(entries);
  let n = 0;
  for (let month = 0; month < 12; month++) {
    const due = dasDueDate(year, month);
    if (due < today && !paid.has(dasCompetenceKey(year, month))) n += 1;
  }
  return n;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
