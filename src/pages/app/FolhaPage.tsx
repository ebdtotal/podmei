import { useMemo, useState } from "react";
import { ExternalLink, Printer, UserRound } from "lucide-react";
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
  salaryDueDate,
  salaryExpense,
  salaryOutOfMeiRange,
} from "@/lib/folha";
import { GOV_LINKS } from "@/lib/mei";
import { useStore } from "@/lib/store";
import type { Employee, PayrollKind, PayrollRun } from "@/lib/types";
import { MONTHS } from "@/lib/types";
import { cn, currentYear, formatDate, formatMoney, todayIso, uid } from "@/lib/utils";

export function FolhaPage() {
  const { company, employee, payrolls, setEmployee, upsertPayroll, addEntry } = useStore();
  const year = currentYear();
  const [kind, setKind] = useState<PayrollKind>("mensal");
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [extras, setExtras] = useState(0);
  const [editing, setEditing] = useState(!hasActiveEmployee(employee));
  const [notice, setNotice] = useState("");
  const today = todayIso();
  const map = useMemo(() => payrollMap(payrolls), [payrolls]);
  const existing = employee ? map.get(`${kind}-${year}-${String(month + 1).padStart(2, "0")}`) : undefined;
  const preview = hasActiveEmployee(employee) ? calcPayroll({ employee, year, month, kind, extras }) : null;
  const display = existing && extras === existing.extras ? existing : preview;
  const salaryDue = salaryDueDate(year, month);
  const daeDue = daeDueDate(year, month);
  const range = hasActiveEmployee(employee) ? salaryOutOfMeiRange(employee) : null;

  function saveRun(next: PayrollRun, message: string) {
    upsertPayroll(next);
    setNotice(message);
  }

  function generate() {
    if (!hasActiveEmployee(employee) || !preview) return;
    const next = buildPayroll({
      employee,
      year,
      month,
      kind,
                    extras: extras,
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

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Folha do colaborador</h1>
          <p className="mt-1 max-w-2xl text-sm text-mute">
            O MEI pode ter no máximo um empregado, no salário mínimo ou no piso da categoria. Aqui você calcula o
            holerite 2026, provisiona 13º e férias e lança o pagamento no livro-caixa. A guia DAE sai no eSocial Web
            MEI.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost gap-2" onClick={() => void printOrSharePdf("holerite.pdf")}>
            <Printer className="size-4" />
            PDF A4 holerite
          </button>
          <a href={GOV_LINKS.esocialFolha} target="_blank" rel="noreferrer" className="btn-primary gap-2">
            Abrir eSocial MEI
            <ExternalLink className="size-4" />
          </a>
        </div>
      </div>

      {notice ? <p className="no-print rounded-xl border border-gold bg-paper px-4 py-3 text-sm">{notice}</p> : null}

      {!hasActiveEmployee(employee) ? (
        <section className="no-print rounded-2xl border border-line bg-paper p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-navy text-gold">
              <UserRound className="size-5" />
            </span>
            <div>
              <h2 className="font-semibold">Este MEI ainda não tem colaborador</h2>
              <p className="mt-1 text-sm text-mute">
                Sem empregado, não há folha nem eSocial. Cadastre o único colaborador permitido. Depois da admissão
                formal no eSocial, use esta tela todo mês.
              </p>
              <a
                href={GOV_LINKS.esocialAdmissao}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex text-sm font-semibold text-ink"
              >
                Admitir no eSocial Web MEI
                <ExternalLink className="ml-1 size-3.5" />
              </a>
            </div>
          </div>
          {employee && employee.status === "desligado" ? (
            <p className="mt-4 rounded-lg bg-bg px-3 py-2 text-sm">
              Último colaborador: {employee.nome}, desligado em {formatDate(employee.dataDesligamento || today)}.
              Você pode admitir outro — o MEI continua limitado a um por vez.
            </p>
          ) : null}
          <EmployeeForm
            key={employee?.id ?? "novo"}
            initial={employee && employee.status === "desligado" ? emptyEmployee() : (employee ?? emptyEmployee())}
            onSave={(next) => {
              setEmployee(next);
              setEditing(false);
              setNotice(`${next.nome} cadastrado. Gere a folha do mês e feche no eSocial.`);
            }}
          />
        </section>
      ) : (
        <>
          <section className="no-print rounded-2xl border border-line bg-paper p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-mute">Colaborador de {company.nome}</p>
                <h2 className="mt-1 font-display text-2xl text-ink">{employee.nome}</h2>
                <p className="text-sm text-mute">
                  {employee.cargo} · CPF {employee.cpf} · admitido em {formatDate(employee.dataAdmissao)} ·{" "}
                  {employee.jornada === "44h" ? "44h semanais" : "jornada parcial"}
                </p>
                <p className="mt-2 text-sm">
                  Salário {formatMoney(employee.salario)}
                  {employee.valeTransporte ? ` · vale-transporte ${formatMoney(employee.valeTransporte)}` : ""}
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
                    if (!confirm(`Desligar ${employee.nome}? O MEI fica sem colaborador até uma nova admissão.`)) return;
                    setEmployee({ ...employee, status: "desligado", dataDesligamento: today });
                    setEditing(true);
                    setNotice("Colaborador desligado. Faça a rescisão oficial no eSocial.");
                  }}
                >
                  Desligar
                </button>
              </div>
            </div>
            {range ? (
              <p className="mt-3 rounded-lg bg-orange/10 px-3 py-2 text-sm text-orange">
                {range === "abaixo"
                  ? `O salário está abaixo do mínimo legal deste caso (${formatMoney(legalSalaryFloor(employee))}).`
                  : `MEI só pode pagar até o salário mínimo ou o piso da categoria (${formatMoney(legalSalaryFloor(employee))}). Valor maior pode desenquadrar.`}
              </p>
            ) : (
              <p className="mt-3 text-xs text-mute">
                Piso aplicado: {formatMoney(legalSalaryFloor(employee))} (maior entre o salário mínimo nacional e o
                piso da categoria).
              </p>
            )}
            {editing ? (
              <EmployeeForm
                key={employee.id}
                initial={employee}
                onSave={(next) => {
                  setEmployee(next);
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
                className={cn("btn-ghost", kind === key && "bg-navy text-white hover:bg-navy hover:text-white")}
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
                  const row = map.get(`${kind}-${year}-${String(i + 1).padStart(2, "0")}`);
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
              <section className="print-sheet rounded-2xl border border-gold bg-paper p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-mute">
                      {payrollKindLabel[kind]} · {MONTHS[month]} / {year}
                    </p>
                    <h2 className="mt-1 font-display text-2xl text-ink">{employee.nome}</h2>
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
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input mt-1 max-w-xs"
                      value={extras || ""}
                      onChange={(e) => setExtras(Number(e.target.value) || 0)}
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
                  <Row label="Custo do MEI no mês" value={display.custoMei} strong />
                </dl>

                <p className="mt-4 text-xs text-mute">
                  O DAE une INSS patronal, FGTS e o INSS descontado do colaborador. É separado do DAS do MEI. A guia
                  oficial só é gerada no eSocial após fechar a folha.
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
      )}
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
}: {
  initial: Employee;
  onSave: (employee: Employee) => void;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<Employee>(initial);
  const valid = draft.nome.trim().length > 2 && draft.cpf.replace(/\D/g, "").length === 11 && draft.salario > 0;
  const floor = legalSalaryFloor(draft);
  const range = salaryOutOfMeiRange(draft);

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
      <Field label="Admissão">
        <input
          type="date"
          className="input"
          value={draft.dataAdmissao}
          onChange={(e) => setDraft({ ...draft, dataAdmissao: e.target.value })}
        />
      </Field>
      <Field label="Salário mensal">
        <input
          type="number"
          min="0"
          step="0.01"
          className="input"
          value={draft.salario || ""}
          onChange={(e) => setDraft({ ...draft, salario: Number(e.target.value) })}
        />
      </Field>
      <Field label="Piso da categoria">
        <input
          type="number"
          min="0"
          step="0.01"
          className="input"
          value={draft.pisoCategoria || ""}
          onChange={(e) => setDraft({ ...draft, pisoCategoria: Number(e.target.value) })}
        />
      </Field>
      <Field label="Vale-transporte (mês)">
        <input
          type="number"
          min="0"
          step="0.01"
          className="input"
          value={draft.valeTransporte || ""}
          onChange={(e) => setDraft({ ...draft, valeTransporte: Number(e.target.value) })}
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
        Mínimo nacional 2026: {formatMoney(SALARIO_MINIMO)}. Neste cadastro o piso aplicado é {formatMoney(floor)}.
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
