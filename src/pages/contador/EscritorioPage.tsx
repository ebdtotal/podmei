import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { allowsExternalPurchaseUi, isIosApp } from "@/lib/native";
import { plans } from "@/lib/plans";
import { platform } from "@/lib/platform";
import type { Subscription } from "@/lib/platform-types";
import { useStore } from "@/lib/store";
import type { Accountant, Company, PixTipo } from "@/lib/types";
import { inferPixTipo, normalizePixKey, pixTipoLabel } from "@/lib/charge";
import { stripLogoBackground } from "@/lib/logo";
import { formatMoney } from "@/lib/utils";
import { BiometricSettings } from "@/components/auth/BiometricSettings";
import { DateBrInput } from "@/components/ui/DateBrInput";
import { MoneyBrInput } from "@/components/ui/MoneyBrInput";

const statusLabel: Record<string, string> = {
  ativa: "Ativa (recorrente)",
  atrasada: "Em atraso",
  cancelada: "Cancelada",
  pendente: "Pendente",
};

function pixPlaceholder(tipo: PixTipo) {
  if (tipo === "cnpj") return "CNPJ só números";
  if (tipo === "cpf") return "CPF só números";
  if (tipo === "telefone") return "DDD + número";
  if (tipo === "email") return "e-mail da chave Pix";
  return "Pix copia e cola";
}

async function fileToLogoDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}

