import { useMemo, useState, type ReactNode } from "react";
import { ContactRound, Pencil, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Contact, ContactKind } from "@/lib/types";
import { cn, todayIso } from "@/lib/utils";

const emptyForm = (kind: ContactKind): Omit<Contact, "id"> => ({
  kind,
  nome: "",
  documento: "",
  telefone: "",
  email: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cep: "",
  cidade: "",
  uf: "SP",
  observacao: "",
  createdAt: todayIso(),
});

export function CadastrosPage() {
  const { contacts, addContact, updateContact, removeContact } = useStore();
  const [kind, setKind] = useState<ContactKind>("cliente");
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm("cliente"));
  const [notice, setNotice] = useState("");

  const list = useMemo(() => {
    const t = q.toLowerCase();
    return contacts
      .filter((c) => c.kind === kind)
      .filter(
        (c) =>
          !t ||
          c.nome.toLowerCase().includes(t) ||
          c.documento.toLowerCase().includes(t) ||
          c.cidade.toLowerCase().includes(t) ||
          c.email.toLowerCase().includes(t) ||
          c.telefone.includes(t) ||
          (c.endereco || "").toLowerCase().includes(t) ||
          (c.bairro || "").toLowerCase().includes(t) ||
          (c.cep || "").includes(t),
      )
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [contacts, kind, q]);

  const clientes = contacts.filter((c) => c.kind === "cliente").length;
  const fornecedores = contacts.filter((c) => c.kind === "fornecedor").length;

  function patch<K extends keyof Contact>(key: K, value: Contact[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function reset(nextKind = kind) {
    setEditingId(null);
    setForm(emptyForm(nextKind));
  }

  function startEdit(contact: Contact) {
    setKind(contact.kind);
    setEditingId(contact.id);
    setForm({
      kind: contact.kind,
      nome: contact.nome,
      documento: contact.documento,
      telefone: contact.telefone,
      email: contact.email,
      endereco: contact.endereco,
      numero: contact.numero || "",
      complemento: contact.complemento || "",
      bairro: contact.bairro || "",
      cep: contact.cep || "",
      cidade: contact.cidade,
      uf: contact.uf,
      observacao: contact.observacao,
      createdAt: contact.createdAt,
    });
  }

  function save() {
    const nome = form.nome.trim();
    if (nome.length < 2) {
      setNotice("Informe o nome do cadastro.");
      return;
    }
    if (editingId) {
      updateContact(editingId, { ...form, nome, kind });
      setNotice("Cadastro atualizado.");
    } else {
      addContact({ ...form, nome, kind });
      setNotice(`${kind === "cliente" ? "Cliente" : "Fornecedor"} cadastrado.`);
    }
    reset(kind);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink">Clientes e fornecedores</h1>
        <p className="mt-1 text-sm text-mute">
          Cadastro essencial para preencher lançamentos, contas a receber e a pagar e os relatórios.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Mini label="Clientes" value={clientes} />
        <Mini label="Fornecedores" value={fornecedores} />
      </div>

      {notice ? <p className="rounded-xl border border-gold bg-paper px-4 py-3 text-sm">{notice}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={cn("rounded-full px-4 py-1.5 text-sm font-semibold", kind === "cliente" ? "bg-navy text-white" : "btn-ghost")}
          onClick={() => {
            setKind("cliente");
            if (!editingId) setForm(emptyForm("cliente"));
          }}
        >
          Clientes
        </button>
        <button
          type="button"
          className={cn("rounded-full px-4 py-1.5 text-sm font-semibold", kind === "fornecedor" ? "bg-navy text-white" : "btn-ghost")}
          onClick={() => {
            setKind("fornecedor");
            if (!editingId) setForm(emptyForm("fornecedor"));
          }}
        >
          Fornecedores
        </button>
      </div>

      <section className="rounded-2xl border border-line bg-paper p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-navy text-white">
            <ContactRound className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold">{editingId ? "Editar cadastro" : `Novo ${kind}`}</h2>
            <p className="mt-1 text-sm text-mute">Nome, documento, contato e endereço. O restante fica opcional.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label="Nome / razão social">
            <input className="input" value={form.nome} onChange={(e) => patch("nome", e.target.value)} />
          </Field>
          <Field label="CPF ou CNPJ">
            <input className="input" value={form.documento} onChange={(e) => patch("documento", e.target.value)} />
          </Field>
          <Field label="Telefone">
            <input className="input" value={form.telefone} onChange={(e) => patch("telefone", e.target.value)} />
          </Field>
          <Field label="E-mail">
            <input className="input" type="email" value={form.email} onChange={(e) => patch("email", e.target.value)} />
          </Field>
          <Field label="CEP">
            <input className="input" inputMode="numeric" value={form.cep} onChange={(e) => patch("cep", e.target.value)} />
          </Field>
          <Field label="Logradouro">
            <input className="input" value={form.endereco} onChange={(e) => patch("endereco", e.target.value)} />
          </Field>
          <Field label="Número">
            <input className="input" value={form.numero} onChange={(e) => patch("numero", e.target.value)} />
          </Field>
          <Field label="Complemento">
            <input className="input" value={form.complemento} onChange={(e) => patch("complemento", e.target.value)} />
          </Field>
          <Field label="Bairro">
            <input className="input" value={form.bairro} onChange={(e) => patch("bairro", e.target.value)} />
          </Field>
          <div className="grid grid-cols-[1fr_5rem] gap-3">
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
          </div>
          <Field label="Observação">
            <input className="input md:col-span-2" value={form.observacao} onChange={(e) => patch("observacao", e.target.value)} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-primary gap-2" onClick={save}>
            <Plus className="size-4" />
            {editingId ? "Salvar alterações" : `Cadastrar ${kind}`}
          </button>
          {editingId ? (
            <button type="button" className="btn-ghost" onClick={() => reset(kind)}>
              Cancelar edição
            </button>
          ) : null}
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{kind === "cliente" ? "Clientes cadastrados" : "Fornecedores cadastrados"}</h2>
        <input
          className="input max-w-xs"
          placeholder="Buscar nome, documento, cidade…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-navy text-white">
            <tr className="text-left text-xs">
              <th className="px-3 py-3">Nome</th>
              <th>Documento</th>
              <th>Telefone</th>
              <th>E-mail</th>
              <th>Endereço</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-mute" colSpan={6}>
                  Nenhum {kind} cadastrado nesta lista.
                </td>
              </tr>
            ) : (
              list.map((c, i) => (
                <tr key={c.id} className={cn(i % 2 ? "bg-bg/70" : "bg-paper")}>
                  <td className="px-3 py-2 font-medium">{c.nome}</td>
                  <td>{c.documento || "—"}</td>
                  <td>{c.telefone || "—"}</td>
                  <td>{c.email || "—"}</td>
                  <td>{formatAddress(c) || "—"}</td>
                  <td className="pr-3 text-right">
                    <button type="button" className="mr-2 text-xs font-semibold text-navy" onClick={() => startEdit(c)}>
                      <Pencil className="mr-1 inline size-3.5" />
                      Editar
                    </button>
                    <button
                      type="button"
                      className="text-xs text-red"
                      onClick={() => {
                        if (window.confirm(`Excluir ${c.nome}? Lançamentos já feitos permanecem.`)) {
                          removeContact(c.id);
                          if (editingId === c.id) reset(kind);
                        }
                      }}
                    >
                      <Trash2 className="mr-1 inline size-3.5" />
                      Excluir
                    </button>
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

function formatAddress(c: Contact) {
  const street = [c.endereco, c.numero, c.complemento].filter(Boolean).join(", ");
  const place = [c.bairro, [c.cidade, c.uf].filter(Boolean).join("/"), c.cep].filter(Boolean).join(" · ");
  return [street, place].filter(Boolean).join(" — ");
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-paper px-4 py-4">
      <p className="text-xs uppercase tracking-wide text-mute">{label}</p>
      <p className="font-display text-3xl text-ink">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-medium text-mute">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}
