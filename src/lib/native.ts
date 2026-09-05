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
