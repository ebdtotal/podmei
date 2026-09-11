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
  ref?: string;
  provento?: number;
  desconto?: number;
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
    { cod: "001", desc: "SALARIO BASE", ref: hoursRef(employee), provento: salario },
    { cod: "400", desc: "COMISSAO", provento: pay.extras },
    { cod: "420", desc: "REPOUSO REMUNERADO", provento: 0 },
    { cod: "903", desc: "INSS", desconto: pay.inssEmpregado },
  ];
  if (pay.descontoVt > 0) rows.push({ cod: "500", desc: "VALE-TRANSPORTE", desconto: pay.descontoVt });
  return rows;
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
  const codigo = (employee.codigo || "00001").padStart(5, "0");
  const vias = ["1ª VIA - EMPREGADOR", "2ª VIA - EMPREGADO"] as const;

  return (
    <article className="print-holerite" style={sheet}>
      {vias.map((via) => (
        <section key={via} style={viaBox}>
          <div style={bodyRow}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={topGrid}>
                <div style={employerBox}>
                  <p style={label}>EMPREGADOR</p>
                  <p style={line}>Nome {company.nome}</p>
                  <p style={line}>Endereço {employerAddress(company) || "—"}</p>
                  <p style={line}>CNPJ {company.cnpj}</p>
                </div>
                <div style={titleBox}>
                  <p style={title}>Recibo de Pagamento de Salário</p>
                  <p style={subtitle}>Referente ao Mês / Ano</p>
                  <p style={monthLine}>
                    {MONTHS[month]} / {year}
                  </p>
                </div>
              </div>
              <div style={workerRow}>
                <span>
                  <b>CÓDIGO</b> {codigo}
                </span>
                <span>
                  <b>NOME DO FUNCIONÁRIO</b> {employee.nome}
                </span>
                <span>
                  <b>CBO</b> {employee.cbo || "—"}
                </span>
                <span>
                  <b>FUNÇÃO</b> {(employee.cargo || "—").toUpperCase()}
                </span>
              </div>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={thCod}>Cód.</th>
                    <th style={th}>Descrição</th>
                    <th style={thRef}>Referência</th>
                    <th style={thNum}>Proventos</th>
                    <th style={thNum}>Descontos</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.cod}>
                      <td style={tdCod}>{line.cod}</td>
                      <td style={td}>{line.desc}</td>
                      <td style={tdRef}>{line.ref || ""}</td>
                      <td style={tdNum}>{line.provento !== undefined ? money(line.provento) : ""}</td>
                      <td style={tdNum}>{line.desconto !== undefined ? money(line.desconto) : ""}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={tdFill} colSpan={3} />
                    <td style={tdNum} />
                    <td style={tdNum} />
                  </tr>
                </tbody>
              </table>
              <div style={bottomGrid}>
                <div style={msgBox}>
                  <p style={label}>MENSAGENS</p>
                </div>
                <div>
                  <div style={totalRow}>
                    <span>Total dos Vencimentos</span>
                    <span>Total dos Descontos</span>
                  </div>
                  <div style={totalRow}>
                    <b>{money(pay.bruto)}</b>
                    <b>{money(descontos)}</b>
                  </div>
                  <div style={netRow}>
                    <span>Líquido a Receber -&gt;</span>
                    <b>{money(pay.liquido)}</b>
                  </div>
                </div>
              </div>
              <div style={bases}>
                <span>Salário Base {money(employee.salario)}</span>
                <span>Base Cálc. INSS {money(pay.bruto)}</span>
                <span>Base Cálc. FGTS {money(pay.bruto)}</span>
                <span>FGTS do Mês {money(pay.fgts)}</span>
                <span>Base Cálc. IRRF {money(0)}</span>
                <span>Faixa IRRF 0</span>
              </div>
              <p style={viaLabel}>{via}</p>
            </div>
            <div style={signCol}>
              <p style={signText}>DECLARO TER RECEBIDO A IMPORTÂNCIA LÍQUIDA DISCRIMINADA NESTE RECIBO.</p>
              <div style={signBlock}>
                <span>ASSINATURA DO FUNCIONÁRIO</span>
                <span style={signLine}>____ / ____ / ______</span>
                <span>DATA</span>
              </div>
            </div>
          </div>
        </section>
      ))}
    </article>
  );
}

