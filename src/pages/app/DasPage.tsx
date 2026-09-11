import { ExternalLink, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { CopyCnpj } from "@/components/CopyCnpj";
import { BackToReports } from "@/components/layout/BackToReports";
import { AlertBanners } from "@/components/alerts/AlertBanners";
import { buildAlerts, visibleAlerts } from "@/lib/alerts";
import {
  dasBreakdown,
  dasCompetenceKey,
  dasDueDate,
  dasPaidMap,
  dasPerfilFromTipo,
  dasPerfilLabel,
  resolveDasPerfil,
  salarioMinimo,
} from "@/lib/das";
import { GOV_LINKS } from "@/lib/mei";
import { printOrSharePdf } from "@/lib/print";
import { useStore } from "@/lib/store";
import type { DasPerfil, Entry } from "@/lib/types";
import { MONTHS, MONTHS_SHORT } from "@/lib/types";
import { cn, currentYear, formatDate, formatMoney, todayIso, uid } from "@/lib/utils";

type PayForm = {
  month: number;
  paidAt: string;
  valorDas: number;
  juros: number;
  multa: number;
  editingId?: string;
};

function labeledMoney(text: string, label: string) {
  const match = text.match(new RegExp(`${label}\\s+R\\$\\s*([\\d.\\s\\u00a0]+,\\d{2})`, "i"));
  if (!match) return 0;
  return Number(match[1].replace(/\./g, "").replace(",", ".")) || 0;
}

export function DasPage() {
  const { company, entries, addEntry, updateEntry, setCompany } = useStore();
  const [year, setYear] = useState(currentYear());
  const years = Array.from({ length: 8 }, (_, i) => currentYear() - i);
  const perfil = resolveDasPerfil(company);
  const calc = dasBreakdown(perfil, year, year === currentYear() ? new Date().getMonth() : 11);
  const paid = useMemo(() => dasPaidMap(entries), [entries]);
  const [saved, setSaved] = useState("");
  const [payForm, setPayForm] = useState<PayForm | null>(null);

  const months = useMemo(() => {
    const today = todayIso();
    return Array.from({ length: 12 }, (_, month) => {
      const key = dasCompetenceKey(year, month);
      const due = dasDueDate(year, month);
      const entry = paid.get(key);
      const late = !entry && due < today;
      return { month, key, due, entry, late };
    });
  }, [paid, year]);

  const pagos = months.filter((m) => m.entry).length;
  const atrasados = months.filter((m) => m.late).length;
  const totalPago = payForm
    ? Math.round((payForm.valorDas + payForm.juros + payForm.multa) * 100) / 100
    : 0;

  function openPay(month: number) {
    const existing = paid.get(dasCompetenceKey(year, month));
    setSaved("");
    if (existing) {
      const juros = labeledMoney(existing.descricao, "juros");
      const multa = labeledMoney(existing.descricao, "multa");
      setPayForm({
        month,
        paidAt: existing.data,
        valorDas: Math.max(0, Math.round((existing.valor - juros - multa) * 100) / 100),
        juros,
        multa,
        editingId: existing.id,
      });
      return;
    }
    setPayForm({
      month,
      paidAt: todayIso(),
      valorDas: dasBreakdown(perfil, year, month).total,
      juros: 0,
      multa: 0,
    });
  }

  function confirmPay() {
    if (!payForm) return;
    const { month, paidAt, juros, multa } = payForm;
    if (!paidAt || totalPago <= 0) return;
    const extras: string[] = [];
    if (juros > 0) extras.push(`juros ${formatMoney(juros)}`);
    if (multa > 0) extras.push(`multa ${formatMoney(multa)}`);
    const ref = `${MONTHS_SHORT[month]}/${year}`;
    const descricao =
      extras.length > 0 ? `DAS MENSAL ${ref} (${extras.join(" + ")})` : `DAS MENSAL ${ref}`;

    const entry: Entry = {
      id: payForm.editingId ?? uid("lan"),
      data: paidAt,
      contraparte: "RECEITA FEDERAL",
      documento: `DAS ${String(month + 1).padStart(2, "0")}/${year}`,
      kind: "despesa",
      valor: totalPago,
      precoUnitario: totalPago,
      quantidade: 1,
      descontoTipo: "reais",
      descontoValor: 0,
      descricao,
      status: "liquidado",
      documentoFiscal: false,
      formaPagamento: "boleto",
      source: "manual",
    };
    if (payForm.editingId) updateEntry(payForm.editingId, entry);
    else addEntry(entry);
    setPayForm(null);
    setSaved(
      `DAS de ${MONTHS[month]} ${payForm.editingId ? "alterado" : "lançado"}: ${formatMoney(totalPago)} em ${formatDate(paidAt)}${
        extras.length ? ` (${extras.join(", ")})` : ""
      }.`,
    );
  }

  return (
    <div className="space-y-6">
      <BackToReports />
      <AlertBanners alerts={visibleAlerts(buildAlerts(company, entries)).filter((a) => a.kind === "das")} />
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Emissão do DAS</h1>
          <p className="mt-1 max-w-2xl text-sm text-mute">
            O boleto oficial só sai no PGMEI da Receita. Aqui você calcula o valor do ano selecionado, controla as competências e
            lança o pagamento no livro-caixa — inclusive com juros e multa de atraso.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block text-xs font-medium text-mute">
            Ano de competência
            <select
              className="input mt-1.5 w-28"
              value={year}
              onChange={(e) => {
                setYear(Number(e.target.value));
                setPayForm(null);
              }}
            >
              {years.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <button className="btn-ghost gap-2" onClick={() => void printOrSharePdf("das-conferencia.pdf")}>
            <Printer className="size-4" />
            PDF A4 conferência
          </button>
          <div className="flex flex-col gap-2">
            <a href={GOV_LINKS.das} target="_blank" rel="noreferrer" className="btn-primary gap-2">
              Emitir no PGMEI
              <ExternalLink className="size-4" />
            </a>
            <CopyCnpj cnpj={company.cnpj} hint="Clique para copiar e colar no PGMEI" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl bg-navy p-5 text-white lg:col-span-2">
          <p className="text-xs text-gold">
            Valor estimado {year} · salário mínimo {formatMoney(salarioMinimo(year, year === currentYear() ? new Date().getMonth() : 11))}
          </p>
          <p className="mt-2 font-display text-4xl">{formatMoney(calc.total)}</p>
          <p className="mt-1 text-sm text-white/70">{dasPerfilLabel[perfil]}</p>
          <dl className="mt-5 grid gap-3 sm:grid-cols-3">
            <DasPart label="INSS (previdência)" value={calc.inss} />
            <DasPart label="ICMS" value={calc.icms} />
            <DasPart label="ISS" value={calc.iss} />
          </dl>
        </section>
        <section className="rounded-2xl border border-line bg-paper p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-mute">No ano {year}</p>
          <p className="mt-2 text-sm">{pagos} de 12 competências lançadas</p>
          <p className={cn("mt-1 text-sm font-semibold", atrasados ? "text-red" : "text-green")}>
            {atrasados ? `${atrasados} em atraso` : "Nenhuma competência atrasada"}
          </p>
          <p className="mt-3 text-xs text-mute">
            CNPJ {company.cnpj}. Vencimento todo dia 20 do mês seguinte (ou próximo dia útil se cair em sábado, domingo ou
            feriado nacional).
          </p>
          {year < currentYear() ? (
            <p className="mt-2 text-xs text-mute">
              Exercício anterior não gera aviso de atraso. Você pode lançar ou alterar o pagamento se quiser o histórico.
            </p>
          ) : null}
        </section>
      </div>

      <section className="no-print rounded-2xl border border-line bg-paper p-5">
        <h2 className="text-sm font-semibold">Atividade para o cálculo</h2>
        <p className="mt-1 text-xs text-mute">
          O valor do DAS não depende do faturamento. Muda só se a atividade tiver ICMS, ISS ou INSS de caminhoneiro.
        </p>
        <select
          className="input mt-3 max-w-lg"
          value={perfil}
          onChange={(e) => setCompany({ ...company, dasPerfil: e.target.value as DasPerfil })}
        >
          {(Object.keys(dasPerfilLabel) as DasPerfil[]).map((key) => (
            <option key={key} value={key}>
              {dasPerfilLabel[key]}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-mute">Sugestão pelo cadastro: {dasPerfilLabel[dasPerfilFromTipo(company.tipo)]}</p>
      </section>

      {payForm ? (
        <section className="no-print rounded-2xl border border-orange bg-paper p-5">
          <h2 className="text-sm font-semibold">
            {payForm.editingId ? "Alterar pagamento" : "Lançar pagamento"} — {MONTHS[payForm.month]}/{year}
          </h2>
          <p className="mt-1 text-xs text-mute">
            Informe a data em que pagou e o valor da guia. Em atraso, some juros e multa conforme o PGMEI.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-xs font-medium text-mute">
              Data do pagamento
              <input
                type="date"
                className="input mt-1.5"
                value={payForm.paidAt}
                onChange={(e) => setPayForm({ ...payForm, paidAt: e.target.value })}
                required
              />
            </label>
            <label className="block text-xs font-medium text-mute">
              Valor do DAS
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="input mt-1.5"
                value={payForm.valorDas || ""}
                onChange={(e) => setPayForm({ ...payForm, valorDas: Number(e.target.value) || 0 })}
              />
            </label>
            <label className="block text-xs font-medium text-mute">
              Juros
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="input mt-1.5"
                value={payForm.juros || ""}
                onChange={(e) => setPayForm({ ...payForm, juros: Number(e.target.value) || 0 })}
                placeholder="0,00"
              />
            </label>
            <label className="block text-xs font-medium text-mute">
              Multa
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="input mt-1.5"
                value={payForm.multa || ""}
                onChange={(e) => setPayForm({ ...payForm, multa: Number(e.target.value) || 0 })}
                placeholder="0,00"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-bg px-4 py-3">
            <p className="text-sm text-mute">
              Vencimento da competência:{" "}
              <strong className="text-ink">{formatDate(dasDueDate(year, payForm.month))}</strong>
              {" · "}
              Total a lançar: <strong className="text-ink">{formatMoney(totalPago)}</strong>
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost" onClick={() => setPayForm(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!payForm.paidAt || totalPago <= 0}
                onClick={confirmPay}
              >
                {payForm.editingId ? "Salvar alteração" : "Confirmar lançamento"}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-line bg-paper">
        <div className="border-b border-line px-4 py-3 text-sm font-semibold">Competências {year}</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-bg text-left text-xs text-mute">
              <tr>
                <th className="px-4 py-2">Competência</th>
                <th>Vencimento</th>
                <th>Valor</th>
                <th>Status</th>
                <th className="no-print" />
              </tr>
            </thead>
            <tbody>
              {months.map((row) => (
                <tr key={row.key} className="border-t border-line">
                  <td className="px-4 py-2.5 font-medium">
                    {MONTHS[row.month]}/{year}
                  </td>
                  <td>{formatDate(row.due)}</td>
                  <td>{formatMoney(row.entry?.valor ?? dasBreakdown(perfil, year, row.month).total)}</td>
                  <td>
                    {row.entry ? (
                      <span className="rounded-full bg-green/15 px-2 py-0.5 text-xs font-semibold text-green">
                        Pago · {formatDate(row.entry.data)}
                      </span>
                    ) : row.late ? (
                      <span className="rounded-full bg-red/15 px-2 py-0.5 text-xs font-semibold text-red">Atrasado</span>
                    ) : (
                      <span className="rounded-full bg-orange/15 px-2 py-0.5 text-xs font-semibold text-orange">
                        Em aberto
                      </span>
                    )}
                  </td>
                  <td className="no-print pr-4 text-right">
                    <button
                      type="button"
                      className={cn("btn-ghost", payForm?.month === row.month && "border-navy text-navy")}
                      onClick={() => openPay(row.month)}
                    >
                      {row.entry ? "Alterar" : "Lançar pagamento"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {saved ? <p className="no-print text-sm text-green">{saved}</p> : null}

      <article className="print-sheet mx-auto max-w-3xl rounded-2xl border border-line bg-paper p-8 text-sm">
        <h2 className="text-center font-display text-2xl text-ink">Conferência do DAS-MEI {year}</h2>
        <p className="mt-2 text-center text-xs text-mute">
          Documento interno. Não substitui a guia gerada no PGMEI.
        </p>
        <div className="mt-6 grid gap-2 border border-ink text-[13px]">
          <Row k="CNPJ" v={company.cnpj} />
          <Row k="Empreendedor" v={company.nome} />
          <Row k="Perfil" v={dasPerfilLabel[perfil]} />
          <Row k="INSS" v={formatMoney(calc.inss)} />
          <Row k="ICMS" v={formatMoney(calc.icms)} />
          <Row k="ISS" v={formatMoney(calc.iss)} />
          <Row k="Total mensal" v={formatMoney(calc.total)} />
        </div>
        <p className="mt-6 text-xs text-mute">
          Base: salário mínimo de {year} ({formatMoney(calc.salarioMinimo)}) e LC 123/2006. Emita e pague somente no portal oficial
          da Receita Federal.
        </p>
      </article>
    </div>
  );
}

function DasPart({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/10 p-3">
      <p className="text-xs text-white/60">{label}</p>
      <p className="mt-1 font-semibold">{value ? formatMoney(value) : "—"}</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[160px_1fr] border-b border-ink last:border-b-0">
      <div className="bg-bg px-3 py-2 font-semibold">{k}</div>
      <div className="px-3 py-2">{v}</div>
    </div>
  );
}
