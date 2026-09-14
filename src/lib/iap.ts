import { NativePurchases, PURCHASE_TYPE } from "@capgo/native-purchases";
import { isIosApp } from "./native";
import type { BillingCycle, PlanKey } from "./types";

/** Product IDs must match App Store Connect → Subscriptions. */
export const IAP_PRODUCTS: Record<PlanKey, Record<BillingCycle, string>> = {
  pro: {
    month: "br.com.podmei.app.pro.month",
    year: "br.com.podmei.app.pro.year",
  },
  premium: {
    month: "br.com.podmei.app.premium.month",
    year: "br.com.podmei.app.premium.year",
  },
  contador: {
    month: "br.com.podmei.app.contador.month",
    year: "br.com.podmei.app.contador.year",
  },
  contador_premium: {
    month: "br.com.podmei.app.contadorpremium.month",
    year: "br.com.podmei.app.contadorpremium.year",
  },
};

export function iapProductId(plan: PlanKey, cycle: BillingCycle) {
  return IAP_PRODUCTS[plan][cycle];
}

export function usesNativeIap() {
  return isIosApp();
}

export async function iapBillingSupported() {
  if (!isIosApp()) return false;
  try {
    const res = await NativePurchases.isBillingSupported();
    return Boolean(res?.isBillingSupported ?? true);
  } catch {
    return false;
  }
}

export async function purchaseIapSubscription(plan: PlanKey, cycle: BillingCycle) {
  const productIdentifier = iapProductId(plan, cycle);
  const { products } = await NativePurchases.getProducts({
    productIdentifiers: [productIdentifier],
    productType: PURCHASE_TYPE.SUBS,
  });
  if (!products?.length) {
    throw new Error(
      "Plano ainda não disponível na App Store. Crie a assinatura no App Store Connect com o ID: " + productIdentifier,
    );
  }
  const transaction = await NativePurchases.purchaseProduct({
    productIdentifier,
    productType: PURCHASE_TYPE.SUBS,
  });
  return {
    productIdentifier,
    transactionId: String(transaction.transactionId || ""),
    receipt: String(transaction.receipt || ""),
  };
}
