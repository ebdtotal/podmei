import { useMemo, useState } from "react";
import { BackToReports } from "@/components/layout/BackToReports";
import { monthEntries, officialRevenueRows } from "@/lib/mei";
import { useStore } from "@/lib/store";
import { MONTHS } from "@/lib/types";
import { currentYear, formatMoney } from "@/lib/utils";

export function RelatorioOficialPage() {
  const { company, entries } = useStore();
  const [year, setYear] = useState(currentYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const list = useMemo(() => monthEntries(entries, year, month), [entries, year, month]);
  const rows = officialRevenueRows(list);
  const periodo = `${MONTHS[month].toUpperCase()}/${year}`;

  return (
    <div className="space-y-4">
      <BackToReports />
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Relatório mensal das receitas brutas</h1>
          <p className="mt-1 text-sm text-mute">
            Documento automático no modelo do MEI, a partir das vendas do período.
          </p>
        </div>
        <div className="flex gap-2">
          <select className="input w-auto" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((name, i) => (
              <option key={name} value={i}>
                {name}
              </option>
            ))}
          </select>
          <input
            type="number"
            className="input w-28"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
          <button className="btn-primary" onClick={() => window.print()}>
            Imprimir / PDF
          </button>
        </div>
      </div>

      <article className="print-sheet mx-auto max-w-3xl border border-ink bg-paper p-8 text-[13px] leading-relaxed">
        <h2 className="text-center text-base font-bold tracking-wide">
          RELATÓRIO MENSAL DAS RECEITAS BRUTAS
        </h2>
        <div className="mt-6 grid grid-cols-[160px_1fr] gap-y-2 border border-ink">
          <Cell k="CNPJ" v={company.cnpj} />
          <Cell k="Empreendedor individual" v={company.nome} />
          <Cell k="Período de apuração" v={periodo} />
        </div>

        <Section title="RECEITA BRUTA MENSAL – REVENDA DE MERCADORIAS (COMÉRCIO)">
          <Row n="I" label="Revenda de mercadorias com dispensa de emissão de documento fiscal" value={rows.i} />
          <Row n="II" label="Revenda de mercadorias com documento fiscal emitido" value={rows.ii} />
          <Row n="III" label="Total das receitas com revenda de mercadorias (I + II)" value={rows.iii} bold />
        </Section>
        <Section title="RECEITA BRUTA MENSAL – VENDA DE PRODUTOS INDUSTRIALIZADOS (INDÚSTRIA)">
          <Row n="IV" label="Venda de produtos industrializados com dispensa de emissão de documento fiscal" value={rows.iv} />
          <Row n="V" label="Venda de produtos industrializados com documento fiscal emitido" value={rows.v} />
          <Row n="VI" label="Total das receitas com venda de produtos industrializados (IV + V)" value={rows.vi} bold />
        </Section>
        <Section title="RECEITA BRUTA MENSAL – PRESTAÇÃO DE SERVIÇOS">
          <Row n="VII" label="Receita com prestação de serviços com dispensa de emissão de documento fiscal" value={rows.vii} />
          <Row n="VIII" label="Receita com prestação de serviços com documento fiscal emitido" value={rows.viii} />
          <Row n="IX" label="Total das receitas com prestação de serviços (VII + VIII)" value={rows.ix} bold />
        </Section>
        <Section title="">
          <Row n="X" label="Total geral das receitas brutas no mês (III + VI + IX)" value={rows.x} bold />
        </Section>

        <div className="mt-10 grid grid-cols-2 gap-8">
          <div className="h-24 border border-ink p-2">
            <p className="text-[11px] font-bold">LOCAL E DATA</p>
            <p className="mt-6 text-sm">
              {company.cidade}/{company.uf}
            </p>
          </div>
          <div className="h-24 border border-ink p-2">
            <p className="text-[11px] font-bold">ASSINATURA DO EMPRESÁRIO</p>
          </div>
        </div>
        <p className="mt-6 text-[11px] font-semibold">ENCONTRAM-SE ANEXADOS A ESTE RELATÓRIO:</p>
        <ul className="mt-1 list-disc pl-5 text-[11px]">
          <li>Documentos fiscais das aquisições de mercadorias, insumos e serviços no período.</li>
          <li>Notas fiscais emitidas nas vendas e prestações de serviços do período.</li>
        </ul>
      </article>
    </div>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <>
      <div className="border-b border-ink bg-bg px-2 py-1 font-semibold">{k}</div>
      <div className="border-b border-l border-ink px-2 py-1">{v}</div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      {title ? <p className="mb-1 text-[11px] font-bold">{title}</p> : null}
      <div className="border border-ink">{children}</div>
    </div>
  );
}

function Row({ n, label, value, bold }: { n: string; label: string; value: number; bold?: boolean }) {
  return (
    <div className={`grid grid-cols-[40px_1fr_140px] border-b border-ink last:border-b-0 ${bold ? "font-bold" : ""}`}>
      <div className="border-r border-ink px-2 py-1">{n}</div>
      <div className="border-r border-ink px-2 py-1">{label}</div>
      <div className="px-2 py-1 text-right">{value ? formatMoney(value) : ""}</div>
    </div>
  );
}
