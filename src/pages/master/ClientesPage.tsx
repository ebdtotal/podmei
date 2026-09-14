import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { dasPerfilLabel, resolveDasPerfil } from "@/lib/das";
import { companyTypeLabel, totalExpenses, totalRevenue } from "@/lib/mei";
import { plans } from "@/lib/plans";
import { platform } from "@/lib/platform";
import type { AccountRecord, Lead, PaymentRecord, Subscription, WorkspaceSnapshot } from "@/lib/platform-types";
import type { MeiClient } from "@/lib/types";
import { cn, formatDate, formatMoney } from "@/lib/utils";

const subLabels: Record<Subscription["status"], string> = {
  pendente: "Pendente",
  ativa: "Ativa",
  atrasada: "Atrasada",
  cancelada: "Cancelada",
};

const accountLabels: Record<AccountRecord["status"], string> = {
  ativo: "Ativa",
  bloqueado: "Bloqueada",
  pendente: "Pendente",
};

function when(iso?: string) {
  if (!iso) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return formatDate(iso);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR");
}

function planName(plan: AccountRecord["plan"]) {
  if (plan === "master") return "Master";
  return plans[plan]?.name ?? plan;
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  const text = value === 0 ? "0" : value ? String(value) : "—";
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-mute">{label}</p>
      <p className="mt-0.5 break-words text-sm font-medium text-ink">{text}</p>
    </div>
  );
}

