import { CalendarDays, FileSpreadsheet, Landmark, Receipt, Stamp, Target, TrendingUp, Users, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { AlertBanners } from "@/components/alerts/AlertBanners";
import { TrendLines } from "@/components/charts/CashBars";
import { buildAlerts, dismissAlert, dismissedAlertIds, filterAlertsForPlan } from "@/lib/alerts";
import { useAuth } from "@/lib/auth";
import { hasActiveEmployee } from "@/lib/folha";
import { averageTicket, goalProgress, topClients, trendMonths } from "@/lib/insights";
import {
  dasnSummary,
  irpfSplit,
  limitStatus,
  monthlySeries,
  proportionalLimit,
  purchaseLimit,
  totalExpenses,
  totalPurchases,
  totalRevenue,
  yearEntries,
} from "@/lib/mei";
import { hasPremiumAccess } from "@/lib/plans";
import { useStore } from "@/lib/store";
import { MONTHS, MONTHS_SHORT } from "@/lib/types";
import { cn, currentYear, formatMoney, formatPercent, monthIndex, todayIso } from "@/lib/utils";

export function DashboardPage() {
  const { user } = useAuth();
  const premium = hasPremiumAccess(user);
  const { company, entries, employee, payrolls, clients, activeClientId } = useStore();
  const [dismissed, setDismissed] = useState(() => dismissedAlertIds());
  const shared = clients.find((c) => c.id === activeClientId)?.sharedInviteId;
  const year = currentYear();
  const now = new Date();
  const yearList = yearEntries(entries, year);
  const series = monthlySeries(yearList, year);
  const currentMonth = now.getFullYear() === year ? now.getMonth() : 11;
  const lastActive = [...series].reverse().find((row) => row.faturamento > 0 || row.despesas > 0);
  const month =
    lastActive && series[currentMonth]?.faturamento === 0 && series[currentMonth]?.despesas === 0
      ? lastActive.month
      : currentMonth;
  const billed = totalRevenue(yearList);
  const expenses = totalExpenses(yearList);
  const purchases = totalPurchases(yearList);
  const fatLimit = proportionalLimit(company, year);
  const buyLimit = purchaseLimit(company, year);
  const fat = limitStatus(billed, fatLimit);
  const buy = limitStatus(purchases, buyLimit);
  const ir = irpfSplit(yearList);
  const dasn = dasnSummary(yearList);
  const current = series[month];
  const ticket = averageTicket(entries, year, monthIndex(todayIso()));
  const ticketYear = averageTicket(entries, year);
  const tops = topClients(entries, year, 5);
  const trend = trendMonths(entries, 12);
  const metaMes = goalProgress(
    totalRevenue(yearList.filter((e) => monthIndex(e.data) === monthIndex(todayIso()))),
    company.metaFaturamentoMes || 0,
  );
  const dashAlerts = filterAlertsForPlan(
    buildAlerts(company, entries, undefined, { employee, payrolls }).filter((alert) => !dismissed.has(alert.id)),
    premium,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mute">Painel do MEI</p>
          <h1 className="font-display text-3xl text-ink">{company.nome}</h1>
          <p className="text-sm text-mute">
            {company.cnpj} · {company.cidade}/{company.uf}
            {!premium ? " · Plano Pro" : " · Plano Premium"}
          </p>
        </div>
        <Link to="/app/relatorio-oficial" className="btn-primary">
          Relatório de receitas do mês
        </Link>
      </div>

      {shared ? (
        <p className="rounded-2xl border border-line bg-paper px-4 py-3 text-sm text-mute">
          Cópia compartilhada pelo MEI. Os lançamentos novos aparecem quando o escritório atualiza este CNPJ na carteira.
        </p>
      ) : null}

      <AlertBanners
        alerts={dashAlerts}
        onDismiss={(id) => {
          dismissAlert(id);
          setDismissed(dismissedAlertIds());
        }}
      />

      {premium ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Shortcut to="/app/das" color="bg-orange" icon={Stamp} label="Emitir DAS mensal" />
            <Shortcut to="/app/dasn" color="bg-blue" icon={FileSpreadsheet} label="Declaração anual" />
            <Shortcut to="/app/fluxo-caixa" color="bg-navy" icon={Wallet} label="Fluxo de caixa" />
            <Shortcut to="/app/calendario" color="bg-green" icon={CalendarDays} label="Calendário" />
            <Shortcut to="/app/metas" color="bg-navy-2" icon={Target} label="Metas" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Shortcut to="/app/folha" color="bg-navy" icon={Users} label="Folha do colaborador" />
            <Shortcut to="/app/extrato" color="bg-green" icon={Landmark} label="Ler extrato bancário" />
            <Shortcut to="/app/nfse" color="bg-navy-2" icon={Receipt} label="Emissão nota fiscal" />
            <Shortcut to="/app/relatorios" color="bg-blue" icon={TrendingUp} label="Relatórios" />
          </div>
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Shortcut to="/app/das" color="bg-orange" icon={Stamp} label="Emitir DAS mensal" />
          <Shortcut to="/app/limites" color="bg-navy" icon={TrendingUp} label="Limites do MEI" />
          <Shortcut to="/app/extrato" color="bg-green" icon={Landmark} label="Ler extrato bancário" />
          <Shortcut to="/app/relatorios" color="bg-blue" icon={FileSpreadsheet} label="Relatórios" />
        </div>
      )}

      <section className="overflow-hidden rounded-3xl text-white shadow-sm" style={{ background: "linear-gradient(135deg, #7B2CF5, #2563EB)" }}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
          <p className="font-display text-lg">Relatório do mês de {MONTHS[month]}</p>
          <p className="text-xs font-semibold text-white/80">POD MEI</p>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-4">
          <Highlight label="Comércio / transp. cargas" value={current.comercio} />
          <Highlight label="Serviços" value={current.servico} />
          <Highlight label="Transporte passageiros" value={current.passageiros} />
          <Highlight label="Despesas" value={current.despesas} />
        </div>
        <div className="mx-5 mb-5 rounded-lg bg-green px-4 py-3 text-sm font-semibold">
          Lucro líquido {formatMoney(current.lucro)}
        </div>
      </section>

      {premium ? (
      <section className="rounded-2xl border border-line bg-paper p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Visão avançada</h2>
          <Link to="/app/fluxo-caixa" className="text-xs font-semibold text-navy">
            Abrir fluxo de caixa
          </Link>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-bg px-3 py-3">
            <p className="text-xs text-mute">Ticket médio do mês</p>
            <p className="font-display text-xl">{formatMoney(ticket.ticket)}</p>
            <p className="text-[11px] text-mute">{ticket.count} venda{ticket.count === 1 ? "" : "s"}</p>
          </div>
          <div className="rounded-xl bg-bg px-3 py-3">
            <p className="text-xs text-mute">Ticket médio {year}</p>
            <p className="font-display text-xl">{formatMoney(ticketYear.ticket)}</p>
            <p className="text-[11px] text-mute">{ticketYear.count} venda{ticketYear.count === 1 ? "" : "s"}</p>
          </div>
          <div className="rounded-xl bg-bg px-3 py-3">
            <p className="text-xs text-mute">Meta do mês</p>
            <p className="font-display text-xl">{metaMes.meta ? `${metaMes.pct}%` : "—"}</p>
            <p className="text-[11px] text-mute">
              {metaMes.meta ? `${formatMoney(metaMes.atual)} de ${formatMoney(metaMes.meta)}` : "Defina em Metas"}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <TrendLines series={trend} />
        </div>
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-mute">Top clientes {year}</h3>
          {!tops.length ? (
            <p className="mt-2 text-sm text-mute">Sem vendas suficientes para ranquear.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {tops.map((c) => (
                <li key={`${c.contactId || c.nome}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>
                    {c.nome}
                    <span className="ml-2 text-xs text-mute">{c.count}×</span>
                  </span>
                  <span className="font-semibold">{formatMoney(c.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      ) : (
        <p className="rounded-2xl border border-line bg-paper px-4 py-3 text-sm text-mute">
          Dashboard enxuto do Pro. Fluxo de caixa, metas, investimentos e visão avançada estão no{" "}
          <Link to="/assinar/premium" className="font-semibold text-navy">
            Premium (R$ 49,90/mês)
          </Link>
          .
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-line bg-paper p-4">
          <h2 className="text-sm font-semibold">Faturamento bruto {year}</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-mute">
                  <th className="py-2">Mês</th>
                  <th>Comércio</th>
                  <th>Serviço</th>
                  <th>Passageiros</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {series.map((row) => (
                  <tr key={row.month} className={cn(row.month === month && "bg-bg font-semibold")}>
                    <td className="py-1.5">{MONTHS_SHORT[row.month]}</td>
                    <td>{formatMoney(row.comercio)}</td>
                    <td>{formatMoney(row.servico)}</td>
                    <td>{formatMoney(row.passageiros)}</td>
                    <td>{formatMoney(row.faturamento)}</td>
                  </tr>
                ))}
                <tr className="border-t border-line font-bold">
                  <td className="py-2">Total</td>
                  <td>{formatMoney(series.reduce((a, r) => a + r.comercio, 0))}</td>
                  <td>{formatMoney(series.reduce((a, r) => a + r.servico, 0))}</td>
                  <td>{formatMoney(series.reduce((a, r) => a + r.passageiros, 0))}</td>
                  <td>{formatMoney(billed)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-4">
          {premium ? (
          <section className="rounded-2xl border border-line bg-paper p-4">
            <h2 className="text-sm font-semibold">Folha do colaborador</h2>
            {hasActiveEmployee(employee) ? (
              <>
                <p className="mt-2 text-sm font-medium">{employee.nome}</p>
                <p className="text-xs text-mute">
                  {employee.cargo} · {formatMoney(employee.salario)} ·{" "}
                  {payrolls.filter((p) => p.year === year && p.salaryPaid && p.daePaid).length} competências
                  encerradas
                </p>
                <Link to="/app/folha" className="mt-3 inline-block text-xs font-semibold text-ink">
                  Abrir folha do mês
                </Link>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-mute">
                  Este MEI não tem empregado. O regime permite no máximo um, no salário mínimo ou no piso da categoria.
                </p>
                <Link to="/app/folha" className="mt-3 inline-block text-xs font-semibold text-ink">
                  Cadastrar colaborador
                </Link>
              </>
            )}
          </section>
          ) : null}

          <section className="rounded-2xl border border-line bg-paper p-4">
            <h2 className="text-sm font-semibold text-ink">Limites do MEI</h2>
            <p className="mt-1 text-xs text-mute">Teto proporcional do ano {year}</p>
            <LimitRow label="Faturamento" used={billed} limit={fatLimit} pct={fat.pct} />
            <LimitRow label="Compras (80% do proporcional)" used={purchases} limit={buyLimit} pct={buy.pct} />
            <div
              className={cn(
                "mt-3 rounded-lg px-3 py-2 text-center text-sm font-bold text-white",
                fat.tone === "ok" ? "bg-green" : fat.tone === "warn" ? "bg-orange" : "bg-red",
              )}
            >
              {fat.label}
            </div>
            <Link to="/app/limites" className="mt-3 inline-block text-xs font-semibold text-ink">
              Ver gestão completa dos limites
            </Link>
          </section>

          <section className="rounded-2xl border border-line bg-paper p-4">
            <h2 className="text-sm font-semibold">Declaração de Imposto de Renda</h2>
            <p className="mt-2 text-xs text-mute">Limite de obrigação IRPF {formatMoney(33888)}</p>
            <p className="mt-1 text-sm">Lucro evidenciado {formatMoney(ir.lucro)}</p>
            <div
              className={cn(
                "mt-3 rounded-lg px-3 py-2 text-sm font-medium",
                ir.precisaDeclarar ? "bg-orange/10 text-orange" : "bg-green/10 text-green",
              )}
            >
              {ir.precisaDeclarar
                ? "Pelo lucro do MEI, avalie a obrigação de declarar o IRPF."
                : "Considerando somente a renda como MEI, você não precisa declarar o Imposto de Renda."}
            </div>
            <ul className="mt-3 space-y-1 text-xs text-mute">
              <li>Rendimentos isentos (lucros) {formatMoney(ir.isento)}</li>
              <li>Rendimentos tributáveis {formatMoney(ir.tributavel)}</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-line bg-paper p-4">
            <h2 className="text-sm font-semibold">DASN-SIMEI</h2>
            <p className="mt-2 text-sm">Comércio e indústrias {formatMoney(dasn.comercioIndustria)}</p>
            <p className="text-sm">Prestação de serviços {formatMoney(dasn.servicos)}</p>
            <p className="mt-2 text-xs text-mute">Despesas no ano {formatMoney(expenses)}</p>
          </section>
        </div>
      </div>
    </div>
  );
}

function Highlight({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-white/80">{label}</p>
      <p className="mt-1 text-lg font-semibold">{formatMoney(value)}</p>
    </div>
  );
}

function LimitRow({ label, used, limit, pct }: { label: string; used: number; limit: number; pct: number }) {
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-mute">
        <span>{label}</span>
        <span className="font-semibold text-green">{formatPercent(pct)}</span>
      </div>
      <p className="text-sm">
        {formatMoney(used)} de {formatMoney(limit)}
      </p>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-bg">
        <div className="h-full bg-green" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

function Shortcut({
  to,
  color,
  icon: Icon,
  label,
}: {
  to: string;
  color: string;
  icon: typeof Stamp;
  label: string;
}) {
  return (
    <Link to={to} className={cn("flex items-center gap-3 rounded-3xl px-4 py-4 text-white shadow-sm", color)}>
      <Icon className="size-5" />
      <span className="text-sm font-semibold">{label}</span>
    </Link>
  );
}
