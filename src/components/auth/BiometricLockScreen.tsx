import { Fingerprint } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { biometricAvailable, verifyBiometric } from "@/lib/biometric";

export function BiometricLockScreen({
  onUnlocked,
  onLogout,
}: {
  onUnlocked: () => void;
  onLogout: () => void;
}) {
  const [label, setLabel] = useState("Biometria");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function unlock() {
    setBusy(true);
    setError("");
    const ok = await verifyBiometric(`Use ${label} para entrar no PODMEI`);
    setBusy(false);
    if (ok) onUnlocked();
    else setError("Não foi possível confirmar. Tente de novo.");
  }

  useEffect(() => {
    void biometricAvailable().then((a) => {
      if (a.label) setLabel(a.label);
    });
    void unlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-prompt once on mount
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-paper p-8 text-center shadow-sm">
        <Logo full />
        <div className="mx-auto mt-8 grid size-16 place-items-center rounded-full bg-violet-100 text-violet-700">
          <Fingerprint className="size-8" />
        </div>
        <h1 className="mt-5 font-display text-2xl text-ink">Desbloquear</h1>
        <p className="mt-2 text-sm text-mute">Sua conta continua logada. Confirme com {label}.</p>
        {error ? <p className="mt-3 text-sm text-red">{error}</p> : null}
        <button type="button" className="btn-primary mt-6 w-full" disabled={busy} onClick={() => void unlock()}>
          {busy ? "Aguardando…" : `Usar ${label}`}
        </button>
        <button type="button" className="btn-ghost mt-3 w-full" onClick={onLogout}>
          Sair e entrar com senha
        </button>
      </div>
    </div>
  );
}
