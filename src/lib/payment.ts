import { allowsExternalPurchaseUi } from "./native";
import type { Lead } from "./platform-types";

const SESSION_KEY = "podmei-assine";

/** URL do Checkout Pro do Mercado Pago. */
export function mercadoPagoCheckoutUrl(lead: Lead | { checkoutUrl?: string; mpInitPoint?: string; paymentUrl?: string }): string | null {
  const fromCheckout = ("checkoutUrl" in lead ? lead.checkoutUrl : "") || "";
  if (fromCheckout.trim().startsWith("http")) return fromCheckout.trim();
  const url = (lead.mpInitPoint || "").trim();
  if (url.startsWith("http")) return url;
  const pay = (lead.paymentUrl || "").trim();
  if (pay.includes("mercadopago.com")) return pay;
  return null;
}

export function rememberAssineSession(data: { signupId: string; email: string; nome?: string }) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

/**
 * Envia o cliente ao Mercado Pago (mesmo padrão do EDB: location.href = checkoutUrl).
 */
export function redirectToMercadoPago(
  lead: Lead | {
    checkoutUrl?: string;
    mpInitPoint?: string;
    paymentUrl?: string;
    id?: string;
    signupId?: string;
    email?: string;
    nome?: string;
  },
): boolean {
  if (!allowsExternalPurchaseUi()) return false;
  const url = mercadoPagoCheckoutUrl(lead);
  if (!url) return false;
  const id = ("signupId" in lead && lead.signupId) || ("id" in lead ? lead.id : "") || "";
  const email = ("email" in lead ? lead.email : "") || "";
  if (id && email) {
    rememberAssineSession({ signupId: id, email, nome: "nome" in lead ? lead.nome : undefined });
  }
  window.location.href = url;
  return true;
}
