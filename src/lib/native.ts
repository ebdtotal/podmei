import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";

export async function iniciarAppNativo() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setStyle({ style: Style.Light });
    if (Capacitor.getPlatform() === "ios") {
      await StatusBar.setOverlaysWebView({ overlay: false });
    } else {
      await StatusBar.setBackgroundColor({ color: "#7B2CF5" });
    }
  } catch {
    /* web */
  }
  await CapApp.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack || window.history.length > 1) window.history.back();
    else void CapApp.exitApp();
  });
}

export function ehAppNativo() {
  return Capacitor.isNativePlatform();
}

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export function isIosApp() {
  return Capacitor.getPlatform() === "ios";
}

/**
 * Guideline 3.1.1: no Mercado Pago / external web checkout inside the iOS app.
 * iOS uses App Store In-App Purchase instead (see CheckoutPage + src/lib/iap.ts).
 */
export function allowsExternalPurchaseUi() {
  return !isIosApp();
}
