import { Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { BackToReports } from "@/components/layout/BackToReports";
import { dasBreakdown, resolveDasPerfil } from "@/lib/das";
import { IRPF_LIMITE, irpfSplit, presumedProfitRate, yearEntries } from "@/lib/mei";
import { isSimplesNacionalCompany } from "@/lib/plans";
import { printOrSharePdf } from "@/lib/print";
import { useStore } from "@/lib/store";
import type { Company } from "@/lib/types";
import { currentYear, formatMoney } from "@/lib/utils";

const ISENTO_OBRIGATORIO = 200_000;

function dasMonthsInYear(company: Company, year: number) {
  const today = new Date();
  if (year > today.getFullYear()) return [];
  const opened = company.dataAbertura || "";
  const openedYear = Number(opened.slice(0, 4));
  const openedMonth = Number(opened.slice(5, 7));
  let start = 0;
  if (openedYear && openedMonth) {
    if (openedYear > year) return [];
    if (openedYear === year) start = openedMonth - 1;
  }
  const end = year < today.getFullYear() ? 11 : today.getMonth();
  const months: number[] = [];
  for (let month = start; month <= end; month += 1) months.push(month);
  return months;
}

export function IrpfPage() {
  const { company, entries } = useStore();
  const [year, setYear] = useState(currentYear());
  const years = Array.from({ length: 8 }, (_, i) => currentYear() - i);
  const nome = company.nome?.trim() || "informe o nome em Empresa";
  const cnpj = company.cnpj?.trim() || "informe o CNPJ em Empresa";
  const office = isSimplesNacionalCompany(company);

  const report = useMemo(() => {
    const split = irpfSplit(yearEntries(entries, year));
    const monthList = dasMonthsInYear(company, year);
    const perfil = resolveDasPerfil(company);
    const inssParts = monthList.map((month) => dasBreakdown(perfil, year, month).inss);
    const inss = Math.round(inssParts.reduce((acc, value) => acc + value, 0) * 100) / 100;
    const months = monthList.length;
    const inssMes = months ? inssParts[inssParts.length - 1] : dasBreakdown(perfil, year, 0).inss;
    const precisa =
      split.tributavel > IRPF_LIMITE || split.isento > ISENTO_OBRIGATORIO;
    const motivo = precisa
      ? split.tributavel > IRPF_LIMITE
        ? `O rendimento tributável do MEI (${formatMoney(split.tributavel)}) passou de ${formatMoney(IRPF_LIMITE)}.`
        : `Os rendimentos isentos do MEI (${formatMoney(split.isento)}) passaram de ${formatMoney(ISENTO_OBRIGATORIO)}.`
      : `Pela renda do MEI neste ano, o tributável ficou em ${formatMoney(split.tributavel)} (limite ${formatMoney(IRPF_LIMITE)}) e o isento em ${formatMoney(split.isento)}. Isso, sozinho, não obriga a declaração.`;
    return { ...split, months, inssMes, inss, precisa, motivo };
  }, [company, entries, year]);

  if (office) {
    return <Navigate to="/app/relatorios" replace />;
  }

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

      <article className="print-sheet mx-auto max-w-[190mm] space-y-2 bg-white p-4 text-[11px] leading-snug text-[#111]">
        <header>
          <p className="text-[10px] font-semibold uppercase tracking-wide">Ano de competência {year}</p>
          <h2 className="mt-0.5 font-display text-xl">Declaração de IRPF — renda do MEI</h2>
          <p className="mt-1">
            {nome} · CNPJ {cnpj}
          </p>
        </header>

        <section style={{ background: "#fff", color: "#111", border: "1px solid #111", padding: "8px 10px" }}>
          <p className="font-semibold">{report.precisa ? "Precisa declarar" : "Não precisa declarar só pela renda do MEI"}</p>
          <p className="mt-1">{report.motivo}</p>
          <p className="mt-1 text-[10px]">
            Outras regras da Receita (outros rendimentos, bens acima do limite, dependentes) podem exigir a declaração
            mesmo assim. Este relatório usa só o movimento do MEI lançado no PODMEI.
          </p>
        </section>

        <section className="space-y-1">
          <h3 className="font-semibold">Rendimentos recebidos de Pessoa Jurídica</h3>
          <p className="text-[10px]">Programa IRPF: ficha Rendimentos tributáveis recebidos de pessoa jurídica.</p>
          <Field k="CNPJ" v={cnpj} />
          <Field k="Nome" v={nome} />
          <Field k="Valor" v={`${formatMoney(report.tributavel)} (rendimento tributável)`} />
          <Field k="INSS" v={`${formatMoney(report.inss)} (soma do INSS dos DAS de ${year})`} />
        </section>

        <section className="space-y-1">
          <h3 className="font-semibold">Rendimentos isentos e não tributáveis, código 09 — lucros e dividendos</h3>
          <p className="text-[10px]">Programa IRPF: ficha Rendimentos isentos e não tributáveis, código 09.</p>
          <Field k="CNPJ" v={cnpj} />
          <Field k="Nome" v={nome} />
          <Field k="Valor" v={`${formatMoney(report.isento)} (rendimento isento)`} />
        </section>

        <section className="space-y-1">
          <h3 className="font-semibold">Bens e direitos, Grupo 03, código 02 — Quotas ou quinhões de capital</h3>
          <p className="text-[10px]">Programa IRPF: ficha Bens e direitos, grupo 03, código 02.</p>
          <Field k="CNPJ" v={cnpj} />
          <Field k="Discriminação" v={`100% do capital social da "${nome}" CNPJ "${cnpj}"`} />
          <Field k="Situação em 31/12" v={formatMoney(company.capitalSocial || 0)} />
        </section>

        <p className="text-[10px]">
          Sem contabilidade formal, o isento fica limitado a {Math.round(presumedProfitRate("servico") * 100)}% da receita
          de serviços, 16% de transporte de passageiros e 8% das demais. Isento: menor valor entre o lucro líquido (
          {formatMoney(report.lucro)}) e a parcela da receita ({formatMoney(report.revenue)}). O restante do lucro é
          tributável. O INSS é só a parcela previdenciária dos DAS de {year}, sem juros nem multa. Não substitui o contador
          nem a declaração da Receita.
        </p>
      </article>
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[148px_1fr] border border-[#111] text-[11px]" style={{ background: "#fff", color: "#111" }}>
      <div className="border-r border-[#111] px-2 py-1 font-semibold">{k}</div>
      <div className="px-2 py-1">{v}</div>
    </div>
  );
}
