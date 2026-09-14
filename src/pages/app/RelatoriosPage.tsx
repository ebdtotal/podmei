import { BookMarked, BookOpen, FileSpreadsheet, FileText, Package, Percent, Receipt, Stamp, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { hasPremiumAccess, isPremiumPath, isSimplesNacionalCompany } from "@/lib/plans";
import { useStore } from "@/lib/store";

const cards = [
  {
    to: "/app/fluxo-caixa",
    icon: FileSpreadsheet,
    title: "Fluxo de caixa",
    text: "Entradas, saídas, a receber/pagar e saldo projetado com gráficos.",
  },
  {
    to: "/app/calendario",
    icon: FileText,
    title: "Calendário financeiro",
    text: "Vencimentos de a receber e a pagar por dia.",
  },
  {
    to: "/app/metas",
    icon: Receipt,
    title: "Metas",
    text: "Faturamento do mês e do ano versus meta.",
  },
  {
    to: "/app/estoque",
    icon: Package,
    title: "Estoque",
    text: "Produtos em falta, parados, custo médio e valor parado no estoque.",
  },
  {
    to: "/app/simples",
    icon: Percent,
    title: "Simples Nacional",
    text: "Provisão do imposto (Anexo III) pela RBT12 e alíquota efetiva.",
    officeOnly: true as const,
  },
  {
    to: "/app/relatorio-oficial",
    icon: FileSpreadsheet,
    title: "Receitas brutas",
    text: "Relatório mensal no modelo do MEI, com e sem documento fiscal.",
    meiOnly: true as const,
  },
  {
    to: "/app/dre",
    icon: BookMarked,
    title: "DRE",
    text: "Receita, compras, despesas e resultado do mês ou do ano.",
  },
  {
    to: "/app/livro-caixa",
    icon: BookOpen,
    title: "Livro-caixa",
    text: "Entradas, saídas e saldo acumulado das movimentações liquidadas.",
  },
  {
    to: "/app/livro-razao",
    icon: BookOpen,
    title: "Livro-razão",
    text: "Partidas dobradas por conta: caixa, banco, receitas e despesas.",
  },
  {
    to: "/app/das",
    icon: Stamp,
    title: "DAS mensal",
    text: "Cálculo 2026, competências e emissão no PGMEI.",
    meiOnly: true as const,
  },
  {
    to: "/app/dasn",
    icon: Receipt,
    title: "Declaração anual",
    text: "Totais no formato DASN-SIMEI para conferir antes de transmitir.",
    meiOnly: true as const,
  },
  {
    to: "/app/irpf",
    icon: FileText,
    title: "IRPF",
    text: "Se precisa declarar e os valores para o programa da Receita, por ano de competência.",
    meiOnly: true as const,
  },
  {
    to: "/app/folha",
    icon: Users,
    title: "Folha",
    text: "Salário, INSS, FGTS e provisões dos colaboradores.",
  },
];

export function RelatoriosPage() {
  const { user } = useAuth();
  const { company } = useStore();
  const premium = hasPremiumAccess(user);
  const office = isSimplesNacionalCompany(company);
  const visible = cards.filter((card) => {
    if (!premium && isPremiumPath(card.to)) return false;
    if ("officeOnly" in card && card.officeOnly && !office) return false;
    if ("meiOnly" in card && card.meiOnly && office) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink">Relatórios e obrigações</h1>
        <p className="mt-1 text-sm text-mute">
          {office
            ? "DRE, livros, provisão do Simples Nacional e folha do escritório."
            : premium
              ? "DRE, livros, receitas brutas, DAS, IRPF, declaração anual e folha do colaborador."
              : "Livro-caixa, receitas brutas, DAS, DASN e IRPF. Fluxo, DRE, razão, metas, calendário e folha no Premium."}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="rounded-2xl border border-line bg-paper p-5 transition hover:border-navy"
          >
            <card.icon className="size-6 text-navy" />
            <h2 className="mt-3 font-semibold">{card.title}</h2>
            <p className="mt-1 text-sm text-mute">{card.text}</p>
          </Link>
        ))}
      </div>
      {!premium ? (
        <p className="rounded-2xl border border-line bg-paper px-4 py-3 text-sm text-mute">
          Quer DRE, livro-razão, fluxo de caixa e folha?{" "}
          <Link to="/assinar/premium" className="font-semibold text-navy">
            Assine o Premium
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
