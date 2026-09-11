import type { CSSProperties } from "react";
import type { Company, Employee } from "@/lib/types";
import { MONTHS } from "@/lib/types";

type Slip = {
  bruto: number;
  extras: number;
  inssEmpregado: number;
  descontoVt: number;
  liquido: number;
  fgts: number;
};

type Line = {
  cod: string;
  desc: string;
  ref: string;
  provento: string;
  desconto: string;
};

function money(value: number) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function hoursRef(employee: Employee) {
  return employee.jornada === "parcial" ? "110:00" : "220:00";
}

function employerAddress(company: Company) {
  return [company.endereco, company.bairro, [company.cidade, company.uf].filter(Boolean).join("/")].filter(Boolean).join(" · ");
}

function linesOf(employee: Employee, pay: Slip): Line[] {
  const salario = Math.max(pay.bruto - pay.extras, 0);
  const rows: Line[] = [
    { cod: "001", desc: "SALARIO BASE", ref: hoursRef(employee), provento: money(salario), desconto: "" },
    { cod: "400", desc: "COMISSAO", ref: "", provento: money(pay.extras), desconto: "" },
    { cod: "420", desc: "REPOUSO REMUNERADO", ref: "", provento: money(0), desconto: "" },
    { cod: "903", desc: "INSS", ref: "", provento: "", desconto: money(pay.inssEmpregado) },
  ];
  if (pay.descontoVt > 0) {
    rows.push({ cod: "500", desc: "VALE-TRANSPORTE", ref: "", provento: "", desconto: money(pay.descontoVt) });
  }
  return rows;
}

function SignatureStrip() {
  return (
    <svg width="36" height="430" viewBox="0 0 36 430" style={{ display: "block" }}>
      <g transform="translate(20 168) rotate(-90)">
        <text textAnchor="middle" fontSize="7" fontFamily="Arial, Helvetica, sans-serif" fill="#111">
          DECLARO TER RECEBIDO A IMPORTÂNCIA LÍQUIDA DISCRIMINADA NESTE RECIBO.
        </text>
      </g>
      <g transform="translate(18 355) rotate(-90)">
        <text textAnchor="middle" fontSize="6.5" fontWeight="700" fontFamily="Arial, Helvetica, sans-serif" fill="#111">
          ASSINATURA DO FUNCIONÁRIO
        </text>
        <text y="16" textAnchor="middle" fontSize="11" fontFamily="Arial, Helvetica, sans-serif" fill="#111">
          /     /
        </text>
        <text y="28" textAnchor="middle" fontSize="6.5" fontWeight="700" fontFamily="Arial, Helvetica, sans-serif" fill="#111">
          DATA
        </text>
      </g>
    </svg>
  );
}

