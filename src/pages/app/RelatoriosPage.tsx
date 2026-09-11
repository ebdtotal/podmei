import { BookMarked, BookOpen, FileSpreadsheet, FileText, Receipt, Stamp, Users } from "lucide-react";
import { Link } from "react-router-dom";

const cards = [
  {
    to: "/app/relatorio-oficial",
    icon: FileSpreadsheet,
    title: "Receitas brutas",
    text: "Relatório mensal no modelo do MEI, com e sem documento fiscal.",
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
  },
  {
    to: "/app/dasn",
    icon: Receipt,
    title: "Declaração anual",
    text: "Totais no formato DASN-SIMEI para conferir antes de transmitir.",
  },
  {
    to: "/app/irpf",
    icon: FileText,
    title: "IRPF",
    text: "Se precisa declarar e os valores para o programa da Receita, por ano de competência.",
  },
  {
    to: "/app/folha",
    icon: Users,
    title: "Folha do colaborador",
    text: "Salário, INSS, FGTS e DAE do único empregado permitido ao MEI.",
  },
];

export function RelatoriosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink">Relatórios e obrigações</h1>
        <p className="mt-1 text-sm text-mute">
          DRE, livros, receitas brutas, DAS, IRPF, declaração anual e folha do colaborador. O limite de faturamento fica na
          aba Limites.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
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
    </div>
  );
}
