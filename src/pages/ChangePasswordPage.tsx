import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/lib/auth";
import { isContadorPlan } from "@/lib/plans";
import { platform } from "@/lib/platform";

export function ChangePasswordPage() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const next = await platform.changePassword(password);
      refresh(next);
      navigate(
        next.role === "master"
          ? "/master"
          : isContadorPlan(next.plan)
            ? "/contador"
            : "/app",
        { replace: true },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a senha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md rounded-3xl border border-line bg-paper p-8">
        <Logo full />
        <h1 className="mt-6 font-display text-3xl text-ink">Trocar senha provisória</h1>
        <p className="mt-2 text-sm text-mute">Olá, {user?.nome || user?.username}. Defina uma senha só sua para continuar.</p>
        <form className="mt-6 space-y-3" onSubmit={onSubmit}>
          <label className="block text-sm">
            Nova senha
            <input className="input mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label className="block text-sm">
            Confirmar senha
            <input className="input mt-1" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </label>
          {error ? <p className="text-sm text-red">{error}</p> : null}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Salvando…" : "Salvar e entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