export function HoleriteSheet({
  company,
  employee,
  year,
  month,
  pay,
}: {
  company: Company;
  employee: Employee;
  year: number;
  month: number;
  pay: Slip;
}) {
  const lines = linesOf(employee, pay);
  const descontos = pay.inssEmpregado + pay.descontoVt;
  const codigo = (employee.codigo || "00001").replace(/\s/g, "") || "00001";
  const vias = ["1ª VIA - EMPREGADOR", "2ª VIA - EMPREGADO"] as const;

  return (
    <article className="print-holerite" style={sheet}>
      {vias.map((via) => (
        <table key={via} style={viaTable}>
          <tbody>
            <tr>
              <td style={mainCell}>
                <table style={inner}>
                  <tbody>
                    <tr>
                      <td style={employerCell}>
                        <div style={headLabel}>EMPREGADOR</div>
                        <div style={field}>Nome {company.nome}</div>
                        <div style={field}>Endereço {employerAddress(company) || "—"}</div>
                        <div style={field}>CNPJ {company.cnpj}</div>
                      </td>
                      <td style={titleCell}>
                        <div style={title}>Recibo de Pagamento de Salário</div>
                        <div style={subtitle}>Referente ao Mês / Ano</div>
                        <div style={monthLine}>
                          {MONTHS[month]} / {year}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <table style={inner}>
                  <tbody>
                    <tr>
                      <td style={idHead}>CÓDIGO</td>
                      <td style={nameHead}>NOME DO FUNCIONÁRIO</td>
                      <td style={cboHead}>CBO</td>
                      <td style={roleHead}>FUNÇÃO</td>
                    </tr>
                    <tr>
                      <td style={idValue}>{codigo.padStart(5, "0")}</td>
                      <td style={nameValue}>{employee.nome}</td>
                      <td style={cboValue}>{employee.cbo || ""}</td>
                      <td style={roleValue}>{(employee.cargo || "").toUpperCase()}</td>
                    </tr>
                  </tbody>
                </table>
                <table style={grid}>
                  <colgroup>
                    <col style={{ width: "42px" }} />
                    <col />
                    <col style={{ width: "78px" }} />
                    <col style={{ width: "88px" }} />
                    <col style={{ width: "88px" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={th}>Cód.</th>
                      <th style={thLeft}>Descrição</th>
                      <th style={th}>Referência</th>
                      <th style={th}>Proventos</th>
                      <th style={thLast}>Descontos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.cod}>
                        <td style={td}>{line.cod}</td>
                        <td style={tdLeft}>{line.desc}</td>
                        <td style={td}>{line.ref}</td>
                        <td style={td}>{line.provento}</td>
                        <td style={tdLast}>{line.desconto}</td>
                      </tr>
                    ))}
                    <tr>
                      <td style={fill} />
                      <td style={fill} />
                      <td style={fill} />
                      <td style={fill} />
                      <td style={fillLast} />
                    </tr>
                  </tbody>
                </table>
                <table style={inner}>
                  <tbody>
                    <tr>
                      <td style={msgCell} rowSpan={3}>
                        MENSAGENS
                      </td>
                      <td style={totHead}>Total dos Vencimentos</td>
                      <td style={totHeadLast}>Total dos Descontos</td>
                    </tr>
                    <tr>
                      <td style={totValue}>{money(pay.bruto)}</td>
                      <td style={totValueLast}>{money(descontos)}</td>
                    </tr>
                    <tr>
                      <td style={netLabel}>Líquido a Receber -&gt;</td>
                      <td style={netValue}>{money(pay.liquido)}</td>
                    </tr>
                  </tbody>
                </table>
                <table style={inner}>
                  <tbody>
                    <tr>
                      <td style={baseCell}>Salário Base {money(employee.salario)}</td>
                      <td style={baseCell}>Base Cálc. INSS {money(pay.bruto)}</td>
                      <td style={baseCell}>Base Cálc. FGTS {money(pay.bruto)}</td>
                      <td style={baseCell}>FGTS do Mês {money(pay.fgts)}</td>
                      <td style={baseCell}>Base Cálc. IRRF {money(0)}</td>
                      <td style={baseLast}>Faixa IRRF 0</td>
                    </tr>
                  </tbody>
                </table>
                <div style={viaLabel}>{via}</div>
              </td>
              <td style={signCell}>
                <SignatureStrip />
              </td>
            </tr>
          </tbody>
        </table>
      ))}
    </article>
  );
}

const ink = "#111";
const line = "1px solid #111";

const sheet: CSSProperties = {
  width: "718px",
  background: "#fff",
  color: ink,
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "8px",
  lineHeight: 1.2,
};

const viaTable: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  border: line,
  marginBottom: "10px",
  background: "#fff",
  tableLayout: "fixed",
};

const mainCell: CSSProperties = { verticalAlign: "top", padding: 0, borderRight: line };

const signCell: CSSProperties = { width: "36px", verticalAlign: "top", padding: 0, background: "#fff" };

const inner: CSSProperties = { width: "100%", borderCollapse: "collapse" };