const sheet: CSSProperties = {
  width: "718px",
  background: "#fff",
  color: "#111",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "8px",
  lineHeight: 1.25,
};

const viaBox: CSSProperties = {
  border: "1px solid #111",
  marginBottom: "8px",
  background: "#fff",
};

const bodyRow: CSSProperties = { display: "flex", alignItems: "stretch" };

const topGrid: CSSProperties = { display: "grid", gridTemplateColumns: "1.15fr 1fr" };

const employerBox: CSSProperties = { borderRight: "1px solid #111", borderBottom: "1px solid #111", padding: "4px 6px" };

const titleBox: CSSProperties = {
  borderBottom: "1px solid #111",
  padding: "8px 6px",
  textAlign: "center",
};

const title: CSSProperties = { margin: 0, fontSize: "13px", fontWeight: 700 };

const subtitle: CSSProperties = { margin: "2px 0 0", fontSize: "8px" };

const monthLine: CSSProperties = { margin: "4px 0 0", fontWeight: 700 };

const label: CSSProperties = { margin: "0 0 2px", fontWeight: 700, fontSize: "8px" };

const line: CSSProperties = { margin: "1px 0" };

const workerRow: CSSProperties = {
  display: "flex",
  gap: "10px",
  borderBottom: "1px solid #111",
  padding: "3px 6px",
  fontSize: "8px",
};

const table: CSSProperties = { width: "100%", borderCollapse: "collapse" };

const th: CSSProperties = { borderBottom: "1px solid #111", padding: "3px 4px", textAlign: "left", fontWeight: 700 };

const thCod: CSSProperties = { ...th, width: "36px" };

const thRef: CSSProperties = { ...th, width: "64px", textAlign: "center" };

const thNum: CSSProperties = { ...th, width: "78px", textAlign: "right" };

const td: CSSProperties = { padding: "2px 4px" };

const tdCod: CSSProperties = { ...td, fontWeight: 700 };

const tdRef: CSSProperties = { ...td, textAlign: "center" };

const tdNum: CSSProperties = { ...td, textAlign: "right" };

const tdFill: CSSProperties = { height: "46px", padding: "2px 4px" };

const bottomGrid: CSSProperties = { display: "grid", gridTemplateColumns: "1.4fr 1fr", borderTop: "1px solid #111" };

const msgBox: CSSProperties = { borderRight: "1px solid #111", minHeight: "48px", padding: "3px 6px" };

const totalRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "8px",
  borderBottom: "1px solid #111",
  padding: "3px 6px",
};

const netRow: CSSProperties = { display: "flex", justifyContent: "space-between", gap: "8px", padding: "3px 6px", fontWeight: 700 };

const bases: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  borderTop: "1px solid #111",
  padding: "3px 6px",
};

const viaLabel: CSSProperties = { margin: 0, borderTop: "1px solid #111", padding: "2px 6px", fontWeight: 700 };

const signCol: CSSProperties = {
  width: "42px",
  borderLeft: "1px solid #111",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 2px",
};

const signText: CSSProperties = {
  margin: 0,
  writingMode: "vertical-rl",
  transform: "rotate(180deg)",
  fontSize: "7px",
  letterSpacing: "0.4px",
  textAlign: "center",
};

const signBlock: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "4px",
  writingMode: "vertical-rl",
  transform: "rotate(180deg)",
  fontSize: "7px",
  fontWeight: 700,
};

const signLine: CSSProperties = { fontWeight: 400 };
