import { Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { BackToReports } from "@/components/layout/BackToReports";
import { dasBreakdown, resolveDasPerfil } from "@/lib/das";
import { IRPF_LIMITE, irpfSplit, presumedProfitRate, yearEntries } from "@/lib/mei";
import { printOrSharePdf } from "@/lib/print";
import { useStore } from "@/lib/store";
import type { Company } from "@/lib/types";
import { currentYear, formatMoney } from "@/lib/utils";

const ISENTO_OBRIGATORIO = 200_000;

function dasMonthsInYear(company: Company, year: number) {
  const today = new Date();
  if (year > today.getFullYear()) return 0;
  const opened = company.dataAbertura || "";
  const openedYear = Number(opened.slice(0, 4));
  const openedMonth = Number(opened.slice(5, 7));
  let start = 0;
  if (openedYear && openedMonth) {
    if (openedYear > year) return 0;
    if (openedYear === year) start = openedMonth - 1;
  }
  const end = year < today.getFullYear() ? 11 : today.getMonth();
  return Math.max(0, end - start + 1);
}

export function IrpfPage() {
  const { company, entries } = useStore();
  const [year, setYear] = useState(currentYear());
  const years = Array.from({ length: 8 }, (_, i) => currentYear() - i);
  const nome = company.nome?.trim() || "informe o nome em Empresa";
  const cnpj = company.cnpj?.trim() || "informe o CNPJ em Empresa";

  const report = useMemo(() => {
    const split = irpfSplit(yearEntries(entries, year));
    const months = dasMonthsInYear(company, year);
    const inssMes = dasBreakdown(resolveDasPerfil(company)).inss;
    const inss = Math.round(months * inssMes * 100) / 100;
    const precisa =
      split.tributavel > IRPF_LIMITE || split.isento > ISENTO_OBRIGATORIO;
    const motivo = precisa
      ? split.tributavel > IRPF_LIMITE
        ? `O rendimento tributável do MEI (${formatMoney(split.tributavel)}) passou de ${formatMoney(IRPF_LIMITE)}.`
        : `Os rendimentos isentos do MEI (${formatMoney(split.isento)}) passaram de ${formatMoney(ISENTO_OBRIGATORIO)}.`
      : `Pela renda do MEI neste ano, o tributável ficou em ${formatMoney(split.tributavel)} (limite ${formatMoney(IRPF_LIMITE)}) e o isento em ${formatMoney(split.isento)}. Isso, sozinho, não obriga a declaração.`;
    return { ...split, months, inssMes, inss, precisa, motivo };
  }, [company, entries, year]);

  return (
    <div className="space-y-4">
      <BackToReports />
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">IRPF</h1>
          <p className="mt-1 max-w-2xl text-sm text-mute">
            Conferência da renda do MEI para o programa da Receita. Informe cada valor na aba indicada.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block text-xs font-medium text-mute">
            Ano de competência
            <select className="input mt-1.5 w-28" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <button className="btn-primary gap-2" onClick={() => void printOrSharePdf(`IRPF-${year}.pdf`)}>
            <Printer className="size-4" />
            Emitir PDF
          </button>
        </div>
      </div>

      <article className="print-sheet mx-auto max-w-3xl space-y-5 rounded-2xl border border-line bg-paper p-6 text-sm text-ink">
        <header>
          <p className="text-xs font-semibold uppercase tracking-wide text-mute">Ano de competência {year}</p>
          <h2 className="mt-1 font-display text-2xl">Declaração de IRPF — renda do MEI</h2>
          <p className="mt-2 text-mute">
            {nome} · CNPJ {cnpj}
          </p>
        </header>

        <section
          className={
            report.precisa
              ? "rounded-2xl border border-red/40 bg-red/10 px-4 py-3"
              : "rounded-2xl border border-green/40 bg-green/10 px-4 py-3"
          }
        >
          <p className="font-semibold">{report.precisa ? "Precisa declarar" : "Não precisa declarar só pela renda do MEI"}</p>
          <p className="mt-1 text-mute">{report.motivo}</p>
          <p className="mt-2 text-xs text-mute">
            Outras regras da Receita (outros rendimentos, bens acima do limite, dependentes) podem exigir a declaração
            mesmo assim. Este relatório usa só o movimento do MEI lançado no PODMEI.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold">Rendimentos recebidos de Pessoa Jurídica</h3>
          <p className="text-xs text-mute">Programa IRPF: ficha Rendimentos tributáveis recebidos de pessoa jurídica.</p>
          <Field k="CNPJ" v={cnpj} />
          <Field k="Nome" v={nome} />
          <Field k="Valor" v={`${formatMoney(report.tributavel)} (rendimento tributável)`} />
          <Field
            k="INSS"
            v={`${formatMoney(report.inss)} (soma do INSS dos DAS de ${year}: ${report.months} × ${formatMoney(report.inssMes)})`}
          />
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold">Rendimentos isentos e não tributáveis, código 09 — lucros e dividendos</h3>
          <p className="text-xs text-mute">Programa IRPF: ficha Rendimentos isentos e não tributáveis, código 09.</p>
          <Field k="CNPJ" v={cnpj} />
          <Field k="Nome" v={nome} />
          <Field k="Valor" v={`${formatMoney(report.isento)} (rendimento isento)`} />
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold">Bens e direitos, Grupo 03, código 02 — Quotas ou quinhões de capital</h3>
          <p className="text-xs text-mute">Programa IRPF: ficha Bens e direitos, grupo 03, código 02.</p>
          <Field k="CNPJ" v={cnpj} />
          <Field k="Discriminação" v={`100% do capital social da "${nome}" CNPJ "${cnpj}"`} />
          <Field k="Situação em 31/12" v={formatMoney(company.capitalSocial || 0)} />
          {!company.capitalSocial ? (
            <p className="text-xs text-mute">Informe o capital social no cadastro da empresa para preencher este valor.</p>
          ) : null}
        </section>

        <p className="text-xs text-mute">
          Sem contabilidade formal, a parcela isenta de lucros do MEI fica limitada a 32% da receita de serviços, 16% de
          transporte de passageiros e 8% de comércio, indústria e transporte de cargas (alíquota usada no app:{" "}
          {Math.round(presumedProfitRate("servico") * 100)}% serviços). O rendimento isento é o menor valor entre o lucro
          líquido ({formatMoney(report.lucro)}) e essa parcela da receita ({formatMoney(report.revenue)} de faturamento). O
          restante do lucro é o rendimento tributável. O INSS é a parcela previdenciária de cada DAS mensal do ano-base, não
          juros nem multa. Não substitui a orientação do contador nem a declaração transmitida à Receita.
        </p>
      </article>
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] border border-line text-[13px] sm:grid-cols-[180px_1fr]">
      <div className="bg-bg px-3 py-2 font-semibold">{k}</div>
      <div className="px-3 py-2">{v}</div>
    </div>
  );
}
