import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Accountant } from "@/lib/types";

export function EscritorioPage() {
  const { accountant, setAccountant, resetDemo } = useStore();
  const [form, setForm] = useState<Accountant>(accountant);
  const [saved, setSaved] = useState(false);

  function patch<K extends keyof Accountant>(key: K, value: Accountant[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink">Dados do escritório</h1>
        <p className="mt-1 text-sm text-mute">
          Identificação do contador responsável pela carteira de MEIs neste aparelho.
        </p>
      </div>
      <section className="rounded-2xl border border-line bg-paper p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Escritório">
            <input className="input" value={form.escritorio} onChange={(e) => patch("escritorio", e.target.value)} />
          </Field>
          <Field label="Contador responsável">
            <input className="input" value={form.nome} onChange={(e) => patch("nome", e.target.value)} />
          </Field>
          <Field label="CRC">
            <input className="input" value={form.crc} onChange={(e) => patch("crc", e.target.value)} />
          </Field>
          <Field label="Telefone">
            <input className="input" value={form.telefone} onChange={(e) => patch("telefone", e.target.value)} />
          </Field>
          <Field label="E-mail">
            <input className="input md:col-span-1" value={form.email} onChange={(e) => patch("email", e.target.value)} />
          </Field>
        </div>
        <button
          type="button"
          className="btn-primary mt-5"
          onClick={() => {
            setAccountant(form);
            setSaved(true);
          }}
        >
          Salvar escritório
        </button>
        {saved ? <p className="mt-2 text-sm text-green">Dados do escritório atualizados.</p> : null}
      </section>
      <section className="rounded-2xl border border-dashed border-line bg-bg p-5 text-sm text-mute">
        <p className="font-semibold text-ink">Como usar a carteira</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Cadastre cada CNPJ em Carteira. O MEI ativo alimenta lançamentos, DAS, DRE e livros.</li>
          <li>Troque de empresa pelo seletor no topo do app do MEI, ou volte para a carteira.</li>
          <li>Exporte a carteira inteira ou o JSON de um único MEI em Empresa.</li>
        </ul>
        <button
          type="button"
          className="btn-ghost mt-4"
          onClick={() => {
            if (confirm("Restaurar a carteira de demonstração? Os MEIs atuais deste navegador serão substituídos.")) {
              resetDemo();
              window.location.reload();
            }
          }}
        >
          Restaurar dados de exemplo
        </button>
      </section>
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
