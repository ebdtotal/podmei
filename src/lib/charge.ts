import { pixCopiaECola } from "./pix";
import type { Company, Contact, Entry } from "./types";
import { formatDate, formatMoney } from "./utils";

export function pixPayloadForEntry(company: Company, entry: Entry) {
  const key = (company.pixChave || "").trim();
  if (!key) return "";
  return pixCopiaECola({
    key,
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

export function chargeMessage(company: Company, entry: Entry, pix: string) {
  const due = entry.vencimento || entry.data;
  const lines = [
    `Olá${entry.contraparte ? `, ${entry.contraparte}` : ""}!`,
    "",
    `Cobrança de ${company.nome || "PODMEI"}${company.cnpj ? ` (CNPJ ${company.cnpj})` : ""}.`,
    entry.descricao ? entry.descricao : "Serviço / venda",
    `Valor: ${formatMoney(entry.valor)}`,
    `Vencimento: ${formatDate(due)}`,
  ];
  if (pix) {
    lines.push("", "Pix copia e cola:", pix);
  }
  return lines.join("\n");
}
