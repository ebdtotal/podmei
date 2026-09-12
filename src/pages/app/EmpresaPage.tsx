import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { companyTypeLabel, MEI_FATURAMENTO } from "@/lib/mei";
import { dasPerfilFromTipo, dasPerfilLabel } from "@/lib/das";
import { useAuth } from "@/lib/auth";
import { allowsExternalPurchaseUi, isIosApp } from "@/lib/native";
import { plans } from "@/lib/plans";
import { platform, type AccountantInvite } from "@/lib/platform";
import type { Subscription } from "@/lib/platform-types";
import { useStore } from "@/lib/store";
import type { Company, CompanyType, DasPerfil, PixTipo } from "@/lib/types";
import { inferPixTipo, normalizePixKey, pixTipoLabel } from "@/lib/charge";
import { stripLogoBackground } from "@/lib/logo";
import { formatMoney } from "@/lib/utils";

const statusLabel: Record<string, string> = {
  ativa: "Ativa (recorrente)",
  atrasada: "Em atraso",
  cancelada: "Cancelada",
  pendente: "Pendente",
};

export function EmpresaPage() {
  const { company, setCompany, exportBackup, importBackup } = useStore();
  const { user, refresh, logout } = useAuth();
  const [form, setForm] = useState<Company>(company);
  const [saved, setSaved] = useState(false);
  const [logoError, setLogoError] = useState("");
  const [backupMsg, setBackupMsg] = useState("");
  const [syncMsg, setSyncMsg] = useState("Sincronizando com a nuvem…");
  const [syncOk, setSyncOk] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordOk, setPasswordOk] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [sub, setSub] = useState<Subscription | null>(null);
  const [subBusy, setSubBusy] = useState(false);
  const [subMsg, setSubMsg] = useState("");
  const [subErr, setSubErr] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [inviteErr, setInviteErr] = useState("");
  const [invites, setInvites] = useState<AccountantInvite[]>([]);
  const [logoPreview, setLogoPreview] = useState(company.logoDataUrl ?? "");

  useEffect(() => {
    setForm(company);
  }, [company]);

  useEffect(() => {
    const src = form.logoDataUrl;
    if (!src) {
      setLogoPreview("");
      return;
    }
    let cancelled = false;
    void stripLogoBackground(src).then((next) => {
      if (!cancelled) setLogoPreview(next);
    });
    return () => {
      cancelled = true;
    };
  }, [form.logoDataUrl]);

  useEffect(() => {
    if (!user || user.role === "master") return;
    void platform.mySubscription().then(setSub).catch(() => setSub(null));
  }, [user]);

  useEffect(() => {
    if (!user || user.role === "master" || user.plan === "contador") return;
    void platform
      .accountantInvites()
      .then((data) => setInvites(data.sent))
      .catch(() => setInvites([]));
  }, [user]);

  useEffect(() => {
    const onStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ status: string; detail?: string }>).detail;
      if (!detail) return;
      if (detail.status === "ok") {
        setSyncOk(true);
        setSyncMsg(detail.detail || "Dados salvos na nuvem.");
      } else if (detail.status === "error") {
        setSyncOk(false);
        setSyncMsg(detail.detail || "Falha ao sincronizar.");
      } else if (detail.status === "syncing") {
        setSyncMsg(detail.detail || "Salvando na nuvem…");
      }
    };
    window.addEventListener("podmei-sync-status", onStatus);
    return () => window.removeEventListener("podmei-sync-status", onStatus);
  }, []);

  function patch<K extends keyof Company>(key: K, value: Company[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setPixTipo(tipo: PixTipo) {
    setForm((prev) => {
      let chave = prev.pixChave ?? "";
      if (tipo === "cnpj") {
        const digits = chave.replace(/\D/g, "");
        chave = digits.length === 14 ? digits : (prev.cnpj || "").replace(/\D/g, "");
      } else if (tipo === "cpf") {
        chave = chave.replace(/\D/g, "");
      } else if (tipo === "telefone" && !chave.replace(/\D/g, "")) {
        chave = prev.telefone || "";
      } else if (tipo === "email" && !chave.includes("@")) {
        chave = prev.email || "";
      }
      return { ...prev, pixTipo: tipo, pixChave: chave };
    });
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setPasswordError("A senha precisa ter pelo menos 8 caracteres.");
      setPasswordOk("");
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError("As senhas não conferem.");
      setPasswordOk("");
      return;
    }
    setPasswordBusy(true);
    setPasswordError("");
    setPasswordOk("");
    try {
      const next = await platform.changePassword(password);
      refresh(next);
      setPassword("");
      setConfirmPassword("");
      setPasswordOk("Senha de acesso atualizada.");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Não foi possível salvar a senha.");
    } finally {
      setPasswordBusy(false);
    }
  }

  async function onCancelSubscription() {
    if (!confirm("Cancelar a cobrança automática no Mercado Pago? O acesso será bloqueado após o cancelamento.")) {
      return;
    }
    setSubBusy(true);
    setSubErr("");
    setSubMsg("");
    try {
      const next = await platform.cancelMySubscription();
      setSub(next);
      setSubMsg("Assinatura cancelada. A cobrança recorrente foi interrompida.");
      window.setTimeout(() => {
        logout();
        window.location.href = "/entrar";
      }, 1800);
    } catch (e) {
      setSubErr(e instanceof Error ? e.message : "Não foi possível cancelar.");
    } finally {
      setSubBusy(false);
    }
  }

  async function onDeleteAccount() {
    const ok = window.confirm(
      "Excluir permanentemente sua conta, assinatura e dados na nuvem? Esta ação não pode ser desfeita.",
    );
    if (!ok) return;
    const confirmText = window.prompt('Digite EXCLUIR para confirmar a exclusão da conta:');
    if (confirmText !== "EXCLUIR") {
      setDeleteError("Exclusão cancelada.");
      return;
    }
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await platform.deleteMyAccount();
      logout();
      window.location.href = "/";
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Não foi possível excluir a conta.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink">Dados da empresa</h1>
        <p className="mt-1 text-sm text-mute">
          Esses dados alimentam recibos, relatório oficial e o cálculo do limite de faturamento do MEI.
        </p>
      </div>

      <section className="rounded-2xl border border-line bg-paper p-5">
        <h2 className="text-sm font-semibold">Logo da empresa</h2>
        <p className="mt-1 text-xs text-mute">
          PNG horizontal, <strong className="text-ink">720 × 200 px</strong>. Fundo branco ou de cor sólida é
          removido para a marca ficar transparente na faixa do recibo.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="grid h-[72px] w-[260px] place-items-center overflow-hidden rounded-xl bg-[#070b14] px-3">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo da empresa" className="max-h-[52px] max-w-[230px] object-contain" />
            ) : (
              <span className="px-2 text-center text-[11px] text-white/70">720 × 200 px</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="btn-primary cursor-pointer">
              Subir logo
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setLogoError("");
                  void fileToLogoDataUrl(file).then(stripLogoBackground)
                    .then((logoDataUrl) => patch("logoDataUrl", logoDataUrl))
                    .catch(() => setLogoError("Não foi possível usar essa imagem. Tente PNG ou JPG."));
                  e.target.value = "";
                }}
              />
            </label>
            {form.logoDataUrl ? (
              <button type="button" className="btn-ghost" onClick={() => patch("logoDataUrl", undefined)}>
                Remover
              </button>
            ) : null}
          </div>
        </div>
        {logoError ? <p className="mt-2 text-sm text-red">{logoError}</p> : null}
      </section>

      <section className="rounded-2xl border border-line bg-paper p-5">
        <h2 className="text-sm font-semibold">Identificação</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label="CNPJ">
            <input className="input" value={form.cnpj} onChange={(e) => patch("cnpj", e.target.value)} />
          </Field>
          <Field label="Nome da empresa">
            <input className="input" value={form.nome} onChange={(e) => patch("nome", e.target.value)} />
          </Field>
          <Field label="Responsável (recibo)">
            <input
              className="input"
              placeholder="Nome de quem assina"
              value={form.responsavel ?? ""}
              onChange={(e) => patch("responsavel", e.target.value)}
            />
          </Field>
          <Field label="Telefone">
            <input className="input" value={form.telefone} onChange={(e) => patch("telefone", e.target.value)} />
          </Field>
          <Field label="E-mail">
            <input className="input" value={form.email} onChange={(e) => patch("email", e.target.value)} />
          </Field>
          <Field label="Instagram (recibo, opcional)">
            <input
              className="input"
              placeholder="@seuperfil"
              value={form.instagram ?? ""}
              onChange={(e) => patch("instagram", e.target.value)}
            />
          </Field>
          <div className="md:col-span-2">
            <p className="text-xs font-medium text-mute">Chave Pix (cobrança)</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {(Object.keys(pixTipoLabel) as PixTipo[]).map((tipo) => {
                const selected = (form.pixTipo || inferPixTipo(form.pixChave || "")) === tipo;
                return (
                  <button
                    key={tipo}
                    type="button"
                    className={selected ? "btn-primary !px-3 !py-1.5 text-xs" : "btn-ghost !px-3 !py-1.5 text-xs"}
                    onClick={() => setPixTipo(tipo)}
                  >
                    {pixTipoLabel[tipo]}
                  </button>
                );
              })}
            </div>
            {(form.pixTipo || inferPixTipo(form.pixChave || "")) === "copia_e_cola" ? (
              <textarea
                className="input mt-2 min-h-24"
                placeholder="Cole aqui o Pix copia e cola"
                value={form.pixChave ?? ""}
                onChange={(e) => patch("pixChave", e.target.value)}
              />
            ) : (
              <input
                className="input mt-2"
                inputMode={
                  (form.pixTipo || inferPixTipo(form.pixChave || "")) === "email"
                    ? "email"
                    : (form.pixTipo || inferPixTipo(form.pixChave || "")) === "telefone"
                      ? "tel"
                      : "numeric"
                }
                placeholder={pixPlaceholder(form.pixTipo || inferPixTipo(form.pixChave || ""))}
                value={form.pixChave ?? ""}
                onChange={(e) => patch("pixChave", e.target.value)}
              />
            )}
            {(form.pixTipo || inferPixTipo(form.pixChave || "")) === "cnpj" ? (
              <button
                type="button"
                className="btn-ghost mt-2 text-xs"
                onClick={() => patch("pixChave", (form.cnpj || "").replace(/\D/g, ""))}
              >
                Usar CNPJ da empresa
              </button>
            ) : null}
            <p className="mt-1.5 text-xs text-mute">
              No WhatsApp a chave vai igual à cadastrada. CNPJ sai só com os números, para o cliente tocar e copiar.
            </p>
          </div>
          <Field label="Endereço">
            <input className="input" value={form.endereco} onChange={(e) => patch("endereco", e.target.value)} />
          </Field>
          <Field label="Bairro">
            <input className="input" value={form.bairro} onChange={(e) => patch("bairro", e.target.value)} />
          </Field>
          <Field label="Cidade">
            <input className="input" value={form.cidade} onChange={(e) => patch("cidade", e.target.value)} />
          </Field>
          <Field label="UF">
            <input className="input" maxLength={2} value={form.uf} onChange={(e) => patch("uf", e.target.value.toUpperCase())} />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-paper p-5">
        <h2 className="text-sm font-semibold">Tipo e limites</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label="Tipo de empresa">
            <select
              className="input"
              value={form.tipo}
              onChange={(e) => {
                const tipo = e.target.value as CompanyType;
                setForm((prev) => ({ ...prev, tipo, dasPerfil: dasPerfilFromTipo(tipo) }));
              }}
            >
              {(Object.keys(companyTypeLabel) as CompanyType[]).map((key) => (
                <option key={key} value={key}>
                  {companyTypeLabel[key]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Data de abertura">
            <input type="date" className="input" value={form.dataAbertura} onChange={(e) => patch("dataAbertura", e.target.value)} />
          </Field>
          <Field label="Capital social">
            <input
              type="number"
              className="input"
              value={form.capitalSocial}
              onChange={(e) => patch("capitalSocial", Number(e.target.value))}
            />
          </Field>
          <Field label="Limite de faturamento anual">
            <input
              type="number"
              className="input"
              value={form.limiteFaturamento}
              onChange={(e) => patch("limiteFaturamento", Number(e.target.value))}
            />
          </Field>
          <Field label="Perfil do DAS">
            <select
              className="input"
              value={form.dasPerfil ?? dasPerfilFromTipo(form.tipo)}
              onChange={(e) => patch("dasPerfil", e.target.value as DasPerfil)}
            >
              {(Object.keys(dasPerfilLabel) as DasPerfil[]).map((key) => (
                <option key={key} value={key}>
                  {dasPerfilLabel[key]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="mt-3 text-xs text-mute">
          Padrão MEI: {formatMoney(MEI_FATURAMENTO)} de receita no ano e compras até 80% do limite proporcional
          (abertura no meio do ano reduz o teto). Altere o faturamento só se a regra oficial mudar.
        </p>
      </section>

      <section className="rounded-2xl border border-line bg-paper p-5">
        <h2 className="text-sm font-semibold">Acesso em qualquer computador</h2>
        <p className="mt-1 text-sm text-mute">
          Empresa, logo, lançamentos e plano ficam salvos na sua conta online. Entre com o mesmo usuário e senha em
          outro PC — os dados carregam automaticamente.
        </p>
        <p className={`mt-3 text-sm ${syncOk ? "text-green-700" : "text-red"}`}>{syncMsg}</p>
        <p className="mt-4 text-xs text-mute">
          Opcional: exporte um arquivo de backup para arquivar ou migrar fora do site.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" onClick={() => exportBackup()}>
            Exportar backup
          </button>
          <label className="btn-ghost cursor-pointer">
            Importar backup
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  try {
                    importBackup(JSON.parse(String(reader.result)));
                    setBackupMsg("Backup importado e enviado à nuvem.");
                    window.location.reload();
                  } catch {
                    setBackupMsg("Arquivo inválido. Use o JSON gerado em Exportar backup.");
                  }
                };
                reader.readAsText(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {backupMsg ? <p className="mt-2 text-sm text-green">{backupMsg}</p> : null}
      </section>

      <section className="rounded-2xl border border-dashed border-line bg-bg p-5 text-sm text-mute">
        <p className="font-semibold text-ink">Orientações de uso</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Preencha os dados da empresa e suba a logo para importar em relatórios e recibos.</li>
          <li>Lance compras e vendas em Lançamentos — o restante é calculado sozinho.</li>
          <li>O relatório oficial de receitas brutas usa o mês escolhido e a classificação com/sem nota.</li>
          <li>Use os atalhos do dashboard para DAS, declaração anual e NFS-e nacional.</li>
        </ul>
      </section>

      <button
        type="button"
        className="btn-primary"
        onClick={() => {
          const pixTipo = form.pixTipo || inferPixTipo(form.pixChave || "");
          setCompany({
            ...form,
            pixTipo,
            pixChave: normalizePixKey(pixTipo, form.pixChave || ""),
          });
          setSaved(true);
        }}
      >
        Salvar cadastro
      </button>
      {saved ? <p className="text-sm text-green">Cadastro atualizado.</p> : null}

      {user && user.role !== "master" && user.plan !== "contador" ? (
        <section className="rounded-2xl border border-line bg-paper p-5">
          <h2 className="text-sm font-semibold">Convidar o contador</h2>
          <p className="mt-1 text-sm text-mute">
            O escritório entra com o plano PODMEI Contador e passa a ver este CNPJ na carteira. O convite vai para o
            e-mail cadastrado na conta dele.
          </p>
          <form
            className="mt-4 flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setInviteBusy(true);
              setInviteMsg("");
              setInviteErr("");
              void platform
                .inviteAccountant(inviteEmail.trim())
                .then(async (result) => {
                  setInviteMsg(
                    result.emailSent
                      ? `Convite enviado para ${inviteEmail.trim()}.`
                      : result.link
                        ? `O e-mail não saiu. Envie este link: ${result.link}`
                        : "Convite criado, mas o e-mail não saiu.",
                  );
                  setInviteEmail("");
                  const next = await platform.accountantInvites();
                  setInvites(next.sent);
                })
                .catch((err) => setInviteErr(err instanceof Error ? err.message : "Não foi possível enviar."))
                .finally(() => setInviteBusy(false));
            }}
          >
            <label className="min-w-[240px] flex-1 text-sm">
              E-mail do escritório
              <input
                className="input mt-1"
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </label>
            <button className="btn-primary" disabled={inviteBusy}>
              {inviteBusy ? "Enviando…" : "Enviar convite"}
            </button>
          </form>
          {inviteMsg ? <p className="mt-2 text-sm text-green-700">{inviteMsg}</p> : null}
          {inviteErr ? <p className="mt-2 text-sm text-red">{inviteErr}</p> : null}
          {invites.length ? (
            <ul className="mt-3 space-y-1 text-sm text-mute">
              {invites.map((item) => (
                <li key={item.id}>
                  {item.accountantEmail} — {item.status === "aceito" ? "aceito" : item.status === "pendente" ? "aguardando" : item.status}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {user && user.role !== "master" ? (
        <section className="rounded-2xl border border-line bg-paper p-5">
          <h2 className="text-sm font-semibold">Assinatura</h2>
          {sub ? (
            <div className="mt-3 space-y-2 text-sm">
              <p>
                Plano: <strong>{plans[sub.plan]?.name ?? sub.plan}</strong> — {formatMoney(sub.amount)}/
                {sub.cycle === "year" ? "ano" : "mês"}
              </p>
              <p>
                Status: <strong>{statusLabel[sub.status] ?? sub.status}</strong>
                {sub.recurring || sub.mpPreapprovalId ? " · renovação automática" : ""}
              </p>
              {sub.nextDue ? <p className="text-mute">Próximo vencimento: {sub.nextDue}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {sub.status !== "cancelada" ? (
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={subBusy}
                    onClick={() => void onCancelSubscription()}
                  >
                    {subBusy ? "Cancelando…" : "Cancelar assinatura"}
                  </button>
                ) : null}
                {allowsExternalPurchaseUi() || isIosApp() ? (
                  <Link to={`/assinar/${sub.plan === "contador" ? "contador" : sub.plan === "premium" ? "premium" : "pro"}`} className="btn-ghost">
                    Trocar / renovar plano
                  </Link>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-2 text-sm">
              <p className="text-mute">Nenhuma assinatura ativa encontrada nesta conta.</p>
              {allowsExternalPurchaseUi() || isIosApp() ? (
                <Link to="/assinar/pro" className="btn-ghost inline-flex">
                  Ver planos
                </Link>
              ) : null}
            </div>
          )}
          {subMsg ? <p className="mt-2 text-sm text-green-700">{subMsg}</p> : null}
          {subErr ? <p className="mt-2 text-sm text-red">{subErr}</p> : null}
        </section>
      ) : null}

      {user && user.role !== "master" ? (
        <section className="rounded-2xl border border-line bg-paper p-5">
          <h2 className="text-sm font-semibold">Senha de acesso</h2>
          <p className="mt-1 text-sm text-mute">
            Conta <span className="font-medium text-ink">{user.username || user.email}</span>. A nova senha vale no
            próximo login em qualquer computador.
          </p>
          <form className="mt-4 grid max-w-md gap-3" onSubmit={onChangePassword}>
            <Field label="Nova senha">
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Field label="Confirmar senha">
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </Field>
            {passwordError ? <p className="text-sm text-red">{passwordError}</p> : null}
            {passwordOk ? <p className="text-sm text-green-700">{passwordOk}</p> : null}
            <button type="submit" className="btn-primary w-fit" disabled={passwordBusy}>
              {passwordBusy ? "Salvando…" : "Alterar senha"}
            </button>
          </form>
        </section>
      ) : null}

      {user && user.role !== "master" ? (
        <section className="rounded-2xl border border-red/30 bg-paper p-5">
          <h2 className="text-sm font-semibold text-red">Excluir minha conta</h2>
          <p className="mt-1 text-sm text-mute">
            Remove permanentemente o acesso, a assinatura e os dados sincronizados na nuvem. Exporte um backup antes, se
            precisar. Esta ação não pode ser desfeita.
          </p>
          {deleteError ? <p className="mt-2 text-sm text-red">{deleteError}</p> : null}
          <button
            type="button"
            className="btn-ghost mt-3 border border-red/40 text-red"
            disabled={deleteBusy}
            onClick={() => void onDeleteAccount()}
          >
            {deleteBusy ? "Excluindo…" : "Excluir minha conta"}
          </button>
        </section>
      ) : null}
    </div>
  );
}

function pixPlaceholder(tipo: PixTipo) {
  if (tipo === "cnpj") return "Somente números do CNPJ";
  if (tipo === "cpf") return "Somente números do CPF";
  if (tipo === "telefone") return "00 00000-0000";
  if (tipo === "email") return "email@dominio.com";
  return "Cole o Pix copia e cola";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-mute">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function fileToLogoDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 960;
        const maxH = 280;
        const scale = Math.min(1, maxW / img.width, maxH / img.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("Imagem inválida."));
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
