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
 * Guideline 3.1.1: no paid digital content / Pro upgrade via external payment inside the iOS app.
 * Web and Android keep Mercado Pago checkout.
 */
export function allowsExternalPurchaseUi() {
  return !isIosApp();
}