const grid: CSSProperties = { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" };

const employerCell: CSSProperties = {
  width: "46%",
  borderRight: line,
  borderBottom: line,
  padding: "4px 6px",
  verticalAlign: "top",
};

const titleCell: CSSProperties = { borderBottom: line, padding: "8px 8px 6px", textAlign: "center", verticalAlign: "middle" };

const headLabel: CSSProperties = { fontWeight: 700, marginBottom: "3px" };

const field: CSSProperties = { margin: "2px 0" };

const title: CSSProperties = { fontSize: "14px", fontWeight: 700, letterSpacing: "0.2px" };

const subtitle: CSSProperties = { marginTop: "3px", fontSize: "8px" };

const monthLine: CSSProperties = { marginTop: "3px", fontWeight: 700 };

const idHead: CSSProperties = { width: "72px", borderBottom: line, borderRight: line, padding: "3px 6px", fontWeight: 700 };

const nameHead: CSSProperties = { borderBottom: line, borderRight: line, padding: "3px 6px", fontWeight: 700 };

const cboHead: CSSProperties = { width: "72px", borderBottom: line, borderRight: line, padding: "3px 6px", fontWeight: 700 };

const roleHead: CSSProperties = { width: "130px", borderBottom: line, padding: "3px 6px", fontWeight: 700 };

const idValue: CSSProperties = { borderBottom: line, borderRight: line, padding: "2px 6px 4px", fontWeight: 700 };

const nameValue: CSSProperties = { borderBottom: line, borderRight: line, padding: "2px 6px 4px", fontWeight: 700 };

const cboValue: CSSProperties = { borderBottom: line, borderRight: line, padding: "2px 6px 4px", textAlign: "center" };

const roleValue: CSSProperties = { borderBottom: line, padding: "2px 6px 4px", fontWeight: 700, textAlign: "center" };

const th: CSSProperties = {
  borderBottom: line,
  borderRight: line,
  padding: "3px 4px",
  textAlign: "center",
  fontWeight: 700,
};

const thLeft: CSSProperties = { ...th, textAlign: "left", paddingLeft: "6px" };

const thLast: CSSProperties = { ...th, borderRight: "none" };

const td: CSSProperties = { borderRight: line, padding: "2px 4px", textAlign: "center", height: "16px" };

const tdLeft: CSSProperties = { ...td, textAlign: "left", paddingLeft: "6px" };

const tdLast: CSSProperties = { padding: "2px 4px", textAlign: "center", height: "16px" };

const fill: CSSProperties = { height: "78px", borderRight: line };

const fillLast: CSSProperties = { height: "78px" };

const msgCell: CSSProperties = {
  width: "46%",
  borderRight: line,
  borderBottom: line,
  padding: "4px 6px",
  verticalAlign: "top",
  fontWeight: 700,
};

const totHead: CSSProperties = { borderBottom: line, borderRight: line, padding: "3px 6px", textAlign: "center" };

const totHeadLast: CSSProperties = { borderBottom: line, padding: "3px 6px", textAlign: "center" };

const totValue: CSSProperties = { borderBottom: line, borderRight: line, padding: "3px 6px", textAlign: "right", fontWeight: 700 };

const totValueLast: CSSProperties = { borderBottom: line, padding: "3px 6px", textAlign: "right", fontWeight: 700 };

const netLabel: CSSProperties = { borderBottom: line, borderRight: line, padding: "3px 6px", fontWeight: 700 };

const netValue: CSSProperties = { borderBottom: line, padding: "3px 6px", textAlign: "right", fontWeight: 700 };

const baseCell: CSSProperties = { borderBottom: line, borderRight: line, padding: "4px 4px", textAlign: "center" };

const baseLast: CSSProperties = { borderBottom: line, padding: "4px 4px", textAlign: "center" };

const viaLabel: CSSProperties = { padding: "2px 6px", fontWeight: 700 };

