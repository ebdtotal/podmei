import { ExternalLink } from "lucide-react";
import { GOV_LINKS } from "@/lib/mei";
import { useStore } from "@/lib/store";

export function NfsePage() {
  const { company } = useStore();
  return (
    <GovCard
      title="Emissor nacional de NFS-e"
      lead="A nota fiscal de serviço do MEI é emitida no Emissor Nacional. Marque “com documento fiscal” no lançamento da venda."
      href={GOV_LINKS.nfse}
      cta="Abrir Emissor Nacional"
    >
      <p>
        Empresa {company.nome}. Depois da emissão, cadastre a venda com NF para o relatório oficial separar as
        linhas VII e VIII.
      </p>
    </GovCard>
  );
}

function GovCard({
  title,
  lead,
  href,
  cta,
  children,
}: {
  title: string;
  lead: string;
  href: string;
  cta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-line bg-paper p-6">
      <h1 className="font-display text-3xl text-ink">{title}</h1>
      <p className="mt-2 text-sm text-mute">{lead}</p>
      <div className="mt-4 text-sm">{children}</div>
      <a href={href} target="_blank" rel="noreferrer" className="btn-primary mt-6 inline-flex gap-2">
        {cta}
        <ExternalLink className="size-4" />
      </a>
    </div>
  );
}
