import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Plus, RefreshCw, Search } from "lucide-react";
import { clientSnapshot } from "@/lib/portfolio";
import { dasPerfilFromTipo } from "@/lib/das";
import { companyTypeLabel } from "@/lib/mei";
import { platform, type AccountantInvite } from "@/lib/platform";
import { useStore } from "@/lib/store";
import type { CompanyType, MeiClient, MeiStatus } from "@/lib/types";
import { cn, currentYear, formatMoney, formatPercent } from "@/lib/utils";

export function CarteiraPage() {
  const { accountant, clients, activeClientId, updateClient, removeClient, selectClient, openSharedClient } =
    useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"todos" | MeiStatus>("ativo");
  const [creating, setCreating] = useState(false);
  const [incoming, setInvites] = useState<AccountantInvite[]>([]);
  const [inviteMsg, setInviteMsg] = useState("");
  const year = currentYear();

  useEffect(() => {
    void platform
      .accountantInvites()
      .then((data) => setInvites(data.incoming))
      .catch(() => setInvites([]));
  }, []);

  async function acceptShared(invite: AccountantInvite) {
    setInviteMsg("");
    const result = await platform.acceptInvite(invite.token);
    if (result.client) openSharedClient(result.client);
    const data = await platform.accountantInvites();
    setInvites(data.incoming);
    navigate("/app");
  }

  async function openShared(invite: AccountantInvite) {
    setInviteMsg("");
    const client = await platform.sharedClient(invite.id);
    openSharedClient(client);
    navigate("/app");
  }

  const rows = useMemo(() => {
    const t = q.toLowerCase();
    return clients
      .filter((c) => (status === "todos" ? true : c.status === status))
      .filter(
        (c) =>
          (c.company?.nome ?? "").toLowerCase().includes(t) ||
          (c.company?.cnpj ?? "").includes(t) ||
          (c.company?.cidade ?? "").toLowerCase().includes(t),
      )
      .map((client) => ({ client, snap: clientSnapshot(client, year) }));
  }, [clients, q, status, year]);

  const ativos = clients.filter((c) => c.status === "ativo");
  const ativoSnaps = useMemo(
    () => ativos.map((c) => clientSnapshot(c, year)),
    [ativos, year],
  );
  const near = ativoSnaps.filter((s) => s.fat.pct >= 80).length;
  const dasLate = ativoSnaps.filter((s) => s.dasAtraso > 0).length;
  const honorarios = ativos.reduce((s, c) => s + c.honorario, 0);
  const carteiraFat = ativoSnaps.reduce((s, r) => s + r.billed, 0);

  function openMei(id: string) {
    selectClient(id);
    navigate("/app");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange">Módulo do contador</p>
          <h1 className="font-display text-3xl text-ink">{accountant.escritorio}</h1>
          <p className="mt-1 text-sm text-mute">
            Administre vários CNPJs: limite, DAS, contas e relatórios de cada MEI.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary gap-2" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            Novo MEI
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="MEIs ativos" value={String(ativos.length)} />
        <Kpi label={`Faturamento ${year}`} value={formatMoney(carteiraFat)} />
        <Kpi label="Honorários / mês" value={formatMoney(honorarios)} />
        <Kpi
          label="Atenção"
          value={`${dasLate} DAS atrasado · ${near} no limite`}
          warn={dasLate + near > 0}
        />
      </div>

      {incoming.length ? (
        <section className="rounded-2xl border border-line bg-paper p-4">
          <h2 className="text-sm font-semibold">Convites dos MEIs</h2>
          <ul className="mt-3 space-y-2">
            {incoming.map((invite) => (
              <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  <strong>{invite.companyNome || "MEI"}</strong>
                  {invite.cnpj ? ` · ${invite.cnpj}` : ""} · {invite.status === "aceito" ? "na carteira" : "aguardando aceite"}
                </span>
                {invite.status === "aceito" ? (
                  <button type="button" className="btn-ghost gap-2" onClick={() => void openShared(invite).catch((err) => setInviteMsg(err instanceof Error ? err.message : "Falha ao abrir."))}>
                    <RefreshCw className="size-4" />
                    Atualizar e abrir
                  </button>
                ) : (
                  <button type="button" className="btn-primary" onClick={() => void acceptShared(invite).catch((err) => setInviteMsg(err instanceof Error ? err.message : "Não foi possível aceitar."))}>
                    Aceitar
                  </button>
                )}
              </li>
            ))}
          </ul>
          {inviteMsg ? <p className="mt-2 text-sm text-red">{inviteMsg}</p> : null}
        </section>
      ) : null}

      {creating ? (
        <NovoMeiForm
          onCancel={() => setCreating(false)}
          onSave={(created) => {
            setCreating(false);
            openMei(created.id);
          }}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mute" />
          <input
            className="input pl-9"
            placeholder="Buscar nome, CNPJ ou cidade…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          className="input w-auto"
          value={status}
          onChange={(e) => setStatus(e.target.value as "todos" | MeiStatus)}
        >
          <option value="ativo">Ativos</option>
          <option value="arquivado">Arquivados</option>
          <option value="todos">Todos</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-navy text-left text-xs text-white">
            <tr>
              <th className="px-4 py-3">MEI</th>
              <th>Atividade</th>
              <th>Faturado {year}</th>
              <th>Limite</th>
              <th>DAS</th>
              <th>A receber</th>
              <th>Honorário</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-mute" colSpan={8}>
                  Nenhum MEI nesta lista. Cadastre o primeiro CNPJ.
                </td>
              </tr>
            ) : (
              rows.map(({ client, snap }) => (
                <tr
                  key={client.id}
                  className={cn(
                    "border-t border-line",
                    client.id === activeClientId && "bg-bg/80",
                  )}
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold">
                      {client.company.nome}
                      {snap.hasEmployee ? (
                        <span className="ml-2 rounded-full bg-navy/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-navy">
                          1 colaborador
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-mute">
                      {client.company.cnpj || "CNPJ pendente"} · {client.company.cidade}/{client.company.uf}
                    </p>
                  </td>
                  <td>{companyTypeLabel[client.company.tipo]}</td>
                  <td className="font-medium">{formatMoney(snap.billed)}</td>
                  <td>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                        snap.fat.tone === "ok"
                          ? "bg-green/15 text-green"
                          : snap.fat.tone === "warn"
                            ? "bg-orange/15 text-orange"
                            : "bg-red/15 text-red",
                      )}
                    >
                      {formatPercent(snap.fat.pct)}
                    </span>
                  </td>
                  <td>
                    {snap.dasAtraso ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red">
                        <AlertTriangle className="size-3.5" />
                        {snap.dasAtraso} atrasado{snap.dasAtraso > 1 ? "s" : ""}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-green">Em dia</span>
                    )}
                  </td>
                  <td>{snap.receber ? formatMoney(snap.receber) : "—"}</td>
                  <td>{formatMoney(client.honorario)}</td>
                  <td className="pr-4">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button type="button" className="btn-primary" onClick={() => openMei(client.id)}>
                        Abrir
                      </button>
                      {client.status === "ativo" ? (
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => updateClient(client.id, { status: "arquivado" })}
                        >
                          Arquivar
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => updateClient(client.id, { status: "ativo" })}
                        >
                          Reativar
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-xs text-red"
                        onClick={() => {
                          if (confirm(`Excluir ${client.company.nome} da carteira?`)) removeClient(client.id);
                        }}
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={cn("rounded-2xl border p-4", warn ? "border-orange bg-orange/5" : "border-line bg-paper")}>
      <p className="text-xs text-mute">{label}</p>
      <p className="mt-1 font-display text-xl text-ink">{value}</p>
    </div>
  );
}

function NovoMeiForm({
  onSave,
  onCancel,
}: {
  onSave: (created: MeiClient) => void;
  onCancel: () => void;
}) {
  const { addClient } = useStore();
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [tipo, setTipo] = useState<CompanyType>("servicos");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("SP");
  const [telefone, setTelefone] = useState("");
  const [honorario, setHonorario] = useState(150);
  const [notes, setNotes] = useState("");

  return (
    <section className="rounded-2xl border border-gold bg-paper p-5">
      <h2 className="text-sm font-semibold">Cadastrar MEI na carteira</h2>
      <form
        className="mt-4 grid gap-3 md:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (nome.trim().length < 2) return;
          const created = addClient({
            honorario,
            notes,
            company: {
              nome: nome.trim().toUpperCase(),
              cnpj,
              tipo,
              dasPerfil: dasPerfilFromTipo(tipo),
              cidade: cidade.toUpperCase(),
              uf: uf.toUpperCase(),
              telefone,
            },
          });
          onSave(created);
        }}
      >
        <Field label="Nome / razão">
          <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} required />
        </Field>
        <Field label="CNPJ">
          <input className="input" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
        </Field>
        <Field label="Atividade">
          <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value as CompanyType)}>
            <option value="servicos">Serviços</option>
            <option value="comercio">Comércio</option>
            <option value="comercio_servicos">Comércio / Serviços</option>
            <option value="industria">Indústria</option>
            <option value="transporte_carga">Transporte de cargas</option>
            <option value="transporte_passageiros">Transporte de passageiros</option>
          </select>
        </Field>
        <Field label="Cidade">
          <input className="input" value={cidade} onChange={(e) => setCidade(e.target.value)} />
        </Field>
        <Field label="UF">
          <input className="input" maxLength={2} value={uf} onChange={(e) => setUf(e.target.value.toUpperCase())} />
        </Field>
        <Field label="Telefone">
          <input className="input" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
        </Field>
        <Field label="Honorário mensal">
          <input
            type="number"
            className="input"
            value={honorario}
            onChange={(e) => setHonorario(Number(e.target.value))}
          />
        </Field>
        <Field label="Anotação interna">
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="flex items-end gap-2 md:col-span-3">
          <button type="submit" className="btn-primary">
            Salvar e abrir o MEI
          </button>
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-mute">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}
