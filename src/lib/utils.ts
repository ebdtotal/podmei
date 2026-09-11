export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function parseMoney(raw: string) {
  const cleaned = raw.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Máscara de digitação centavo a centavo → "R$ 1.234,56". */
export function maskMoneyBr(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 15);
  const cents = Number(digits || "0");
  return formatMoney(cents / 100);
}

/** Converte texto "R$ 1.234,56" (ou dígitos) em número. */
export function parseMoneyBr(raw: string) {
  if (!raw || !String(raw).trim()) return 0;
  return parseMoney(String(raw));
}

export function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Converte dd/mm/aaaa (ou dígitos) em ISO yyyy-mm-dd; inválida → "". */
export function parseDateBr(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 8) return "";
  const d = Number(digits.slice(0, 2));
  const m = Number(digits.slice(2, 4));
  const y = Number(digits.slice(4, 8));
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return "";
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return "";
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Máscara de digitação dd/mm/aaaa a partir de dígitos. */
export function maskDateBr(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function yearOf(iso: string) {
  return Number(iso.slice(0, 4));
}

export function monthIndex(iso: string) {
  return Number(iso.slice(5, 7)) - 1;
}

export function todayIso() {
  return isoDate(new Date());
}

/** Soma dias a uma data ISO (YYYY-MM-DD), meio-dia local para evitar fuso. */
export function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

/** Próxima (ou mesma) ocorrência do dia do mês a partir de `fromIso`. */
export function dueOnDayFrom(fromIso: string, dayOfMonth: number) {
  const base = fromIso.slice(0, 10);
  const d = new Date(`${base}T12:00:00`);
  let y = d.getFullYear();
  let m = d.getMonth();
  const day = Math.max(1, Math.min(31, Math.floor(dayOfMonth) || 1));
  const build = (year: number, month: number) => {
    const last = new Date(year, month + 1, 0).getDate();
    return isoDate(new Date(year, month, Math.min(day, last)));
  };
  let cand = build(y, m);
  if (cand < base) {
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
    cand = build(y, m);
  }
  return cand;
}

/** Soma meses mantendo o dia do mês (ajusta para o último dia se não existir). */
export function addMonthsOnDay(iso: string, months: number, dayOfMonth: number) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  const y = d.getFullYear();
  const m = d.getMonth() + months;
  const day = Math.max(1, Math.min(31, Math.floor(dayOfMonth) || 1));
  const last = new Date(y, m + 1, 0).getDate();
  return isoDate(new Date(y, m, Math.min(day, last)));
}

export function currentYear() {
  return new Date().getFullYear();
}
