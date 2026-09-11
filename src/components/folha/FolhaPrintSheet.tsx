import type { CSSProperties } from "react";
import { payrollKindLabel } from "@/lib/folha";
import type { Company, Employee, PayrollKind } from "@/lib/types";
import { MONTHS } from "@/lib/types";
import { formatDate, formatMoney } from "@/lib/utils";

type Slip = {
  bruto: number;
  extras: number;
  inssEmpregado: number;
  descontoVt: number;
  liquido: number;
  inssPatronal: number;
  fgts: number;
  dae: number;
  provision13: number;
  provisionFerias: number;
  custoMei: number;
};

export function FolhaPrintSheet({
  company,
  employee,
  year,
  month,
  kind,
  pay,
  salaryDue,
  daeDue,
}: {
  company: Company;
  employee: Employee;
  year: number;
  month: number;
  kind: PayrollKind;
  pay: Slip;
  salaryDue: string;
  daeDue: string;
}) {
  const rows: Array<[string, string]> = [
    ["Salário bruto", formatMoney(pay.bruto)],
    ["INSS do empregado", formatMoney(-pay.inssEmpregado)],
    ["Líquido a pagar", formatMoney(pay.liquido)],
    ["INSS patronal MEI (3%)", formatMoney(pay.inssPatronal)],
    ["FGTS (8%)", formatMoney(pay.fgts)],
    ["DAE (INSS + FGTS + INSS retido)", formatMoney(pay.dae)],
  ];
  if (pay.descontoVt) rows.splice(2, 0, ["Desconto vale-transporte (6%)", formatMoney(-pay.descontoVt)]);
  if (kind === "mensal") {
    rows.push(["Provisão 13º (1/12)", formatMoney(pay.provision13)]);
    rows.push(["Provisão férias + 1/3", formatMoney(pay.provisionFerias)]);
  }
  rows.push(["Custo do MEI no mês", formatMoney(pay.custoMei)]);
  if (pay.extras) rows.splice(1, 0, ["Horas extras / acréscimos", formatMoney(pay.extras)]);

  return (
    <article className="print-sheet" style={sheet}>
      <p style={kicker}>FOLHA DE PAGAMENTO</p>
      <h1 style={title}>
        {payrollKindLabel[kind]} · {MONTHS[month]} / {year}
      </h1>
      <p style={meta}>
        {company.nome} · CNPJ {company.cnpj}
      </p>
      <p style={meta}>
        {employee.nome} · {employee.cargo} · CPF {employee.cpf}
      </p>
      <p style={meta}>
        Salário até {formatDate(salaryDue)} · DAE até {formatDate(daeDue)}
      </p>
      <table style={table}>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td style={labelCell}>{label}</td>
              <td style={valueCell}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={note}>
        Documento interno de conferência. O DAE une INSS patronal, FGTS e o INSS descontado do colaborador. A guia
        oficial só é gerada no eSocial.
      </p>
    </article>
  );
}

const sheet: CSSProperties = {
  width: "718px",
  background: "#fff",
  color: "#111",
  fontFamily: "Arial, Helvetica, sans-serif",
  padding: "8px 4px 16px",
};

const kicker: CSSProperties = {
  margin: 0,
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "1.5px",
};

const title: CSSProperties = { margin: "8px 0 0", fontSize: "22px", fontWeight: 700 };

const meta: CSSProperties = { margin: "4px 0 0", fontSize: "12px" };

const table: CSSProperties = { width: "100%", borderCollapse: "collapse", marginTop: "16px" };

const labelCell: CSSProperties = {
  borderBottom: "1px solid #ddd",
  padding: "8px 8px",
  fontSize: "13px",
};

const valueCell: CSSProperties = {
  borderBottom: "1px solid #ddd",
  padding: "8px 8px",
  fontSize: "13px",
  fontWeight: 700,
  textAlign: "right",
  width: "160px",
};

const note: CSSProperties = { margin: "16px 0 0", fontSize: "11px", color: "#444" };