function CompanyCard({ client }: { client: MeiClient }) {
  const company = client.company;
  const entries = client.entries ?? [];
  const contacts = client.contacts ?? [];
  const employee = client.employee;
  const receita = totalRevenue(entries);
  const despesa = totalExpenses(entries);
  const perfil = company.tipo ? resolveDasPerfil(company) : null;

  return (
    <article className="rounded-2xl border border-line bg-bg p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{company.nome || "MEI sem nome"}</h3>
          <p className="text-xs text-mute">
            {client.status === "arquivado" ? "Arquivado" : "Ativo"} · criado em {when(client.createdAt)}
          </p>
        </div>
        <span className="rounded-full bg-navy px-3 py-1 text-[11px] font-semibold text-white">
          {(company.tipo ? companyTypeLabel[company.tipo] : "MEI").toUpperCase()}
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="CNPJ" value={company.cnpj} />
        <Field label="E-mail" value={company.email} />
        <Field label="Telefone" value={company.telefone} />
        <Field label="Endereço" value={company.endereco} />
        <Field label="Bairro" value={company.bairro} />
        <Field label="Cidade / UF" value={[company.cidade, company.uf].filter(Boolean).join(" / ")} />
        <Field label="Abertura" value={company.dataAbertura ? formatDate(company.dataAbertura) : "—"} />
        <Field label="Capital social" value={formatMoney(company.capitalSocial ?? 0)} />
        <Field label="Limite MEI" value={formatMoney(company.limiteFaturamento ?? 81000)} />
        <Field label="Perfil DAS" value={perfil ? dasPerfilLabel[perfil] : "—"} />
        <Field label="Honorário" value={formatMoney(client.honorario ?? 0)} />
        <Field label="WhatsApp" value={client.whatsappPhone} />
      </div>
      {client.notes ? <p className="mt-3 text-sm text-mute">{client.notes}</p> : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-paper p-3">
          <p className="text-[11px] uppercase tracking-wide text-mute">Receitas</p>
          <p className="mt-1 font-semibold">{formatMoney(receita)}</p>
        </div>
        <div className="rounded-xl bg-paper p-3">
          <p className="text-[11px] uppercase tracking-wide text-mute">Despesas</p>
          <p className="mt-1 font-semibold">{formatMoney(despesa)}</p>
        </div>
        <div className="rounded-xl bg-paper p-3">
          <p className="text-[11px] uppercase tracking-wide text-mute">Lançamentos</p>
          <p className="mt-1 font-semibold">{entries.length}</p>
        </div>
      </div>

      <div className="mt-4">
        <h4 className="text-sm font-semibold">Clientes e fornecedores</h4>
        {contacts.length === 0 ? (
          <p className="mt-1 text-xs text-mute">Nenhum cliente ou fornecedor cadastrado.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line bg-paper">
            {contacts.map((contact) => (
              <li key={contact.id} className="px-3 py-2 text-xs">
                <p className="font-medium text-ink">
                  {contact.nome} · {contact.kind === "cliente" ? "cliente" : "fornecedor"}
                </p>
                <p className="text-mute">
                  {[contact.documento, contact.email, contact.telefone, [contact.cidade, contact.uf].filter(Boolean).join("/")].filter(Boolean).join(" · ") ||
                    "sem contato"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4">
        <h4 className="text-sm font-semibold">Colaborador</h4>
        {!employee ? (
          <p className="mt-1 text-xs text-mute">Este MEI não tem empregado cadastrado.</p>
        ) : (
          <div className="mt-2 grid gap-3 rounded-xl border border-line bg-paper p-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Nome" value={employee.nome} />
            <Field label="CPF" value={employee.cpf} />
            <Field label="Cargo" value={employee.cargo} />
            <Field label="Admissão" value={employee.dataAdmissao ? formatDate(employee.dataAdmissao) : "—"} />
            <Field label="Salário" value={formatMoney(employee.salario ?? 0)} />
            <Field label="Status" value={employee.status} />
          </div>
        )}
      </div>
    </article>
  );
}

export function MasterClientesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceSnapshot[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [testForm, setTestForm] = useState({ nome: "", email: "" });
  const [testLink, setTestLink] = useState("");

  async function load() {
    try {
      const [nextAccounts, nextSubs, nextWorkspaces, nextLeads, finance] = await Promise.all([
        platform.accounts(),
        platform.subscriptions(),
        platform.workspaces(),
        platform.leads(),
        platform.finance(),
      ]);
      setAccounts(nextAccounts.filter((a) => a.role !== "master"));
      setSubs(nextSubs);
      setWorkspaces(nextWorkspaces);
      setLeads(nextLeads);
      setPayments(finance.payments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os clientes.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    type Row =
      | { kind: "account"; id: string; nome: string; email: string; subtitle: string; account: AccountRecord }
      | { kind: "lead"; id: string; nome: string; email: string; subtitle: string; lead: Lead };
    const rows: Row[] = [];
    const emails = new Set(accounts.map((a) => a.email.toLowerCase()));
    for (const account of accounts) {
      const sub = subs.find((s) => s.userId === account.id);
      rows.push({
        kind: "account",
        id: account.id,
        nome: account.nome || account.username,
        email: account.email,
        subtitle: `${planName(account.plan)} · ${sub ? subLabels[sub.status] : accountLabels[account.status]}`,
        account,
      });
    }
    for (const lead of leads) {
      if (lead.userId && accounts.some((a) => a.id === lead.userId)) continue;
      if (emails.has(lead.email.toLowerCase())) continue;
      const statusText =
        lead.status === "aguardando_pagamento"
          ? "Aguardando pagamento"
          : lead.status === "aguardando_confirmacao"
            ? "Aguardando confirmação"
            : lead.status === "ativo"
              ? "Ativo (sem conta listada)"
              : "Cancelado";
      rows.push({
        kind: "lead",
        id: `lead:${lead.id}`,
        nome: lead.nome,
        email: lead.email,
        subtitle: `${plans[lead.plan]?.name ?? lead.plan} · ${statusText} · ${formatMoney(lead.amount)}`,
        lead,
      });
    }
    rows.sort((a, b) => {
      const ta =
        a.kind === "account" ? a.account.createdAt || "" : a.lead.createdAt || "";
      const tb =
        b.kind === "account" ? b.account.createdAt || "" : b.lead.createdAt || "";
      return tb.localeCompare(ta);
    });
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = [row.nome, row.email, row.subtitle, row.kind === "account" ? row.account.cnpj : row.lead.cnpj]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [accounts, leads, query, subs]);

  const selectedRow = filtered.find((row) => row.id === id) ?? filtered[0];
  const selected = selectedRow?.kind === "account" ? selectedRow.account : undefined;
  const selectedLeadOnly = selectedRow?.kind === "lead" ? selectedRow.lead : undefined;
  const subscription = selected ? subs.find((s) => s.userId === selected.id) : undefined;
  const snapshot = selected ? workspaces.find((w) => w.userId === selected.id) : undefined;
  const lead = selected
    ? leads.find((l) => l.userId === selected.id || l.email.toLowerCase() === selected.email.toLowerCase())
    : selectedLeadOnly;
  const clientPayments = selected
    ? payments.filter((p) => p.userId === selected.id || p.email.toLowerCase() === selected.email.toLowerCase())
    : lead
      ? payments.filter((p) => p.leadId === lead.id || p.email.toLowerCase() === lead.email.toLowerCase())
      : [];

  useEffect(() => {
    if (!id && selectedRow) navigate(`/master/clientes/${selectedRow.id}`, { replace: true });
  }, [id, selectedRow, navigate]);

  async function liberarLead() {
    if (!selectedLeadOnly) return;
    setBusy("liberar");
    setError("");
    try {
      const result = await platform.confirmPayment(selectedLeadOnly.id);
      await load();
      if (result.username && result.tempPassword) {
        setNotice(
          result.emailSent
            ? `Acesso criado e e-mail enviado: ${result.username}`
            : `Acesso criado: ${result.username} · senha ${result.tempPassword}`,
        );
        if (result.lead.userId) navigate(`/master/clientes/${result.lead.userId}`);
      } else if (result.pending) {
        setNotice("Ainda aguardando confirmação do Mercado Pago.");
      } else {
        setNotice("Cliente atualizado.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível liberar o acesso.");
    } finally {
      setBusy("");
    }
  }

  async function setStatus(status: Subscription["status"]) {
    if (!subscription) return;
    setBusy(status);
    setError("");
    try {
      await platform.setSubscription(subscription.id, status);
      await load();
      setNotice(`Assinatura marcada como ${subLabels[status].toLowerCase()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar a assinatura.");
    } finally {
      setBusy("");
    }
  }

  async function resend() {
    if (!selected) return;
    setBusy("senha");
    setError("");
    try {
      const result = await platform.resendPassword(selected.id);
      setNotice(
        result.emailSent
          ? `Senha provisória reenviada para ${result.username}.`
          : `E-mail não saiu. Usuário ${result.username}${result.tempPassword ? ` · senha ${result.tempPassword}` : ""}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao reenviar senha.");
    } finally {
      setBusy("");
    }
  }

  async function gerarTeste() {
    setBusy("teste");
    setError("");
    setTestLink("");
    try {
      const lead = await platform.checkout({
        nome: testForm.nome.trim(),
        email: testForm.email.trim(),
        telefone: "",
        cnpj: "",
        empresa: "Teste PODMEI",
        plan: "pro",
        cycle: "month",
        test: true,
      });
      const href = lead.mpInitPoint || `/pagar/${lead.id}`;
      setTestLink(href);
      setNotice(`Teste de R$ 2,00 gerado. Depois do pagamento, o e-mail com login e senha vai para ${lead.email}.`);
      if (lead.mpInitPoint) window.open(lead.mpInitPoint, "_blank", "noopener,noreferrer");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível gerar o teste de R$ 2,00.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl text-ink">Clientes</h1>
        <p className="mt-1 text-sm text-mute">
          Todos os dados de cada assinante e o controle da assinatura, visíveis só no acesso master.
        </p>
      </div>
      {error ? <p className="text-sm text-red">{error}</p> : null}
      {notice ? <p className="rounded-2xl bg-bg p-3 text-sm">{notice}</p> : null}

      <form
        className="rounded-3xl border border-line bg-paper p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void gerarTeste();
        }}
      >
        <h2 className="font-semibold">Teste automático de R$ 2,00</h2>
        <p className="mt-1 text-sm text-mute">
          Gera o link do Mercado Pago. Depois da confirmação, o sistema cria a conta e envia login e senha por e-mail.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input
            className="input"
            required
            placeholder="Nome do cliente teste"
            value={testForm.nome}
            onChange={(e) => setTestForm({ ...testForm, nome: e.target.value })}
          />
          <input
            className="input"
            type="email"
            required
            placeholder="E-mail que recebe o acesso"
            value={testForm.email}
            onChange={(e) => setTestForm({ ...testForm, email: e.target.value })}
          />
          <button className="btn-primary" disabled={!!busy}>
            {busy === "teste" ? "Gerando…" : "Gerar teste"}
          </button>
        </div>
        {testLink ? (
          <p className="mt-3 break-all text-sm">
            Link:{" "}
            <a className="font-semibold text-ink underline" href={testLink} rel="noreferrer">
              {testLink.startsWith("http") ? testLink : `${window.location.origin}${testLink}`}
            </a>
          </p>
        ) : null}
      </form>

      <div className="grid gap-4 lg:grid-cols-[minmax(16rem,20rem)_1fr]">
        <aside className="rounded-3xl border border-line bg-paper p-3">
          <input
            className="input"
            placeholder="Buscar nome, e-mail, CNPJ…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <p className="mt-2 px-1 text-[11px] uppercase tracking-wide text-mute">
            {filtered.length} cliente{filtered.length === 1 ? "" : "s"}
          </p>
          <ul className="mt-2 max-h-[70vh] space-y-1 overflow-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-sm text-mute">Nenhum cliente cadastrado ainda.</li>
            ) : (
              filtered.map((row) => {
                const active = selectedRow?.id === row.id;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      className={cn(
                        "w-full rounded-2xl px-3 py-2.5 text-left hover:bg-bg",
                        active && "bg-navy text-white hover:bg-navy",
                      )}
                      onClick={() => navigate(`/master/clientes/${row.id}`)}
                    >
                      <p className="truncate text-sm font-semibold">{row.nome}</p>
                      <p className={cn("truncate text-xs", active ? "text-white/80" : "text-mute")}>{row.subtitle}</p>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        {selectedLeadOnly ? (
          <section className="space-y-4">
            <article className="rounded-3xl border border-line bg-paper p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl text-ink">{selectedLeadOnly.nome}</h2>
                  <p className="mt-1 text-sm text-mute">Checkout — ainda sem conta liberada</p>
                </div>
                <span className="rounded-full bg-bg px-3 py-1 text-xs font-semibold">
                  {selectedLeadOnly.status === "aguardando_pagamento"
                    ? "Aguardando pagamento"
                    : selectedLeadOnly.status === "aguardando_confirmacao"
                      ? "Aguardando confirmação"
                      : selectedLeadOnly.status}
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Nome" value={selectedLeadOnly.nome} />
                <Field label="E-mail" value={selectedLeadOnly.email} />
                <Field label="Telefone" value={selectedLeadOnly.telefone} />
                <Field label="Empresa" value={selectedLeadOnly.empresa} />
                <Field label="CNPJ" value={selectedLeadOnly.cnpj} />
                <Field label="Plano" value={plans[selectedLeadOnly.plan]?.name} />
                <Field
                  label="Valor"
                  value={`${formatMoney(selectedLeadOnly.amount)} / ${selectedLeadOnly.cycle === "year" ? "ano" : "mês"}`}
                />
                <Field label="Criado em" value={when(selectedLeadOnly.createdAt)} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn-primary text-xs" disabled={!!busy} onClick={() => void liberarLead()}>
                  {busy === "liberar" ? "Liberando…" : "Confirmar pagamento / liberar acesso"}
                </button>
                {selectedLeadOnly.mpInitPoint || selectedLeadOnly.paymentUrl ? (
                  <a
                    className="btn-ghost text-xs"
                    href={selectedLeadOnly.mpInitPoint || selectedLeadOnly.paymentUrl}
                    rel="noreferrer"
                  >
                    Abrir link de pagamento
                  </a>
                ) : null}
              </div>
            </article>
          </section>
        ) : !selected ? (
          <section className="rounded-3xl border border-line bg-paper p-8 text-sm text-mute">
            Quando alguém assinar, a ficha completa aparece aqui: dados da conta, pagamento, empresa, clientes,
            fornecedores e colaborador.
          </section>
        ) : (
          <section className="space-y-4">
            <article className="rounded-3xl border border-line bg-paper p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl text-ink">{selected.nome || selected.username}</h2>
                  <p className="mt-1 text-sm text-mute">{planName(selected.plan)}</p>
                </div>
                <span className="rounded-full bg-bg px-3 py-1 text-xs font-semibold">
                  {subscription ? subLabels[subscription.status] : accountLabels[selected.status]}
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Nome" value={selected.nome} />
                <Field label="Usuário" value={selected.username} />
                <Field label="E-mail" value={selected.email} />
                <Field label="Telefone" value={selected.telefone} />
                <Field label="Empresa" value={selected.empresa} />
                <Field label="CNPJ" value={selected.cnpj} />
                <Field label="Perfil" value={selected.role} />
                <Field label="Status da conta" value={accountLabels[selected.status]} />
                <Field label="Cadastro" value={when(selected.createdAt)} />
              </div>
            </article>

            <article className="rounded-3xl border border-line bg-paper p-5">
              <h2 className="font-semibold">Assinatura</h2>
              {subscription ? (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Plano" value={plans[subscription.plan]?.name} />
                    <Field
                      label="Valor"
                      value={`${formatMoney(subscription.amount)} / ${subscription.cycle === "year" ? "ano" : "mês"}`}
                    />
                    <Field label="Status" value={subLabels[subscription.status]} />
                    <Field label="Início" value={when(subscription.startedAt)} />
                    <Field label="Próximo vencimento" value={when(subscription.nextDue)} />
                    <Field label="Último pagamento" value={when(subscription.lastPaidAt)} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {subscription.status !== "ativa" ? (
                      <button className="btn-primary text-xs" disabled={!!busy} onClick={() => void setStatus("ativa")}>
                        Ativar
                      </button>
                    ) : null}
                    {subscription.status !== "atrasada" ? (
                      <button className="btn-ghost text-xs" disabled={!!busy} onClick={() => void setStatus("atrasada")}>
                        Marcar atraso
                      </button>
                    ) : null}
                    {subscription.status !== "cancelada" ? (
                      <button className="btn-ghost text-xs" disabled={!!busy} onClick={() => void setStatus("cancelada")}>
                        Cancelar
                      </button>
                    ) : null}
                    <button className="btn-ghost text-xs" disabled={!!busy} onClick={() => void resend()}>
                      Reenviar senha
                    </button>
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm text-mute">Esta conta ainda não tem assinatura registrada.</p>
              )}
            </article>

            {lead ? (
              <article className="rounded-3xl border border-line bg-paper p-5">
                <h2 className="font-semibold">Dados do checkout</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Nome no pedido" value={lead.nome} />
                  <Field label="E-mail" value={lead.email} />
                  <Field label="Telefone" value={lead.telefone} />
                  <Field label="Empresa" value={lead.empresa} />
                  <Field label="CNPJ" value={lead.cnpj} />
                  <Field label="Plano pedido" value={plans[lead.plan]?.name} />
                  <Field label="Ciclo" value={lead.cycle === "year" ? "Anual" : "Mensal"} />
                  <Field label="Valor" value={formatMoney(lead.amount)} />
                  <Field label="Pedido em" value={when(lead.createdAt)} />
                  <Field label="Pago em" value={when(lead.paidAt)} />
                  <Field label="Mercado Pago" value={lead.mpPaymentId} />
                </div>
              </article>
            ) : null}

            {clientPayments.length ? (
              <article className="rounded-3xl border border-line bg-paper p-5">
                <h2 className="font-semibold">Pagamentos</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {clientPayments.map((pay) => (
                    <li key={pay.id} className="flex flex-wrap justify-between gap-2 rounded-xl bg-bg px-3 py-2">
                      <span>
                        {formatMoney(pay.amount)} · {pay.method === "mercadopago" ? "Mercado Pago" : pay.method}
                      </span>
                      <span className="text-mute">
                        {pay.status} · {when(pay.confirmedAt || pay.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            ) : null}

            {snapshot?.workspace.accountant && (selected.plan === "contador" || selected.plan === "contador_premium") ? (
              <article className="rounded-3xl border border-line bg-paper p-5">
                <h2 className="font-semibold">Escritório</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Contador" value={snapshot.workspace.accountant.nome} />
                  <Field label="CRC" value={snapshot.workspace.accountant.crc} />
                  <Field label="E-mail" value={snapshot.workspace.accountant.email} />
                  <Field label="Telefone" value={snapshot.workspace.accountant.telefone} />
                  <Field label="Escritório" value={snapshot.workspace.accountant.escritorio} />
                </div>
              </article>
            ) : null}

            <article className="space-y-3 rounded-3xl border border-line bg-paper p-5">
              <h2 className="font-semibold">Empresas cadastradas</h2>
              {!snapshot?.workspace.clients.length ? (
                <p className="text-sm text-mute">Esta conta ainda não sincronizou os dados da empresa.</p>
              ) : (
                snapshot.workspace.clients.map((client) => <CompanyCard key={client.id} client={client} />)
              )}
            </article>
          </section>
        )}
      </div>
    </div>
  );
}
