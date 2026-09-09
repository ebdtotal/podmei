import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useStore } from "@/lib/store";
import type { Contact, ContactKind } from "@/lib/types";
import { todayIso } from "@/lib/utils";

export function QuickContactModal({
  open,
  defaultKind,
  defaultNome = "",
  onClose,
  onCreated,
}: {
  open: boolean;
  defaultKind: ContactKind;
  defaultNome?: string;
  onClose: () => void;
  onCreated: (contact: Contact) => void;
}) {
  const { addContact } = useStore();
  const [kind, setKind] = useState<ContactKind>(defaultKind);
  const [nome, setNome] = useState(defaultNome);
  const [documento, setDocumento] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setKind(defaultKind);
    setNome(defaultNome);
    setDocumento("");
    setTelefone("");
    setEmail("");
    setError("");
  }, [open, defaultKind, defaultNome]);

  function save() {
    const n = nome.trim();
    if (n.length < 2) {
      setError("Informe o nome do cadastro.");
      return;
    }
    const contact = addContact({
      kind,
      nome: n,
      documento: documento.trim(),
      telefone: telefone.trim(),
      email: email.trim(),
      endereco: "",
      cidade: "",
      uf: "SP",
      observacao: "",
      createdAt: todayIso(),
    });
    onCreated(contact);
    onClose();
  }

  return (
    <Modal
      open={open}
      title={kind === "cliente" ? "Cadastrar cliente" : "Cadastrar fornecedor"}
      onClose={onClose}
    >
      <div className="grid gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={kind === "cliente" ? "btn-primary !px-3 !py-2 text-xs" : "btn-ghost !px-3 !py-2 text-xs"}
            onClick={() => setKind("cliente")}
          >
            Cliente
          </button>
          <button
            type="button"
            className={kind === "fornecedor" ? "btn-primary !px-3 !py-2 text-xs" : "btn-ghost !px-3 !py-2 text-xs"}
            onClick={() => setKind("fornecedor")}
          >
            Fornecedor
          </button>
        </div>
        <label className="block text-xs font-medium text-mute">
          Nome / razão social
          <input className="input mt-1" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        <label className="block text-xs font-medium text-mute">
          CPF ou CNPJ
          <input className="input mt-1" value={documento} onChange={(e) => setDocumento(e.target.value)} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-mute">
            Telefone
            <input className="input mt-1" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </label>
          <label className="block text-xs font-medium text-mute">
            E-mail
            <input className="input mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        </div>
        {error ? <p className="text-sm text-red">{error}</p> : null}
        <div className="mt-1 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={save}>
            Salvar cadastro
          </button>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
}
