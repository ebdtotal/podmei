import { Capacitor } from "@capacitor/core";
import { NativeBiometric } from "@capgo/capacitor-native-biometric";

export async function biometricAvailable() {
  if (!Capacitor.isNativePlatform()) return { ok: false, label: "" };
  try {
    const res = await NativeBiometric.isAvailable({ useFallback: true });
    if (!res.isAvailable) return { ok: false, label: "" };
    const label =
      res.biometryType === 2
        ? "Face ID"
        : res.biometryType === 1 || res.biometryType === 3
          ? "Digital"
          : res.biometryType === 4
            ? "Reconhecimento facial"
            : "Biometria";
    return { ok: true, label };
  } catch {
    return { ok: false, label: "" };
  }
}

export async function verifyBiometric(reason = "Desbloqueie o PODMEI") {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    await NativeBiometric.verifyIdentity({
      reason,
      title: "PODMEI",
      subtitle: "Confirme sua identidade",
      description: reason,
      negativeButtonText: "Cancelar",
      useFallback: true,
      maxAttempts: 5,
    });
    return true;
  } catch {
    return false;
  }
}
