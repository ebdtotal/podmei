import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { platform } from "@/lib/platform";
import { formatDate } from "@/lib/utils";

type BackupInfo = {
  timezone?: string;
  schedule?: string;
  keepDays?: number;
  lastDay?: string;
  lastAt?: string;
  lastOk?: boolean;
  backups?: Array<{
    day: string;
    hasDb: boolean;
    bytes: number;
    manifest?: { stats?: Record<string, number>; createdAt?: string } | null;
  }>;
  cron?: { midnight?: string; hourlySafety?: string; note?: string };
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function MasterConfiguracoesPage() {
  const { user, refresh } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [backup, setBackup] = useState<BackupInfo | null>(null);
  const [backupError, setBackupError] = useState("");
  const [backupNotice, setBackupNotice] = useState("");
  const [backupBusy, setBackupBusy] = useState(false);

  async function loadBackup() {
    try {
      const data = await platform.backupStatus();
      setBackup(data);
      setBackupError("");
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : "Não foi possível ler o status do backup.");
    }
  }

  useEffect(() => {
    void loadBackup();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      setOk("");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não conferem.");
      setOk("");
      return;
    }
    setBusy(true);
    setError("");
    setOk("");
    try {
      const next = await platform.changePassword(password);
      refresh(next);
      setPassword("");
      setConfirm("");
      setOk("Senha atualizada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a senha.");
    } finally {
      setBusy(false);
    }
  }

  async function runBackup() {
    setBackupBusy(true);
    setBackupNotice("");
    setBackupError("");
    try {
      const data = await platform.runBackupNow();
      setBackupNotice(data.result?.message || "Backup executado.");
      await loadBackup();
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : "Falha ao executar backup.");
    } finally {
      setBackupBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink">Configurações</h1>
        <p className="mt-1 text-sm text-mute">Conta master, senha e backup automático dos dados.</p>
      </div>

      <section className="rounded-2xl border border-line bg-paper p-5">
        <h2 className="text-sm font-semibold">Conta</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-mute">Nome</dt>
            <dd className="mt-1 font-medium">{user?.nome || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-mute">Usuário</dt>
            <dd className="mt-1 font-medium">{user?.username || "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-mute">E-mail</dt>
            <dd className="mt-1 font-medium">{user?.email || "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-line bg-paper p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Backup automático diário</h2>
            <p className="mt-1 text-sm text-mute">
              Cópia do banco SQLite (clientes, assinaturas e áreas) todos os dias às 00:00 (Brasília). Mantém{" "}
              {backup?.keepDays ?? 30} dias.
            </p>
          </div>
          <button type="button" className="btn-primary" disabled={backupBusy} onClick={() => void runBackup()}>
            {backupBusy ? "Gerando…" : "Backup agora"}
          </button>
        </div>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-mute">Último backup</dt>
            <dd className="mt-1 font-medium">
              {backup?.lastDay ? formatDate(backup.lastDay) : "Ainda não rodou"}
              {backup?.lastAt ? (
                <span className="block text-xs text-mute">{new Date(backup.lastAt).toLocaleString("pt-BR")}</span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-mute">Status</dt>
            <dd className={`mt-1 font-medium ${backup?.lastOk ? "text-green" : backup?.lastDay ? "text-orange" : "text-mute"}`}>
              {backup?.lastDay ? (backup.lastOk ? "OK" : "Incompleto") : "Pendente"}
            </dd>
          </div>
        </dl>

        {backupNotice ? <p className="mt-3 text-sm text-green">{backupNotice}</p> : null}
        {backupError ? <p className="mt-3 text-sm text-red">{backupError}</p> : null}

        <div className="mt-4 rounded-2xl border border-line bg-bg p-4 text-xs text-mute">
          <p className="font-semibold text-ink">Cron na HostGator (meia-noite)</p>
          <code className="mt-2 block break-all rounded-xl bg-paper px-3 py-2 text-[11px] text-ink">
            {backup?.cron?.midnight ||
              "0 0 * * * /usr/local/bin/php /home1/jricon98/podmei.com/api/backup-diario.php"}
          </code>
          <p className="mt-2 font-semibold text-ink">Rede de segurança (a cada hora)</p>
          <code className="mt-2 block break-all rounded-xl bg-paper px-3 py-2 text-[11px] text-ink">
            {backup?.cron?.hourlySafety ||
              "5 * * * * /usr/local/bin/php /home1/jricon98/podmei.com/api/backup-diario.php"}
          </code>
          <p className="mt-2">
            {backup?.cron?.note ||
              "Se o relógio do servidor estiver em UTC, use 0 3 * * * para coincidir com 00:00 de Brasília."}
          </p>
        </div>

        {backup?.backups && backup.backups.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-bg text-left text-xs text-mute">
                <tr>
                  <th className="px-3 py-2">Dia</th>
                  <th>Tamanho</th>
                  <th>Contas</th>
                  <th>Áreas</th>
                </tr>
              </thead>
              <tbody>
                {backup.backups.map((row) => (
                  <tr key={row.day} className="border-t border-line">
                    <td className="px-3 py-2 font-medium">{formatDate(row.day)}</td>
                    <td>{row.hasDb ? formatBytes(row.bytes) : "—"}</td>
                    <td>{row.manifest?.stats?.users ?? "—"}</td>
                    <td>{row.manifest?.stats?.workspaces ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-mute">Nenhum backup listado ainda. Rode “Backup agora” ou configure o cron.</p>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-paper p-5">
        <h2 className="text-sm font-semibold">Alterar senha</h2>
        <p className="mt-1 text-sm text-mute">A nova senha vale no próximo login neste site.</p>
        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <label className="block text-xs font-medium text-mute">
            Nova senha
            <input
              className="input mt-1"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium text-mute">
            Confirmar senha
            <input
              className="input mt-1"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          {error ? <p className="text-sm text-red">{error}</p> : null}
          {ok ? <p className="text-sm text-green">{ok}</p> : null}
          <button className="btn-primary" disabled={busy} type="submit">
            {busy ? "Salvando…" : "Salvar senha"}
          </button>
        </form>
      </section>
    </div>
  );
}
