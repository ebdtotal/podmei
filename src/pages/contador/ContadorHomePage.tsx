import { Briefcase, Building2, LayoutDashboard } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

function officeClientId(clients: ReturnType<typeof useStore>["clients"]) {
  return (
    clients.find((c) => c.company.regimeTributario === "simples_nacional" && c.status === "ativo")?.id ||
    clients.find((c) => c.company.regimeTributario === "simples_nacional")?.id ||
    ""
  );
}

export function ContadorHomePage() {
  const { user } = useAuth();
  const { accountant, clients, selectClient } = useStore();
  const navigate = useNavigate();
  const isPremium = user?.plan === "contador_premium";
  const meis = clients.filter((c) => c.company.regimeTributario !== "simples_nacional");
  const ativos = meis.filter((c) => c.status === "ativo").length;

  if (!isPremium) {
    return <Navigate to="/contador/carteira" replace />;
  }

  function openOffice() {
    const id = officeClientId(clients);
    if (id) selectClient(id);
    navigate("/app");
  }

  const cards = [
    {
      key: "escritorio-gestao",
      title: "Meu escritório",
      text: "Gestão financeira do Contador Premium: dashboard, Simples Nacional, folha, caixa e relatórios.",
      icon: LayoutDashboard,
      onClick: openOffice,
      tone: "purple" as const,
    },
    {
      key: "carteira",
      title: "Carteira de MEIs",
      text: `Lista dos MEIs da carteira${ativos ? ` · ${ativos} ativo${ativos === 1 ? "" : "s"}` : ""}. Abra cada CNPJ no menu Premium da empresa.`,
      icon: Briefcase,
      to: "/contador/carteira",
      tone: "orange" as const,
    },
    {
      key: "dados",
      title: "Escritório",
      text: "Dados do contador, CRC, CNPJ do escritório, Pix, logo e assinatura.",
      icon: Building2,
      to: "/contador/escritorio",
      tone: "ink" as const,
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange">Contador Premium</p>
        <h1 className="font-display text-3xl text-ink">{accountant.escritorio || "Seu escritório"}</h1>
        <p className="mt-1 text-sm text-mute">
          Escolha onde entrar: finanças do escritório (roxo), carteira de MEIs (azul) ou dados cadastrais.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => {
          const inner = (
            <>
              <span
                className={cn(
                  "grid size-12 place-items-center rounded-2xl text-white",
                  card.tone === "purple" && "bg-navy",
                  card.tone === "orange" && "bg-orange",
                  card.tone === "ink" && "bg-ink",
                )}
              >
                <card.icon className="size-6" />
              </span>
              <h2 className="mt-4 font-display text-xl text-ink">{card.title}</h2>
              <p className="mt-2 text-sm text-mute">{card.text}</p>
            </>
          );
          if (card.onClick) {
            return (
              <button
                key={card.key}
                type="button"
                onClick={card.onClick}
                className="rounded-3xl border border-line bg-paper p-6 text-left transition hover:border-navy hover:shadow-sm"
              >
                {inner}
              </button>
            );
          }
          return (
            <Link
              key={card.key}
              to={card.to!}
              className="rounded-3xl border border-line bg-paper p-6 transition hover:border-navy hover:shadow-sm"
            >
              {inner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
