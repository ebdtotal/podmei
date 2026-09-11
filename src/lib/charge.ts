import { pixCopiaECola } from "./pix";
import type { Company, Contact, Entry, PixTipo } from "./types";
import { formatDate, formatMoney } from "./utils";

export const pixTipoLabel: Record<PixTipo, string> = {
  cnpj: "CNPJ",
  cpf: "CPF",
  telefone: "Telefone",
  email: "E-mail",
  copia_e_cola: "Copia e cola",
};

export function inferPixTipo(raw: string): PixTipo {
  const value = raw.trim();
  if (!value) return "cnpj";
  if (value.startsWith("000201") || value.length > 40) return "copia_e_cola";
  if (value.includes("@")) return "email";
  const digits = value.replace(/\D/g, "");
  if (value.startsWith("+") || (digits.length >= 10 && digits.length <= 13)) return "telefone";
  if (digits.length === 14) return "cnpj";
  if (digits.length === 11) return "cpf";
  return "copia_e_cola";
}

export function resolvePixTipo(company: Company): PixTipo {
  return company.pixTipo || inferPixTipo(company.pixChave || "");
}

/** Chave exatamente como o cliente deve colar. CNPJ/CPF ficam só com números. */
export function normalizePixKey(tipo: PixTipo, raw: string) {
  const value = raw.trim();
  if (!value) return "";
  if (tipo === "cnpj" || tipo === "cpf") return value.replace(/\D/g, "");
  if (tipo === "telefone") return formatPixPhone(value);
  if (tipo === "email") return value.toLowerCase();
  return value;
}

export function pixKeyForCompany(company: Company) {
  return normalizePixKey(resolvePixTipo(company), company.pixChave || "");
}

function formatPixPhone(raw: string) {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) digits = digits.slice(2);
  if (digits.length === 11) return `${digits.slice(0, 2)} ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 2)} ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return digits;
}

export function pixPayloadForEntry(company: Company, entry: Entry) {
  const tipo = resolvePixTipo(company);
  const key = pixKeyForCompany(company);
  if (!key) return "";
  if (tipo === "copia_e_cola") return key;
  const pixKey = tipo === "telefone" ? `+55${key.replace(/\D/g, "")}` : key;
  return pixCopiaECola({
    key: pixKey,
    name: company.nome || "PODMEI",
    city: company.cidade || "SAO PAULO",
    amount: entry.valor,
    txid: entry.id.replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "PODMEI",
  });
}

export function chargePhone(entry: Entry, contacts: Contact[] | undefined) {
  const linked = entry.contactId ? contacts?.find((c) => c.id === entry.contactId) : undefined;
  const byName = contacts?.find(
    (c) => c.kind === "cliente" && c.nome.trim().toLowerCase() === entry.contraparte.trim().toLowerCase(),
  );
  return (linked?.telefone || byName?.telefone || "").trim();
}

export function whatsappHref(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  const withCountry = digits.length >= 12 ? digits : digits.length >= 10 ? `55${digits}` : "";
  const q = encodeURIComponent(text);
  return withCountry ? `https://wa.me/${withCountry}?text=${q}` : `https://wa.me/?text=${q}`;
}

export function chargeMessage(company: Company, entry: Entry) {
  const due = entry.vencimento || entry.data;
  const tipo = resolvePixTipo(company);
  const key = pixKeyForCompany(company);
  const lines = [
    `Olá${entry.contraparte ? `, ${entry.contraparte}` : ""}!`,
    "",
    `Cobrança de ${company.nome || "PODMEI"}${company.cnpj ? ` (CNPJ ${company.cnpj})` : ""}.`,
    entry.descricao ? entry.descricao : "Serviço / venda",
    `Valor: ${formatMoney(entry.valor)}`,
    `Vencimento: ${formatDate(due)}`,
  ];
  if (key) {
    lines.push("", tipo === "copia_e_cola" ? "Pix copia e cola:" : "Chave Pix:", key);
  }
  return lines.join("\n");
}