export function EscritorioPage() {
  const { accountant, setAccountant, company, setCompany, exportBackup, importBackup, resetDemo } = useStore();
  const { user, refresh, logout } = useAuth();
  const isPremium = user?.plan === "contador_premium";
  const [accForm, setAccForm] = useState<Accountant>(accountant);
  const [form, setForm] = useState<Company>({
    ...company,
    regimeTributario: "simples_nacional",
    limiteFaturamento: 0,
  });
  const [saved, setSaved] = useState(false);
  const [logoError, setLogoError] = useState("");
  const [logoPreview, setLogoPreview] = useState(company.logoDataUrl ?? "");
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

  useEffect(() => {
    setAccForm(accountant);
  }, [accountant]);

  useEffect(() => {
    setForm({
      ...company,
      regimeTributario: "simples_nacional",
      limiteFaturamento: 0,
    });
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

  function patchAcc<K extends keyof Accountant>(key: K, value: Accountant[K]) {
    setAccForm((prev) => ({ ...prev, [key]: value }));
  }

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

  function saveAll() {
    if (isPremium) {
      const pixTipo = form.pixTipo || inferPixTipo(form.pixChave || "");
      const nomeEscritorio = form.nome || accForm.escritorio || "Escritório Contábil";
      setCompany({
        ...form,
        regimeTributario: "simples_nacional",
        limiteFaturamento: 0,
        pixTipo,
        pixChave: normalizePixKey(pixTipo, form.pixChave || ""),
        nome: nomeEscritorio,
      });
      setAccountant({
        ...accForm,
        escritorio: nomeEscritorio,
        email: form.email || accForm.email,
        assinaturaEmail: accForm.assinaturaEmail ?? "",
      });
    } else {
      setAccountant(accForm);
    }
    setSaved(true);
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
    const confirmText = window.prompt("Digite EXCLUIR para confirmar a exclusão da conta:");
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
        <h1 className="font-display text-3xl text-ink">Escritório</h1>
        <p className="mt-1 text-sm text-mute">
          {isPremium
            ? "Dados do contador e da empresa do escritório no Simples Nacional — sem teto de R$ 81 mil do MEI."
            : "Identificação do contador responsável pela carteira de MEIs."}
        </p>
      </div>

      {!isPremium ? (
        <section className="rounded-2xl border border-line bg-paper p-5">
          <h2 className="text-sm font-semibold">Contador responsável</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="Escritório">
              <input className="input" value={accForm.escritorio} onChange={(e) => patchAcc("escritorio", e.target.value)} />
            </Field>
            <Field label="Nome do contador">
              <input className="input" value={accForm.nome} onChange={(e) => patchAcc("nome", e.target.value)} />
            </Field>
            <Field label="CRC">
              <input className="input" value={accForm.crc} onChange={(e) => patchAcc("crc", e.target.value)} />
            </Field>
            <Field label="Telefone">
              <input className="input" value={accForm.telefone} onChange={(e) => patchAcc("telefone", e.target.value)} />
            </Field>
            <Field label="E-mail">
              <input className="input" value={accForm.email} onChange={(e) => patchAcc("email", e.target.value)} />
            </Field>
          </div>
        </section>
      ) : null}

      {isPremium ? (
        <>
          <section className="rounded-2xl border border-line bg-paper p-5">
            <h2 className="text-sm font-semibold">Logo da empresa</h2>
            <p className="mt-1 text-xs text-mute">
              PNG horizontal, <strong className="text-ink">720 × 200 px</strong>. Usada em recibos e documentos.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <div className="grid h-[72px] w-[260px] place-items-center overflow-hidden rounded-xl bg-[#070b14] px-3">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="max-h-[52px] max-w-[230px] object-contain" />
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
                      void fileToLogoDataUrl(file)
                        .then(stripLogoBackground)
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
            <h2 className="text-sm font-semibold">Meu escritório</h2>
            <p className="mt-1 text-xs text-mute">
              Contador não é MEI. Estes dados alimentam recibos, cobranças e a contabilidade da própria empresa.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Field label="CNPJ">
                <input className="input" value={form.cnpj} onChange={(e) => patch("cnpj", e.target.value)} />
              </Field>
              <Field label="Nome da empresa">
                <input className="input" value={form.nome} onChange={(e) => patch("nome", e.target.value)} />
              </Field>
              <Field label="Nome do Contador">
                <input
                  className="input"
                  placeholder="Nome do contador"
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
                <Field label="Assinatura dos e-mails de cobrança">
                  <textarea
                    className="input min-h-28"
                    placeholder={"Ex.:\nAtenciosamente,\nFulano — CRC …\nEscritório XYZ\n(11) 99999-0000"}
                    value={accForm.assinaturaEmail ?? ""}
                    onChange={(e) => patchAcc("assinaturaEmail", e.target.value)}
                  />
                </Field>
                <p className="mt-1.5 text-xs text-mute">
                  Aparece no final dos avisos automáticos (3 dias antes, no dia e 3 dias após o vencimento). Só no Contador
                  Premium.
                </p>
              </div>
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
                    placeholder={pixPlaceholder(form.pixTipo || inferPixTipo(form.pixChave || ""))}
                    value={form.pixChave ?? ""}
                    onChange={(e) => patch("pixChave", e.target.value)}
                  />
                )}
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
                <input
                  className="input"
                  maxLength={2}
                  value={form.uf}
                  onChange={(e) => patch("uf", e.target.value.toUpperCase())}
                />
              </Field>
              <Field label="Data de abertura">
                <DateBrInput
                  className="input"
                  value={form.dataAbertura || ""}
                  onChange={(dataAbertura) => patch("dataAbertura", dataAbertura)}
                />
              </Field>
              <Field label="Capital social">
                <MoneyBrInput
                  className="input"
                  value={form.capitalSocial || 0}
                  onChange={(capitalSocial) => patch("capitalSocial", capitalSocial)}
                  min={0}
                />
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-paper p-5">
            <h2 className="text-sm font-semibold">Acesso e backup</h2>
            <p className={`mt-2 text-sm ${syncOk ? "text-green-700" : "text-red"}`}>{syncMsg}</p>
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
                        setBackupMsg("Arquivo inválido.");
                      }
                    };
                    reader.readAsText(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {backupMsg ? <p className="mt-2 text-sm text-mute">{backupMsg}</p> : null}
          </section>

          <BiometricSettings />

          {user && user.role !== "master" ? (
            <section className="rounded-2xl border border-line bg-paper p-5">
              <h2 className="text-sm font-semibold">Senha de acesso</h2>
              <form className="mt-3 grid max-w-md gap-3" onSubmit={onChangePassword}>
                <input
                  type="password"
                  className="input"
                  placeholder="Nova senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <input
                  type="password"
                  className="input"
                  placeholder="Confirmar senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button type="submit" className="btn-ghost w-fit" disabled={passwordBusy}>
                  {passwordBusy ? "Salvando…" : "Alterar senha"}
                </button>
                {passwordError ? <p className="text-sm text-red">{passwordError}</p> : null}
                {passwordOk ? <p className="text-sm text-green">{passwordOk}</p> : null}
              </form>
            </section>
          ) : null}

          {sub ? (
            <section className="rounded-2xl border border-line bg-paper p-5">
              <h2 className="text-sm font-semibold">Assinatura</h2>
              <p className="mt-2 text-sm">
                {plans[sub.plan]?.name ?? sub.plan} · {statusLabel[sub.status] ?? sub.status} ·{" "}
                {formatMoney(sub.amount)}
                {sub.cycle === "year" ? "/ano" : "/mês"}
              </p>
              {allowsExternalPurchaseUi() && !isIosApp() ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to={`/assinar/${sub.plan}`} className="btn-ghost">
                    Renovar / alterar
                  </Link>
                  {sub.status === "ativa" ? (
                    <button type="button" className="btn-ghost" disabled={subBusy} onClick={() => void onCancelSubscription()}>
                      Cancelar assinatura
                    </button>
                  ) : null}
                </div>
              ) : null}
              {subMsg ? <p className="mt-2 text-sm text-green">{subMsg}</p> : null}
              {subErr ? <p className="mt-2 text-sm text-red">{subErr}</p> : null}
            </section>
          ) : null}

          {user && user.role !== "master" ? (
            <section className="rounded-2xl border border-red/30 bg-paper p-5">
              <h2 className="text-sm font-semibold text-red">Excluir conta</h2>
              <button type="button" className="btn-ghost mt-3 text-red" disabled={deleteBusy} onClick={() => void onDeleteAccount()}>
                {deleteBusy ? "Excluindo…" : "Excluir conta permanentemente"}
              </button>
              {deleteError ? <p className="mt-2 text-sm text-red">{deleteError}</p> : null}
            </section>
          ) : null}
        </>
      ) : (
        <section className="rounded-2xl border border-dashed border-line bg-bg p-5 text-sm text-mute">
          <p className="font-semibold text-ink">Como usar a carteira</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Cadastre cada CNPJ em Carteira. O MEI ativo alimenta lançamentos, DAS, DRE e livros.</li>
            <li>Troque de empresa pelo seletor no topo do app do MEI, ou volte para a carteira.</li>
          </ul>
          <button
            type="button"
            className="btn-ghost mt-4"
            onClick={() => {
              if (confirm("Restaurar a carteira de demonstração?")) {
                resetDemo();
                window.location.reload();
              }
            }}
          >
            Restaurar dados de exemplo
          </button>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" onClick={saveAll}>
          Salvar escritório
        </button>
        {saved ? <p className="text-sm text-green">Dados salvos.</p> : null}
      </div>
    </div>
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
