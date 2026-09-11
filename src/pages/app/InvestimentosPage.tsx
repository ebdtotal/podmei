import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { DateBrInput } from "@/components/ui/DateBrInput";
import { Modal } from "@/components/ui/Modal";
import { MoneyBrInput } from "@/components/ui/MoneyBrInput";
import { investmentBalance, investmentsSummary, yieldLabel } from "@/lib/investments";
import { useStore } from "@/lib/store";
import type { InvestmentMoveKind, InvestmentYieldKind } from "@/lib/types";
import { addDaysIso, cn, formatDate, formatMoney, todayIso } from "@/lib/utils";

type FormState = {
  kind: InvestmentMoveKind;
  investmentId: string;
  nome: string;
  instituicao: string;
  yieldKind: InvestmentYieldKind;
  taxa: string;
  prazoDias: string;
  vencimento: string;
  data: string;
  valor: number;
  observacao: string;
};

const emptyForm = (): FormState => ({
  kind: "aporte",
  investmentId: "",
  nome: "CDB",
  instituicao: "",
  yieldKind: "pos_cdi",
  taxa: "100",
  prazoDias: "",
  vencimento: "",
  data: todayIso(),
  valor: 0,
  observacao: "",
});

function moveLabel(kind: InvestmentMoveKind) {
  if (kind === "aporte") return "Aporte";
  if (kind === "resgate") return "Resgate";
  return "Rendimento";
}

