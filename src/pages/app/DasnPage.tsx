import { ExternalLink, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { BackToReports } from "@/components/layout/BackToReports";
import { dasnSummary, excessBand, GOV_LINKS, proportionalLimit, totalExpenses, totalRevenue, yearEntries } from "@/lib/mei";
import { printOrSharePdf } from "@/lib/print";
import { useStore } from "@/lib/store";
import { cn, currentYear, formatMoney } from "@/lib/utils";

export function DasnPage() {
  const { company, entries } = useStore();
  const [year, setYear] = useState(currentYear());
  const [empregado, setEmpregado] = useState(false);
  const list = useMemo(() => yearEntries(entries, year), [entries, year]);
  const dasn = dasnSummary(list);
  const receita = totalRevenue(list);
  const despesas = totalExpenses(list);
  const limite = proportionalLimit(company, year);
  const band = excessBand(receita, limite);
  const prazo = `31/05/${year + 1}`;

  return (
    <div className="space-y-6">
      <BackToReports />
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Declaração anual DASN-SIMEI</h1>
          <p className="mt-1 max-w-2xl text-sm text-mute">
            Totais no formato da declaração. A transmissão é feita no portal da Receita; o app monta os números a
            partir dos lançamentos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="number"
            className="input w-28"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
          <button type="button" className="btn-ghost gap-2" onClick={() => void printOrSharePdf("dasn.pdf")}>
            <Printer className="size-4" />
            Imprimir planilha
          </button>
          <a href={GOV_LINKS.dasn} target="_blank" rel="noreferrer" className="btn-primary gap-2">
            Transmitir no DASN-SIMEI
            <ExternalLink className="size-4" />
          </a>
        </div>
      </div>

      <div className="no-print grid gap-4 md:grid-cols-3">
        <Card label={`Receita bruta ${year}`} value={formatMoney(receita)} />
        <Card label="Comércio / indústria / cargas" value={formatMoney(dasn.comercioIndustria)} />
        <Card label="Prestação de serviços" value={formatMoney(dasn.servicos)} />
      </div>

      <div
        className={cn(
          "no-print rounded-2xl px-4 py-3 text-sm font-semibold text-white",
          band.band === "ok" ? "bg-green" : band.band === "sublimite" ? "bg-orange" : "bg-red",
        )}
      >
        {band.band === "ok"
          ? `Dentro do limite proporcional de ${formatMoney(limite)}.`
          : band.band === "sublimite"
            ? `Estourou o limite em até 20% (${formatMoney(band.over)}). Na DASN há acréscimo e o desenquadramento vale a partir de janeiro seguinte.`
            : `Estouro acima de 20% (${formatMoney(band.over)}). Risco de desenquadramento retroativo. Procure o contador antes de transmitir.`}
      </div>

      <section className="no-print rounded-2xl border border-line bg-paper p-5">
        <h2 className="text-sm font-semibold">Pergunta da declaração</h2>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={empregado} onChange={(e) => setEmpregado(e.target.checked)} />
          Informar que houve empregado no ano-calendário {year}
        </label>
        <p className="mt-2 text-xs text-mute">
          Prazo ordinário: {prazo}. Despesas lançadas no ano: {formatMoney(despesas)} (informação gerencial; a DASN
          pede receita por atividade e empregado).
        </p>
      </section>

      <article className="print-sheet mx-auto max-w-3xl border border-ink bg-paper p-6 text-[12px] leading-snug print:p-0">
        <h2 className="text-center text-sm font-bold tracking-wide sm:text-base">
          PLANILHA DE APOIO — DASN-SIMEI {year}
        </h2>
        <p className="mt-1 text-center text-[10px] text-mute">Não substitui a declaração transmitida no e-CAC / DASN-SIMEI</p>
        <div className="mt-4 grid grid-cols-[180px_1fr] border border-ink">
          <Cell k="CNPJ" v={company.cnpj} />
          <Cell k="Empreendedor individual" v={company.nome} />
          <Cell k="Ano-calendário" v={String(year)} />
          <Cell k="Prazo de entrega" v={prazo} />
        </div>
        <div className="mt-4 border border-ink">
          <div className="bg-bg px-3 py-1.5 text-[10px] font-bold">VALOR DA RECEITA BRUTA TOTAL</div>
          <Line n="1" label="Receita bruta de comércio, indústria e transporte de cargas" value={dasn.comercioIndustria} />
          <Line n="2" label="Receita bruta de prestação de serviços" value={dasn.servicos} />
          <Line n="3" label="Receita bruta total (1 + 2)" value={receita} bold />
        </div>
        <div className="mt-4 border border-ink">
          <div className="bg-bg px-3 py-1.5 text-[10px] font-bold">INFORMAÇÕES COMPLEMENTARES</div>
          <div className="grid grid-cols-[1fr_120px] border-t border-ink">
            <div className="border-r border-ink px-3 py-1.5">Possuiu empregado durante o ano-calendário?</div>
            <div className="px-3 py-1.5 text-right font-semibold">{empregado ? "SIM" : "NÃO"}</div>
          </div>
          <div className="grid grid-cols-[1fr_120px] border-t border-ink">
            <div className="border-r border-ink px-3 py-1.5">Limite proporcional do MEI no ano</div>
            <div className="px-3 py-1.5 text-right">{formatMoney(limite)}</div>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="h-20 border border-ink p-2">
            <p className="text-[10px] font-bold">LOCAL E DATA</p>
            <p className="mt-4 text-sm">
              {company.cidade}/{company.uf}
            </p>
          </div>
          <div className="h-20 border border-ink p-2">
            <p className="text-[10px] font-bold">ASSINATURA DO EMPRESÁRIO</p>
          </div>
        </div>
      </article>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-paper p-4">
      <p className="text-xs text-mute">{label}</p>
      <p className="mt-1 font-display text-2xl text-ink">{value}</p>
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

function Line({ n, label, value, bold }: { n: string; label: string; value: number; bold?: boolean }) {
  return (
    <div className={`grid grid-cols-[40px_1fr_140px] border-t border-ink ${bold ? "font-bold" : ""}`}>
      <div className="border-r border-ink px-2 py-1">{n}</div>
      <div className="border-r border-ink px-2 py-1">{label}</div>
      <div className="px-2 py-1 text-right">{formatMoney(value)}</div>
    </div>
  );
}
