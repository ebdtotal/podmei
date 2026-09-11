import { useState } from "react";

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
}

export function CopyCnpj({ cnpj, hint }: { cnpj: string; hint: string }) {
  const [copied, setCopied] = useState(false);
  const digits = cnpj.replace(/\D/g, "");
  if (!digits) return null;

  return (
    <button
      type="button"
      className="rounded-2xl border border-line bg-paper px-3 py-2 text-left"
      onClick={() => {
        void navigator.clipboard.writeText(digits).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        });
      }}
    >
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-mute">CNPJ</span>
      <span className="block font-semibold text-ink">{formatCnpj(digits)}</span>
      <span className="mt-0.5 block text-[11px] text-mute">{copied ? "Copiado" : hint}</span>
    </button>
  );
}
