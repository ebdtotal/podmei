import type { Company, PlanKey } from "./types";

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
    who: "Para o MEI cuidar do essencial do negócio.",
    month: 29.9,
    year: 299,
    href: "/app",
    features: [
      "Cadastro da empresa e tipo de atividade",
      "Clientes, fornecedores, produtos com estoque (histórico, custo médio e margem) e serviços",
      "Dashboard enxuto com limite de R$ 81 mil",
      "Lançamentos manuais, texto e áudio",
      "Leitor de extrato PDF e Excel",
      "Contas a receber e a pagar",
      "Recibos em PDF",
      "Livro-caixa e relatório de receitas brutas",
      "Cálculo do DAS e DASN-SIMEI",
      "Alertas de limite e DAS mensal",
      "1 CNPJ",
    ],
  },
  premium: {
    key: "premium",
    name: "PODMEI Premium",
    who: "Para o MEI que quer caixa, investimentos e visão completa.",
    month: 49.9,
    year: 499,
    popular: true,
    href: "/app",
    features: [
      "Tudo do PODMEI Pro",
      "Dashboard completo e insights",
      "Investimentos (aporte, resgate e rendimento)",
      "Fluxo de caixa com gráficos",
      "Calendário e agendamentos",
      "Metas de faturamento",
      "Folha do colaborador",
      "DRE e livro-razão",
      "Alertas ricos: falta de caixa, a pagar e a receber",
      "Lembretes de eventos por e-mail e celular",
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
      "Recursos do PODMEI Premium nos MEIs da carteira",
      "Carteira com vários CNPJs",
      "Troca de MEI ativo",
      "Honorários e status de cada cliente",
      "Limite, DAS e relatórios de todos os MEIs",
      "Cadastro do escritório e CRC",
      "Cobrança automática por e-mail (3 dias antes, no dia e 3 dias depois)",
    ],
  },
  contador_premium: {
    key: "contador_premium",
    name: "PODMEI Contador Premium",
    who: "Para o escritório no Simples Nacional, com as ferramentas do Premium — sem o teto de R$ 81 mil do MEI.",
    month: 147.9,
    year: 1477,
    href: "/contador",
    features: [
      "Tudo do PODMEI Contador",
      "Ferramentas do MEI Premium (caixa, investimentos, metas, folha, DRE)",
      "Empresa do escritório no Simples Nacional (contador não é MEI)",
      "Sem limite de faturamento de R$ 81 mil",
      "Carteira de clientes MEI e do Simples",
      "Cobrança automática por e-mail nas contas a receber",
      "Cadastro do escritório e CRC",
    ],
  },
};

export const PLAN_KEYS = Object.keys(plans) as PlanKey[];

/** Rotas exclusivas do Premium (e Contador/Master). */
export const PREMIUM_PATH_PREFIXES = [
  "/app/fluxo-caixa",
  "/app/investimentos",
  "/app/calendario",
  "/app/metas",
  "/app/folha",
  "/app/dre",
  "/app/livro-razao",
] as const;

export function normalizePlan(plan: unknown): PlanKey {
  if (plan === "contador_premium") return "contador_premium";
  if (plan === "contador" || plan === "completo") return "contador";
  if (plan === "premium") return "premium";
  return "pro";
}

/** Contador ou Contador Premium (módulo carteira / role contador). */
export function isContadorPlan(plan: unknown): boolean {
  const p = normalizePlan(plan);
  return p === "contador" || p === "contador_premium";
}

export function isPremiumPlan(plan: unknown): boolean {
  return normalizePlan(plan) === "premium";
}

/** Conta com acesso às funções Premium (assinatura Premium, Contador, Contador Premium ou Master). */
export function hasPremiumAccess(user?: { plan?: string; role?: string } | null): boolean {
  if (!user) return false;
  if (user.role === "master" || isContadorPlan(user.plan)) return true;
  return isPremiumPlan(user.plan);
}

/** Empresa do Simples Nacional: sem teto MEI de R$ 81 mil. */
export function isSimplesNacionalCompany(company?: Pick<Company, "regimeTributario"> | null): boolean {
  return company?.regimeTributario === "simples_nacional";
}

export function showsMeiLimits(company?: Pick<Company, "regimeTributario"> | null): boolean {
  return !isSimplesNacionalCompany(company);
}

export function isPremiumPath(pathname: string): boolean {
  return PREMIUM_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function planPrice(key: PlanKey, cycle: "month" | "year" = "month") {
  return cycle === "year" ? plans[key].year : plans[key].month;
}
