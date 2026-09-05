import { useEffect, useState } from "react";
import { plans } from "@/lib/plans";
import { platform } from "@/lib/platform";
import type { AccountRecord, WorkspaceSnapshot } from "@/lib/platform-types";

export function MasterCadastrosPage() {
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceSnapshot[]>([]);
  const [openId, setOpenId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([platform.accounts(), platform.workspaces()])
      .then(([nextAccounts, nextWorkspaces]) => {
        setAccounts(nextAccounts.filter((a) => a.role !== "master"));
        setWorkspaces(nextWorkspaces);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Não foi possível carregar os cadastros."));
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl text-ink">Cadastros</h1>
        <p className="mt-1 text-sm text-mute">Contas ativas e os dados de empresa, clientes e fornecedores de cada assinante.</p>
      </div>
      {error ? <p className="text-sm text-red">{error}</p> : null}
      <div className="space-y-3">
        {accounts.length === 0 ? (
          <p className="rounded-3xl border border-line bg-paper p-6 text-sm text-mute">Nenhum cadastro além do master.</p>
        ) : (
          accounts.map((account) => {
            const snap = workspaces.find((w) => w.userId === account.id);
            const open = openId === account.id;
            return (
              <article key={account.id} className="rounded-3xl border border-line bg-paper p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{account.nome}</h2>
                    <p className="text-sm text-mute">
                      {account.email} · {account.username} · {account.plan === "master" ? "Master" : plans[account.plan]?.name}
                    </p>
                    <p className="mt-1 text-xs text-mute">
                      {account.empresa || "sem empresa"} · {account.cnpj || "sem CNPJ"} · {account.telefone || "sem telefone"} ·{" "}
                      {account.status}
                    </p>
                  </div>
                  <button className="btn-ghost text-xs" type="button" onClick={() => setOpenId(open ? "" : account.id)}>
                    {open ? "Fechar" : "Ver cadastros"}
                  </button>
                </div>
                {open ? (
                  <div className="mt-4 space-y-3 text-sm">
                    {!snap ? (
                      <p className="text-mute">Essa conta ainda não sincronizou a carteira.</p>
                    ) : (
                      snap.workspace.clients.map((client) => {
                        const contacts = client.contacts ?? [];
                        return (
                        <div key={client.id} className="rounded-2xl bg-bg p-4">
                          <p className="font-semibold">{client.company.nome}</p>
                          <p className="text-xs text-mute">
                            CNPJ {client.company.cnpj || "—"} · {client.company.email || "sem e-mail"} ·{" "}
                            {contacts.length} contato{contacts.length === 1 ? "" : "s"} ·{" "}
                            {client.entries.length} lançamento{client.entries.length === 1 ? "" : "s"}
                          </p>
                          {contacts.length ? (
                            <ul className="mt-2 space-y-1 text-xs">
                              {contacts.map((contact) => (
                                <li key={contact.id}>
                                  {contact.nome} · {contact.kind} · {contact.email || contact.telefone || "sem contato"}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-2 text-xs text-mute">Sem clientes ou fornecedores cadastrados.</p>
                          )}
                        </div>
                        );
                      })
                    )}
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
