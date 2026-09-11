import type { Company, CompanyType, DasPerfil, Entry } from "./types";
import { isoDate, todayIso } from "./utils";

export const SALARIO_MINIMO = 1_621;

/** Salário mínimo nacional vigente na competência (mês 0–11). Fonte: decretos/MPs do governo federal. */
const SALARIO_MINIMO_VIGENCIA = [
  { year: 2019, month: 0, value: 998 },
  { year: 2020, month: 0, value: 1039 },
  { year: 2020, month: 1, value: 1045 },
  { year: 2021, month: 0, value: 1100 },
  { year: 2022, month: 0, value: 1212 },
  { year: 2023, month: 0, value: 1302 },
  { year: 2023, month: 4, value: 1320 },
  { year: 2024, month: 0, value: 1412 },
  { year: 2025, month: 0, value: 1518 },
  { year: 2026, month: 0, value: 1621 },
];

export function salarioMinimo(year: number, month = 0) {
  let value = SALARIO_MINIMO_VIGENCIA[0]?.value ?? SALARIO_MINIMO;
  for (const item of SALARIO_MINIMO_VIGENCIA) {
    if (item.year < year || (item.year === year && item.month <= month)) value = item.value;
    else break;
  }
  return value;
}
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

export function dasBreakdown(perfil: DasPerfil, year?: number, month = 0) {
  const minimo = year == null ? SALARIO_MINIMO : salarioMinimo(year, month);
  const caminhoneiro = perfil === "caminhoneiro" || perfil === "caminhoneiro_servicos";
  const inss = round2(minimo * (caminhoneiro ? INSS_CAMINHONEIRO : INSS_MEI));
  const icms =
    perfil === "comercio" || perfil === "misto" || perfil === "caminhoneiro" || perfil === "caminhoneiro_servicos"
      ? ICMS_MEI
      : 0;
  const iss = perfil === "servicos" || perfil === "misto" || perfil === "caminhoneiro_servicos" ? ISS_MEI : 0;
  return { inss, icms, iss, total: round2(inss + icms + iss), salarioMinimo: minimo };
}

/** Domingo de Páscoa (algoritmo gregoriano). */
function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/** Feriados nacionais (Lei 662/1949 e alterações; Consciência Negra a partir de 2024). */
export function isNationalHoliday(date: Date) {
  const y = date.getFullYear();
  const md = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const fixed = new Set(["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "12-25"]);
  if (y >= 2024) fixed.add("11-20");
  if (fixed.has(md)) return true;
  const goodFriday = easterSunday(y);
  goodFriday.setDate(goodFriday.getDate() - 2);
  return isoDate(date) === isoDate(goodFriday);
}

function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** Próximo dia útil (pula sábado, domingo e feriado nacional). */
export function nextBusinessDay(date: Date) {
  const cur = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  while (isWeekend(cur) || isNationalHoliday(cur)) {
    cur.setDate(cur.getDate() + 1);
  }
  return cur;
}

/**
 * Vencimento do DAS da competência `month` (0–11): dia 20 do mês seguinte.
 * Se cair em sábado, domingo ou feriado nacional, vai para o próximo dia útil.
 */
export function dasDueDate(year: number, month: number) {
  return isoDate(nextBusinessDay(new Date(year, month + 1, 20)));
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
