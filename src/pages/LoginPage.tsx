import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";
import { emptyWorkspaceFromUser, useAuth } from "@/lib/auth";
import { platform } from "@/lib/platform";
import { bindStoreUser, useStore } from "@/lib/store";

export function LoginPage() {
  const { login } = useAuth();
  const { replaceWorkspace } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgotBusy, setForgotBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const user = await login(username.trim(), password);
      if (user.role !== "master") {
        // Liga a chave localStorage do usuário ANTES de gravar o snapshot,
        // senão o login escreve no storage genérico e o Bridge sobrescreve.
        bindStoreUser(user.id);
        try {
          const remote = await platform.myWorkspace();
          if (remote.snapshot?.workspace) {
            replaceWorkspace(remote.snapshot.workspace as Parameters<typeof replaceWorkspace>[0], {
              stamp: false,
              emitSync: false,
            });
          } else {
            replaceWorkspace(emptyWorkspaceFromUser(remote.onboarding ?? user), {
              stamp: false,
              emitSync: false,
            });
          }
        } catch {
          replaceWorkspace(emptyWorkspaceFromUser(user), { stamp: false, emitSync: false });
        }
      }
      const next = params.get("next");
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "";
      if (user.role === "master") navigate(safeNext.startsWith("/master") ? safeNext : "/master", { replace: true });
      else if (user.plan === "contador") navigate(safeNext || "/contador", { replace: true });
      else navigate(safeNext || "/app", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  async function onForgotPassword() {
    setError("");
    setNotice("");
    const loginId = username.trim();
    if (!loginId) {
      setError("Informe o usuário ou o e-mail cadastrado para recuperar a senha.");
      return;
    }
    setForgotBusy(true);
    try {
      const msg = await platform.forgotPassword(loginId);
      setNotice(msg);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar a nova senha.");
    } finally {
      setForgotBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md rounded-3xl border border-line bg-paper p-8 shadow-sm">
        <Logo full />
        <h1 className="mt-6 font-display text-3xl text-ink">Entrar</h1>
        <p className="mt-2 text-sm text-mute">Acesso com usuário e senha após a confirmação da assinatura.</p>
        <form className="mt-6 space-y-3" onSubmit={onSubmit}>
          <label className="block text-sm">
            Usuário ou e-mail
            <input className="input mt-1" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className="block text-sm">
            Senha
            <input
              className="input mt-1"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <div className="flex justify-end">
            <button
              type="button"
              className="text-sm font-semibold text-navy underline-offset-2 hover:underline disabled:opacity-60"
              disabled={busy || forgotBusy}
              onClick={() => void onForgotPassword()}
            >
              {forgotBusy ? "Enviando senha…" : "Esqueceu a senha?"}
            </button>
          </div>
          {error ? <p className="text-sm text-red">{error}</p> : null}
          {notice ? <p className="text-sm text-green-700">{notice}</p> : null}
          <button className="btn-primary w-full" disabled={busy || forgotBusy}>
            {busy ? "Entrando…" : "Entrar"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-mute">
          Ainda não assinou?{" "}
          <Link to="/assinar/pro" className="font-semibold text-ink">
            Escolher um plano
          </Link>
        </p>
      </div>
    </div>
  );
}