export function InvestimentosPage() {
  const {
    investments,
    investmentMovements,
    addInvestment,
    addInvestmentMovement,
    removeInvestment,
    removeInvestmentMovement,
  } = useStore();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [notice, setNotice] = useState("");

  const summary = useMemo(
    () => investmentsSummary(investments, investmentMovements),
    [investments, investmentMovements],
  );

  const moves = useMemo(
    () => [...investmentMovements].sort((a, b) => b.data.localeCompare(a.data) || b.createdAt.localeCompare(a.createdAt)),
    [investmentMovements],
  );

  function openForm(kind: InvestmentMoveKind = "aporte") {
    setForm({ ...emptyForm(), kind });
    setFormOpen(true);
    setNotice("");
  }

  function selectExisting(id: string) {
    const inv = investments.find((i) => i.id === id);
    if (!inv) {
      setForm((f) => ({ ...f, investmentId: "" }));
      return;
    }
    setForm((f) => ({
      ...f,
      investmentId: inv.id,
      nome: inv.nome,
      instituicao: inv.instituicao,
      yieldKind: inv.yieldKind,
      taxa: String(inv.taxa).replace(".", ","),
      prazoDias: inv.prazoDias ? String(inv.prazoDias) : "",
      vencimento: inv.vencimento || "",
    }));
  }

  function save(e: FormEvent) {
    e.preventDefault();
    if (form.valor <= 0 || !form.data) return;
    if (form.kind === "aporte" && (!form.nome.trim() || !form.instituicao.trim())) return;
    if ((form.kind === "resgate" || form.kind === "rendimento") && !form.investmentId) return;

    const taxa = Number(String(form.taxa).replace(",", ".")) || 0;
    let investmentId = form.investmentId;

    if (form.kind === "aporte" && !investmentId) {
      const created = addInvestment({
        nome: form.nome.trim(),
        instituicao: form.instituicao.trim(),
        yieldKind: form.yieldKind,
        taxa,
        prazoDias: form.prazoDias ? Math.max(1, Math.floor(Number(form.prazoDias))) : undefined,
        vencimento: form.vencimento || undefined,
      });
      investmentId = created.id;
    }

    if (!investmentId) return;

    if (form.kind === "resgate") {
      const saldo = investmentBalance(investmentMovements, investmentId);
      if (form.valor > saldo + 0.009) {
        setNotice(`Saldo investido insuficiente (${formatMoney(saldo)}).`);
        return;
      }
    }

    addInvestmentMovement({
      investmentId,
      kind: form.kind,
      data: form.data,
      valor: form.valor,
      observacao: form.observacao.trim() || undefined,
    });

    setFormOpen(false);
    setForm(emptyForm());
    setNotice(`${moveLabel(form.kind)} registrado.`);
  }

  const selectedInv = form.investmentId ? investments.find((i) => i.id === form.investmentId) : null;
  const canSave =
    form.valor > 0 &&
    Boolean(form.data) &&
    (form.kind === "aporte"
      ? form.nome.trim().length > 1 && form.instituicao.trim().length > 1
      : Boolean(form.investmentId));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Investimentos</h1>
          <p className="mt-1 max-w-2xl text-sm text-mute">
            Aportes, resgates e rendimentos de renda fixa (CDB, RDB e similares). Aporte e resgate movem o caixa
            operacional; rendimento fica no saldo investido e não entra como receita do MEI.
          </p>
        </div>
        <button type="button" className="btn-primary gap-2" onClick={() => openForm("aporte")}>
          <Plus className="size-4" />
          Lançar
        </button>
      </div>

      {notice ? <p className="text-sm text-green">{notice}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Saldo investido" value={summary.total} tone="text-navy" />
        <Kpi label="Aportes" value={summary.aportes} tone="text-orange" />
        <Kpi label="Resgates" value={summary.resgates} tone="text-green" />
        <Kpi label="Rendimentos" value={summary.rendimentos} tone="text-ink" />
      </div>

      <section className="rounded-2xl border border-line bg-paper">
        <div className="border-b border-line px-4 py-3 text-sm font-semibold">Posições</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="text-left text-xs text-mute">
              <tr>
                <th className="px-4 py-2">Investimento</th>
                <th>Instituição</th>
                <th>Rentabilidade</th>
                <th>Prazo / vencimento</th>
                <th>Saldo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {summary.rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-mute" colSpan={6}>
                    Nenhum investimento ainda. Lance um aporte para começar.
                  </td>
                </tr>
              ) : (
                summary.rows.map(({ investment: inv, saldo }) => (
                  <tr key={inv.id} className="border-t border-line">
                    <td className="px-4 py-3 font-medium">{inv.nome}</td>
                    <td>{inv.instituicao}</td>
                    <td>{yieldLabel(inv)}</td>
                    <td>
                      {inv.vencimento
                        ? formatDate(inv.vencimento)
                        : inv.prazoDias
                          ? `${inv.prazoDias} dias`
                          : "—"}
                    </td>
                    <td className="font-semibold">{formatMoney(saldo)}</td>
                    <td className="pr-3 text-right">
                      <button
                        type="button"
                        className="btn-ghost !px-2 text-xs"
                        onClick={() => {
                          setForm({
                            ...emptyForm(),
                            kind: "aporte",
                            investmentId: inv.id,
                            nome: inv.nome,
                            instituicao: inv.instituicao,
                            yieldKind: inv.yieldKind,
                            taxa: String(inv.taxa).replace(".", ","),
                            prazoDias: inv.prazoDias ? String(inv.prazoDias) : "",
                            vencimento: inv.vencimento || "",
                          });
                          setFormOpen(true);
                          setNotice("");
                        }}
                      >
                        Movimentar
                      </button>
                      <button
                        type="button"
                        className="btn-ghost !px-2 text-red"
                        aria-label="Excluir investimento"
                        onClick={() => {
                          if (confirm(`Excluir ${inv.nome} e todos os movimentos?`)) removeInvestment(inv.id);
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-paper">
        <div className="border-b border-line px-4 py-3 text-sm font-semibold">Movimentos</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="text-left text-xs text-mute">
              <tr>
                <th className="px-4 py-2">Data</th>
                <th>Tipo</th>
                <th>Investimento</th>
                <th>Valor</th>
                <th>Detalhe</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {moves.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-mute" colSpan={6}>
                    Sem movimentos.
                  </td>
                </tr>
              ) : (
                moves.map((m) => {
                  const inv = investments.find((i) => i.id === m.investmentId);
                  return (
                    <tr key={m.id} className="border-t border-line">
                      <td className="px-4 py-3">{formatDate(m.data)}</td>
                      <td>{moveLabel(m.kind)}</td>
                      <td>{inv ? `${inv.nome} · ${inv.instituicao}` : "—"}</td>
                      <td className="font-medium">{formatMoney(m.valor)}</td>
                      <td className="text-xs text-mute">{m.observacao || "—"}</td>
                      <td className="pr-3 text-right">
                        <button
                          type="button"
                          className="btn-ghost !px-2 text-red"
                          aria-label="Excluir movimento"
                          onClick={() => {
                            if (confirm("Excluir este movimento?")) removeInvestmentMovement(m.id);
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={formOpen} title="Lançar investimento" onClose={() => setFormOpen(false)}>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={save}>
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-xs font-medium text-mute">Tipo</p>
            <div className="flex rounded-full border border-line bg-bg p-0.5" role="group">
              {(["aporte", "resgate", "rendimento"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={
                    form.kind === k
                      ? "btn-primary flex-1 !px-2 !py-2 text-xs"
                      : "btn-ghost flex-1 !px-2 !py-2 text-xs border-0"
                  }
                  aria-pressed={form.kind === k}
                  onClick={() => setForm({ ...form, kind: k })}
                >
                  {moveLabel(k)}
                </button>
              ))}
            </div>
          </div>

          {form.kind !== "aporte" || investments.length > 0 ? (
            <label className="block text-xs font-medium text-mute sm:col-span-2">
              {form.kind === "aporte" ? "Posição existente (opcional)" : "Posição"}
              <select
                className="input mt-1.5"
                value={form.investmentId}
                onChange={(e) => selectExisting(e.target.value)}
                required={form.kind !== "aporte"}
              >
                <option value="">{form.kind === "aporte" ? "Nova posição" : "Selecione…"}</option>
                {investments.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.nome} · {inv.instituicao} ({formatMoney(investmentBalance(investmentMovements, inv.id))})
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {form.kind === "aporte" && !form.investmentId ? (
            <>
              <label className="block text-xs font-medium text-mute">
                Investimento
                <input
                  className="input mt-1.5"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="CDB, RDB, Tesouro…"
                  required
                />
              </label>
              <label className="block text-xs font-medium text-mute">
                Instituição
                <input
                  className="input mt-1.5"
                  value={form.instituicao}
                  onChange={(e) => setForm({ ...form, instituicao: e.target.value })}
                  placeholder="Banco / corretora"
                  required
                />
              </label>
              <div className="sm:col-span-2">
                <p className="mb-1.5 text-xs font-medium text-mute">Rentabilidade</p>
                <div className="flex rounded-full border border-line bg-bg p-0.5" role="group">
                  <button
                    type="button"
                    className={
                      form.yieldKind === "pos_cdi"
                        ? "btn-primary flex-1 !px-3 !py-2 text-xs"
                        : "btn-ghost flex-1 !px-3 !py-2 text-xs border-0"
                    }
                    onClick={() => setForm({ ...form, yieldKind: "pos_cdi", taxa: form.taxa || "100" })}
                  >
                    Pós-fixada (CDI)
                  </button>
                  <button
                    type="button"
                    className={
                      form.yieldKind === "pre"
                        ? "btn-primary flex-1 !px-3 !py-2 text-xs"
                        : "btn-ghost flex-1 !px-3 !py-2 text-xs border-0"
                    }
                    onClick={() => setForm({ ...form, yieldKind: "pre" })}
                  >
                    Pré-fixada
                  </button>
                </div>
              </div>
              <label className="block text-xs font-medium text-mute sm:col-span-2">
                {form.yieldKind === "pos_cdi" ? "% do CDI" : "Taxa % a.a."}
                <input
                  className="input mt-1.5"
                  inputMode="decimal"
                  value={form.taxa}
                  onChange={(e) => setForm({ ...form, taxa: e.target.value })}
                  placeholder={form.yieldKind === "pos_cdi" ? "100" : "12,5"}
                  required
                />
              </label>
              <label className="block text-xs font-medium text-mute">
                Prazo (dias)
                <input
                  className="input mt-1.5"
                  type="number"
                  min="1"
                  value={form.prazoDias}
                  onChange={(e) => {
                    const prazoDias = e.target.value;
                    const days = Math.floor(Number(prazoDias) || 0);
                    setForm({
                      ...form,
                      prazoDias,
                      vencimento: days > 0 ? addDaysIso(form.data, days) : form.vencimento,
                    });
                  }}
                  placeholder="Ex.: 365"
                />
              </label>
              <label className="block text-xs font-medium text-mute">
                Vencimento
                <DateBrInput
                  className="input mt-1.5"
                  value={form.vencimento}
                  onChange={(iso) => setForm({ ...form, vencimento: iso })}
                />
              </label>
            </>
          ) : null}

          {form.kind !== "aporte" && selectedInv ? (
            <p className="text-xs text-mute sm:col-span-2">
              {yieldLabel(selectedInv)}
              {selectedInv.vencimento ? ` · vence ${formatDate(selectedInv.vencimento)}` : ""}
            </p>
          ) : null}

          <label className="block text-xs font-medium text-mute">
            Data
            <DateBrInput
              className="input mt-1.5"
              value={form.data}
              onChange={(iso) => setForm({ ...form, data: iso || form.data })}
              required
            />
          </label>
          <label className="block text-xs font-medium text-mute">
            Valor
            <MoneyBrInput className="input mt-1.5" value={form.valor} onChange={(valor) => setForm({ ...form, valor })} />
          </label>
          <label className="block text-xs font-medium text-mute sm:col-span-2">
            Observação
            <input
              className="input mt-1.5"
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
              placeholder="Opcional"
            />
          </label>

          {!canSave ? (
            <p className="text-xs text-orange sm:col-span-2">
              {form.kind === "aporte"
                ? "Informe investimento, instituição, data e valor."
                : "Selecione a posição, data e valor."}
            </p>
          ) : null}

          <div className="flex gap-2 sm:col-span-2">
            <button type="button" className="btn-ghost flex-1" onClick={() => setFormOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={!canSave}>
              Salvar {moveLabel(form.kind).toLowerCase()}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-line bg-paper px-4 py-3">
      <p className="text-xs text-mute">{label}</p>
      <p className={cn("mt-1 font-display text-2xl", tone)}>{formatMoney(value)}</p>
    </div>
  );
}
