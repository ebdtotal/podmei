import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Plus, Printer, UserRound } from "lucide-react";
import { FolhaPrintSheet } from "@/components/folha/FolhaPrintSheet";
import { HoleriteSheet } from "@/components/folha/HoleriteSheet";
import { SALARIO_MINIMO } from "@/lib/das";
import { printOrSharePdf } from "@/lib/print";
import {
  buildPayroll,
  calcPayroll,
  daeDueDate,
  daeExpense,
  hasActiveEmployee,
  legalSalaryFloor,
  payrollKindLabel,
  payrollMap,
  payrollMapKey,
  salaryDueDate,
  salaryExpense,
  salaryOutOfMeiRange,
} from "@/lib/folha";
import { GOV_LINKS } from "@/lib/mei";
import { useAuth } from "@/lib/auth";
import { isSimplesNacionalCompany } from "@/lib/plans";
import { useStore } from "@/lib/store";
import type { Employee, PayrollKind, PayrollRun } from "@/lib/types";
import { MONTHS } from "@/lib/types";
import { MoneyBrInput } from "@/components/ui/MoneyBrInput";
import { DateBrInput } from "@/components/ui/DateBrInput";
import { cn, currentYear, formatDate, formatMoney, todayIso, uid } from "@/lib/utils";

export function FolhaPage() {
  const { user } = useAuth();
  const { company, employee, employees, payrolls, setEmployee, upsertEmployee, upsertPayroll, addEntry } = useStore();
  const multi = isSimplesNacionalCompany(company) || user?.plan === "contador_premium";
  const year = currentYear();
  const activeList = useMemo(
    () => (employees?.length ? employees : employee ? [employee] : []).filter((e) => e.status === "ativo"),
    [employees, employee],
  );
  const [selectedId, setSelectedId] = useState<string>("");
  const selected =
    activeList.find((e) => e.id === selectedId) || activeList[0] || (hasActiveEmployee(employee) ? employee : null);
  const [kind, setKind] = useState<PayrollKind>("mensal");
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [extras, setExtras] = useState(0);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState("");
  const today = todayIso();
  const map = useMemo(() => payrollMap(payrolls), [payrolls]);

  useEffect(() => {
    if (selected && selectedId !== selected.id) setSelectedId(selected.id);
  }, [selected, selectedId]);

  useEffect(() => {
    if (!multi && !hasActiveEmployee(employee)) setEditing(true);
  }, [multi, employee]);

  const existing = selected
    ? map.get(payrollMapKey(selected.id, year, month, kind))
    : undefined;
  const preview = hasActiveEmployee(selected) ? calcPayroll({ employee: selected, year, month, kind, extras }) : null;
  const display = existing && extras === existing.extras ? existing : preview;
  const salaryDue = salaryDueDate(year, month);
  const daeDue = daeDueDate(year, month);
  const range =
    hasActiveEmployee(selected) && !multi ? salaryOutOfMeiRange(selected) : null;

  function saveRun(next: PayrollRun, message: string) {
    upsertPayroll(next);
    setNotice(message);
  }

  function generate() {
    if (!hasActiveEmployee(selected) || !preview) return;
    const next = buildPayroll({
      employee: selected,
      year,
      month,
      kind,
      extras,
      existing,
    });
    saveRun(next, `${payrollKindLabel[kind]} de ${MONTHS[month]} pronta para conferência.`);
  }

  function paySalary() {
    if (!existing || existing.salaryPaid) return;
    const entry = salaryExpense(existing, salaryDue < today ? salaryDue : today);
    addEntry(entry);
    saveRun({ ...existing, salaryPaid: true, salaryEntryId: entry.id }, "Salário lançado como despesa.");
  }

  function payDae() {
    if (!existing || existing.daePaid) return;
    const entry = daeExpense(existing, daeDue < today ? daeDue : today);
    addEntry(entry);
    saveRun({ ...existing, daePaid: true, daeEntryId: entry.id }, "DAE lançado como despesa. A guia oficial sai só no eSocial.");
  }

  const emptyState = !hasActiveEmployee(selected) && activeList.length === 0;

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">{multi ? "Folha de colaboradores" : "Folha do colaborador"}</h1>
          <p className="mt-1 max-w-2xl text-sm text-mute">
            {multi
              ? "Escritório no Simples Nacional: cadastre quantos colaboradores precisar. Calcule holerite, provisione 13º e férias e lance o pagamento."
              : "O MEI pode ter no máximo um empregado, no salário mínimo ou no piso da categoria. Aqui você calcula o holerite 2026, provisiona 13º e férias e lança o pagamento no livro-caixa. A guia DAE sai no eSocial Web MEI."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {multi ? (
            <button
              type="button"
              className="btn-primary gap-2"
              onClick={() => {
                setAdding(true);
                setEditing(false);
              }}
            >
              <Plus className="size-4" />
              Novo colaborador
            </button>
          ) : null}
          <button
            type="button"
            className="btn-ghost gap-2 disabled:opacity-50"
            disabled={!display || !selected}
            onClick={() => void printOrSharePdf("folha-pagamento.pdf", ".print-sheet")}
          >
            <Printer className="size-4" />
            Folha pgto
          </button>
          <button
            type="button"
            className="btn-ghost gap-2 disabled:opacity-50"
            disabled={!display || !selected}
            onClick={() => void printOrSharePdf("holerite.pdf", ".print-holerite")}
          >
            <Printer className="size-4" />
            Holerite
          </button>
          <a href={GOV_LINKS.esocialFolha} target="_blank" rel="noreferrer" className="btn-primary gap-2">
            Abrir eSocial
            <ExternalLink className="size-4" />
          </a>
        </div>
      </div>

      {notice ? <p className="no-print rounded-xl border border-gold bg-paper px-4 py-3 text-sm">{notice}</p> : null}

      {multi && activeList.length > 0 ? (
        <div className="no-print flex flex-wrap gap-2">
          {activeList.map((e) => (
            <button
              key={e.id}
              type="button"
              className={selected?.id === e.id ? "btn-primary" : "btn-ghost"}
              onClick={() => {
                setSelectedId(e.id);
                setAdding(false);
                setEditing(false);
              }}
            >
              {e.nome}
            </button>
          ))}
        </div>
      ) : null}

      {adding ? (
        <section className="no-print rounded-2xl border border-line bg-paper p-5">
          <h2 className="font-semibold">Novo colaborador</h2>
          <EmployeeForm
            key="novo-multi"
            initial={emptyEmployee()}
            allowAnySalary={multi}
            onSave={(next) => {
              upsertEmployee(next);
              setSelectedId(next.id);
              setAdding(false);
              setNotice(`${next.nome} cadastrado.`);
            }}
            onCancel={() => setAdding(false)}
          />
        </section>
      ) : null}

      {emptyState && !adding ? (
        <section className="no-print rounded-2xl border border-line bg-paper p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-navy text-gold">
              <UserRound className="size-5" />
            </span>
            <div>
              <h2 className="font-semibold">
                {multi ? "Nenhum colaborador cadastrado" : "Este MEI ainda não tem colaborador"}
              </h2>
              <p className="mt-1 text-sm text-mute">
                {multi
                  ? "Cadastre a equipe do escritório. Não há limite de colaboradores no Contador Premium."
                  : "Sem empregado, não há folha nem eSocial. Cadastre o único colaborador permitido. Depois da admissão formal no eSocial, use esta tela todo mês."}
              </p>
            </div>
          </div>
          {!multi && employee && employee.status === "desligado" ? (
            <p className="mt-4 rounded-lg bg-bg px-3 py-2 text-sm">
              Último colaborador: {employee.nome}, desligado em {formatDate(employee.dataDesligamento || today)}.
              Você pode admitir outro — o MEI continua limitado a um por vez.
            </p>
          ) : null}
          <EmployeeForm
            key={employee?.id ?? "novo"}
            initial={employee && employee.status === "desligado" ? emptyEmployee() : (employee ?? emptyEmployee())}
            allowAnySalary={multi}
            onSave={(next) => {
              if (multi) upsertEmployee(next);
              else setEmployee(next);
              setSelectedId(next.id);
              setEditing(false);
              setNotice(`${next.nome} cadastrado.`);
            }}
          />
        </section>
      ) : hasActiveEmployee(selected) && !adding ? (
        <>
          <section className="no-print rounded-2xl border border-line bg-paper p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-mute">Colaborador de {company.nome}</p>
                <h2 className="mt-1 font-display text-2xl text-ink">{selected.nome}</h2>
                <p className="text-sm text-mute">
                  {selected.cargo} · CPF {selected.cpf} · admitido em {formatDate(selected.dataAdmissao)} ·{" "}
                  {selected.jornada === "44h" ? "44h semanais" : "jornada parcial"}
                </p>
                <p className="mt-2 text-sm">
                  Salário {formatMoney(selected.salario)}
                  {selected.valeTransporte ? ` · vale-transporte ${formatMoney(selected.valeTransporte)}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-ghost" onClick={() => setEditing((v) => !v)}>
                  {editing ? "Fechar cadastro" : "Editar cadastro"}
                </button>
                <button
                  type="button"
                  className="btn-ghost text-red"
                  onClick={() => {
                    if (!confirm(`Desligar ${selected.nome}?`)) return;
                    const next = { ...selected, status: "desligado" as const, dataDesligamento: today };
                    if (multi) upsertEmployee(next);
                    else setEmployee(next);
                    setEditing(!multi);
                    setNotice("Colaborador desligado.");
                  }}
                >
                  Desligar
                </button>
              </div>
            </div>
            {range ? (
              <p className="mt-3 rounded-lg bg-orange/10 px-3 py-2 text-sm text-orange">
                {range === "abaixo"
                  ? `O salário está abaixo do mínimo legal deste caso (${formatMoney(legalSalaryFloor(selected))}).`
                  : `MEI só pode pagar até o salário mínimo ou o piso da categoria (${formatMoney(legalSalaryFloor(selected))}). Valor maior pode desenquadrar.`}
              </p>
            ) : (
              <p className="mt-3 text-xs text-mute">
                {multi
                  ? "No Simples Nacional não há teto de salário mínimo do MEI."
                  : `Piso aplicado: ${formatMoney(legalSalaryFloor(selected))} (maior entre o salário mínimo nacional e o piso da categoria).`}
              </p>
            )}
            {editing ? (
              <EmployeeForm
                key={selected.id}
                initial={selected}
                allowAnySalary={multi}
                onSave={(next) => {
                  if (multi) upsertEmployee(next);
                  else setEmployee(next);
                  setEditing(false);
                  setNotice("Cadastro do colaborador atualizado.");
                }}
                onCancel={() => setEditing(false)}
              />
            ) : null}
          </section>

          <div className="no-print flex flex-wrap gap-2">
            {(Object.keys(payrollKindLabel) as PayrollKind[]).map((key) => (
              <button
                key={key}
                type="button"
                className={kind === key ? "btn-primary" : "btn-ghost"}
                aria-pressed={kind === key}
                onClick={() => {
                  setKind(key);
                  setExtras(0);
                }}
              >
                {payrollKindLabel[key]}
              </button>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
            <section className="no-print rounded-2xl border border-line bg-paper p-4">
              <p className="text-sm font-semibold">Competências {year}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {MONTHS.map((label, i) => {
                  const row = selected
                    ? map.get(payrollMapKey(selected.id, year, i, kind))
                    : undefined;
                  const late = daeDueDate(year, i) < today && (!row || !row.salaryPaid || !row.daePaid);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        setMonth(i);
                        setExtras(row?.extras ?? 0);
                      }}
                      className={cn(
                        "rounded-xl border px-2 py-2 text-left text-xs",
                        month === i ? "border-navy bg-navy text-white" : "border-line bg-bg",
                      )}
                    >
                      <span className="font-semibold">{label.slice(0, 3)}</span>
                      <span className={cn("mt-1 block", month === i ? "text-gold" : late ? "text-red" : "text-mute")}>
                        {row?.salaryPaid && row.daePaid ? "Encerrada" : row ? "Aberta" : "—"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {display ? (
              <section className="rounded-2xl border border-gold bg-paper p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-mute">
                      {payrollKindLabel[kind]} · {MONTHS[month]} / {year}
                    </p>
                    <h2 className="mt-1 font-display text-2xl text-ink">{selected.nome}</h2>
                    <p className="text-sm text-mute">
                      {company.nome} · CNPJ {company.cnpj}
                    </p>
                  </div>
                  <p className="text-right text-xs text-mute">
                    Salário até {formatDate(salaryDue)}
                    <br />
                    DAE até {formatDate(daeDue)}
                  </p>
                </div>

                <div className="no-print mt-4">
                  <label className="text-xs font-medium text-mute">
                    Horas extras / outros acréscimos
                    <MoneyBrInput
                      className="input mt-1 max-w-xs"
                      value={extras || 0}
                      onChange={setExtras}
                      min={0}
                    />
                  </label>
                </div>

                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <Row label="Salário bruto" value={display.bruto} />
                  <Row label="INSS do empregado" value={-display.inssEmpregado} />
                  {display.descontoVt ? <Row label="Desconto vale-transporte (6%)" value={-display.descontoVt} /> : null}
                  <Row label="Líquido a pagar" value={display.liquido} strong />
                  <Row label="INSS patronal MEI (3%)" value={display.inssPatronal} />
                  <Row label="FGTS (8%)" value={display.fgts} />
                  <Row label="DAE (INSS + FGTS + INSS retido)" value={display.dae} strong />
                  {kind === "mensal" ? (
                    <>
                      <Row label="Provisão 13º (1/12)" value={display.provision13} />
                      <Row label="Provisão férias + 1/3" value={display.provisionFerias} />
                    </>
                  ) : null}
                  <Row label={multi ? "Custo no mês" : "Custo do MEI no mês"} value={display.custoMei} strong />
                </dl>

                <p className="mt-4 text-xs text-mute">
                  {multi
                    ? "Provisão com base nas regras de INSS/FGTS usadas no cálculo. Confirme as guias oficiais no eSocial / Receita."
                    : "O DAE une INSS patronal, FGTS e o INSS descontado do colaborador. É separado do DAS do MEI. A guia oficial só é gerada no eSocial após fechar a folha."}
                </p>

                <div className="no-print mt-4 flex flex-wrap gap-2">
                  <button type="button" className="btn-primary" onClick={generate}>
                    {existing ? "Atualizar folha" : "Gerar folha"}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost disabled:opacity-50"
                    disabled={!existing || existing.salaryPaid}
                    onClick={paySalary}
                  >
                    {existing?.salaryPaid ? "Salário lançado" : "Lançar salário"}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost disabled:opacity-50"
                    disabled={!existing || existing.daePaid}
                    onClick={payDae}
                  >
                    {existing?.daePaid ? "DAE lançado" : "Lançar DAE"}
                  </button>
                  <a href={GOV_LINKS.esocialFolha} target="_blank" rel="noreferrer" className="btn-ghost gap-2">
                    Gerar guia no eSocial
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
              </section>
            ) : null}
          </div>
        </>
      ) : null}
      {display && selected ? (
        <div className="pdf-capture-host" aria-hidden>
          <FolhaPrintSheet
            company={company}
            employee={selected}
            year={year}
            month={month}
            kind={kind}
            pay={display}
            salaryDue={salaryDue}
            daeDue={daeDue}
          />
          <HoleriteSheet company={company} employee={selected} year={year} month={month} pay={display} />
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-lg bg-bg px-3 py-2", strong && "bg-navy text-white")}>
      <dt className={strong ? "text-gold" : "text-mute"}>{label}</dt>
      <dd className="font-semibold">{formatMoney(value)}</dd>
    </div>
  );
}

function emptyEmployee(): Employee {
  return {
    id: uid("emp"),
    nome: "",
    cpf: "",
    cargo: "Auxiliar",
    dataAdmissao: todayIso(),
    salario: SALARIO_MINIMO,
    pisoCategoria: SALARIO_MINIMO,
    valeTransporte: 0,
    jornada: "44h",
    status: "ativo",
    observacao: "",
  };
}

function EmployeeForm({
  initial,
  onSave,
  onCancel,
  allowAnySalary = false,
}: {
  initial: Employee;
  onSave: (employee: Employee) => void;
  onCancel?: () => void;
  allowAnySalary?: boolean;
}) {
  const [draft, setDraft] = useState<Employee>(initial);
  const valid = draft.nome.trim().length > 2 && draft.cpf.replace(/\D/g, "").length === 11 && draft.salario > 0;
  const floor = legalSalaryFloor(draft);
  const range = allowAnySalary ? null : salaryOutOfMeiRange(draft);

  return (
    <form
      className="mt-5 grid gap-3 md:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSave({ ...draft, nome: draft.nome.trim(), status: "ativo" });
      }}
    >
      <Field label="Nome completo">
        <input className="input" value={draft.nome} onChange={(e) => setDraft({ ...draft, nome: e.target.value })} />
      </Field>
      <Field label="CPF">
        <input className="input" value={draft.cpf} onChange={(e) => setDraft({ ...draft, cpf: e.target.value })} />
      </Field>
      <Field label="Cargo">
        <input className="input" value={draft.cargo} onChange={(e) => setDraft({ ...draft, cargo: e.target.value })} />
      </Field>
      <Field label="Código">
        <input className="input" value={draft.codigo || ""} onChange={(e) => setDraft({ ...draft, codigo: e.target.value })} />
      </Field>
      <Field label="CBO">
        <input className="input" value={draft.cbo || ""} onChange={(e) => setDraft({ ...draft, cbo: e.target.value })} />
      </Field>
      <Field label="Admissão">
        <DateBrInput
          className="input"
          value={draft.dataAdmissao || ""}
          onChange={(dataAdmissao) => setDraft({ ...draft, dataAdmissao })}
        />
      </Field>
      <Field label="Salário mensal">
        <MoneyBrInput
          className="input"
          value={draft.salario || 0}
          onChange={(salario) => setDraft({ ...draft, salario })}
          min={0}
        />
      </Field>
      <Field label="Piso da categoria">
        <MoneyBrInput
          className="input"
          value={draft.pisoCategoria || 0}
          onChange={(pisoCategoria) => setDraft({ ...draft, pisoCategoria })}
          min={0}
        />
      </Field>
      <Field label="Vale-transporte (mês)">
        <MoneyBrInput
          className="input"
          value={draft.valeTransporte || 0}
          onChange={(valeTransporte) => setDraft({ ...draft, valeTransporte })}
          min={0}
        />
      </Field>
      <Field label="Jornada">
        <select
          className="input"
          value={draft.jornada}
          onChange={(e) => setDraft({ ...draft, jornada: e.target.value as Employee["jornada"] })}
        >
          <option value="44h">44 horas semanais</option>
          <option value="parcial">Parcial</option>
        </select>
      </Field>
      <Field label="Observação">
        <input
          className="input"
          value={draft.observacao}
          onChange={(e) => setDraft({ ...draft, observacao: e.target.value })}
        />
      </Field>
      <p className="text-xs text-mute md:col-span-3">
        {allowAnySalary
          ? "Simples Nacional: sem limite de um colaborador e sem teto de salário do MEI."
          : `Mínimo nacional 2026: ${formatMoney(SALARIO_MINIMO)}. Neste cadastro o piso aplicado é ${formatMoney(floor)}.`}
        {range === "abaixo" ? " Salário abaixo do legal." : null}
        {range === "acima" ? " Salário acima do teto do MEI (mínimo ou piso)." : null}
      </p>
      <div className="flex gap-2 md:col-span-3">
        <button type="submit" disabled={!valid} className="btn-primary disabled:opacity-50">
          Salvar colaborador
        </button>
        {onCancel ? (
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancelar
          </button>
        ) : null}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-mute">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}
