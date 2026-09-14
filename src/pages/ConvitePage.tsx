import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/lib/auth";
import { platform } from "@/lib/platform";
import { useStore } from "@/lib/store";

export function ConvitePage() {
  const { token = "" } = useParams();
  const { user } = useAuth();
  const { openSharedClient } = useStore();
  const navigate = useNavigate();
  const [company, setCompany] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    void platform
      .previewInvite(token)
      .then((invite) => {
        setCompany(invite.companyNome);
        setCnpj(invite.cnpj);
        setStatus(invite.status);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Convite não encontrado."));
  }, [token]);

  async function accept() {
    setBusy(true);
    setError("");
    try {
      const result = await platform.acceptInvite(token);
      if (result.client) openSharedClient(result.client);
      navigate("/contador", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível aceitar.");
      setBusy(false);
    }
  }

  const next = `/convite/${token}`;

  return (
    <div className="min-h-screen bg-bg px-4 py-10">
      <div className="mx-auto max-w-lg rounded-3xl border border-line bg-paper p-8">
        <Logo full />
        <h1 className="mt-6 font-display text-3xl text-ink">Convite do MEI</h1>
        {error ? <p className="mt-3 text-sm text-red">{error}</p> : null}
        {!error ? (
          <p className="mt-3 text-sm text-mute">
            {company ? <strong className="text-ink">{company}</strong> : "Um MEI"}
            {cnpj ? ` (CNPJ ${cnpj})` : ""} convidou o escritório para acompanhar a carteira no PODMEI.
          </p>
        ) : null}
        {status === "aceito" && user ? (
          <button type="button" className="btn-primary mt-6 w-full" disabled={busy} onClick={() => void accept()}>
            Abrir na carteira
          </button>
        ) : user?.plan === "contador" || user?.plan === "contador_premium" || user?.role === "master" ? (
          <button type="button" className="btn-primary mt-6 w-full" disabled={busy || !token} onClick={() => void accept()}>
            {busy ? "Aceitando…" : "Aceitar e abrir o MEI"}
          </button>
        ) : user ? (
          <p className="mt-4 text-sm text-mute">
            Esta conta não é PODMEI Contador. Entre com a conta do escritório para aceitar.
          </p>
        ) : (
          <Link to={`/entrar?next=${encodeURIComponent(next)}`} className="btn-primary mt-6 inline-flex w-full justify-center">
            Entrar para aceitar
          </Link>
        )}
        <Link to="/" className="mt-4 block text-center text-sm font-semibold text-ink">
          Início
        </Link>
      </div>
    </div>
  );
}
