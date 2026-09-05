import type { PlanKey } from "./types";

export const plans: Record<
  PlanKey,
  {
    key: PlanKey;
    name: string;
    who: string;
    month: number;
    year: number;
    popular?: boolean;
    href: "/app" | "/contador";
    features: string[];
  }
> = {
  pro: {
    key: "pro",
    name: "PODMEI Pro",
    who: "Para o MEI cuidar do próprio negócio.",
    month: 29.9,
    year: 299,
    popular: true,
    href: "/app",
    features: [
      "Cadastro da empresa e tipo de atividade",
      "Cadastro de clientes e fornecedores",
      "Dashboard com limite de R$ 81 mil",
      "Lançamentos manuais, texto e áudio",
      "Leitor de extrato PDF e Excel",
      "Contas a receber e a pagar",
      "Recibos em PDF",
      "DRE, livro-caixa e livro-razão",
      "Relatório mensal de receitas brutas",
      "Cálculo do DAS, DASN e folha (1 empregado)",
      "1 CNPJ",
    ],
  },
  contador: {
    key: "contador",
    name: "PODMEI Contador",
    who: "Para o escritório administrar a carteira de MEIs.",
    month: 97.9,
    year: 977,
    href: "/contador",
    features: [
      "Tudo do PODMEI Pro",
      "Carteira com vários CNPJs",
      "Troca de MEI ativo",
      "Honorários e status de cada cliente",
      "Limite, DAS e relatórios de todos os MEIs",
      "Cadastro do escritório e CRC",
    ],
  },
};

export const PLAN_KEYS = Object.keys(plans) as PlanKey[];

export function normalizePlan(plan: unknown): PlanKey {
  if (plan === "contador" || plan === "completo") return "contador";
  return "pro";
}

export function planPrice(key: PlanKey, cycle: "month" | "year" = "month") {
  return cycle === "year" ? plans[key].year : plans[key].month;
}
