import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { SESSION_KEY } from "./platform-local";

const BIO_FLAG = "pod-mei-biometric-on";

async function nativeGet(key: string) {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { value } = await Preferences.get({ key });
    return value;
  } catch {
    return null;
  }
}

async function nativeSet(key: string, value: string) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Preferences.set({ key, value });
  } catch {
    /* web / plugin */
  }
}

async function nativeRemove(key: string) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Preferences.remove({ key });
  } catch {
    /* */
  }
}

/** Restaura sessão do storage nativo para o localStorage (WebView). */
export async function hydrateNativeSession() {
  if (!Capacitor.isNativePlatform()) return;
  const value = await nativeGet(SESSION_KEY);
  if (value) {
    try {
      JSON.parse(value);
      localStorage.setItem(SESSION_KEY, value);
    } catch {
      await nativeRemove(SESSION_KEY);
    }
  }
}

export async function persistSessionToNative(raw: string | null) {
  if (raw) await nativeSet(SESSION_KEY, raw);
  else await nativeRemove(SESSION_KEY);
}

export async function isBiometricLoginEnabled() {
  if (!Capacitor.isNativePlatform()) return false;
  const v = await nativeGet(BIO_FLAG);
  if (v === "1") return true;
  return localStorage.getItem(BIO_FLAG) === "1";
}

export async function setBiometricLoginEnabled(on: boolean) {
  if (on) {
    localStorage.setItem(BIO_FLAG, "1");
    await nativeSet(BIO_FLAG, "1");
  } else {
    localStorage.removeItem(BIO_FLAG);
    await nativeRemove(BIO_FLAG);
  }
}
