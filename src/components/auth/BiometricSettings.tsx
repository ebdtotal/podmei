import { useEffect, useState } from "react";
import { biometricAvailable, verifyBiometric } from "@/lib/biometric";
import { isBiometricLoginEnabled, setBiometricLoginEnabled } from "@/lib/session-persist";
import { ehAppNativo } from "@/lib/native";

/** Toggle Face ID / digital — só no app nativo. */
export function BiometricSettings() {
  const [show, setShow] = useState(false);
  const [label, setLabel] = useState("Biometria");
  const [on, setOn] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ehAppNativo()) return;
    void (async () => {
      const avail = await biometricAvailable();
      if (!avail.ok) return;
      setShow(true);
      if (avail.label) setLabel(avail.label);
      setOn(await isBiometricLoginEnabled());
    })();
  }, []);

  if (!show) return null;

  async function toggle() {
    setBusy(true);
    setMsg("");
    try {
      if (!on) {
        const ok = await verifyBiometric(`Ativar ${label} no PODMEI`);
        if (!ok) {
          setMsg("Não foi possível confirmar a biometria.");
          return;
        }
        await setBiometricLoginEnabled(true);
        setOn(true);
        setMsg(`${label} ativada. Ao reabrir o app, use ${label} para entrar.`);
      } else {
        await setBiometricLoginEnabled(false);
        setOn(false);
        setMsg(`${label} desativada.`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-paper p-5">
      <h2 className="text-sm font-semibold">Desbloqueio do app</h2>
      <p className="mt-1 text-sm text-mute">
        Mantenha a conta logada e use {label} ao abrir o PODMEI no celular.
      </p>
      <button type="button" className="btn-primary mt-4" disabled={busy} onClick={() => void toggle()}>
        {busy ? "Aguarde…" : on ? `Desativar ${label}` : `Ativar ${label}`}
      </button>
      {msg ? <p className="mt-2 text-sm text-green-700">{msg}</p> : null}
    </section>
  );
}
