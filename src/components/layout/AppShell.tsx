import {
  Briefcase,
  Building2,
  CalendarDays,
  ContactRound,
  FileText,
  Gauge,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Receipt,
  Scale,
  Shield,
  BookOpen,
  Target,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/brand/ThemeToggle";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { hasPremiumAccess, isPremiumPath, plans } from "@/lib/plans";
import { cn } from "@/lib/utils";

const allLinks = [
  { to: "/contador", label: "Carteira", icon: Briefcase, end: false },
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/empresa", label: "Empresa", icon: Building2, end: false },
  { to: "/app/cadastros", label: "Clientes e fornecedores", icon: ContactRound, end: false },
  { to: "/app/produtos", label: "Produtos e serviços", icon: Package, end: false },
  { to: "/app/lancamentos", label: "Lançamentos", icon: BookOpen, end: false },
  { to: "/app/extrato", label: "Extrato bancário", icon: Landmark, end: false },
  { to: "/app/recibos", label: "Recibos", icon: Receipt, end: false },
  { to: "/app/contas", label: "A receber / pagar", icon: Scale, end: false },
  { to: "/app/fluxo-caixa", label: "Fluxo de caixa", icon: Wallet, end: false },
  { to: "/app/investimentos", label: "Investimentos", icon: TrendingUp, end: false },
  { to: "/app/calendario", label: "Calendário", icon: CalendarDays, end: false },
  { to: "/app/metas", label: "Metas", icon: Target, end: false },
  { to: "/app/folha", label: "Folha", icon: Users, end: false },
  { to: "/app/relatorios", label: "Relatórios", icon: FileText, end: false },
  { to: "/app/limites", label: "Limites", icon: Gauge, end: false },
];

const reportPaths = [
  "/app/relatorios",
  "/app/relatorio-oficial",
  "/app/dre",
  "/app/livro-caixa",
  "/app/livro-razao",
  "/app/das",
  "/app/dasn",
  "/app/irpf",
];

const mobilePrimaryPro = ["/app", "/app/lancamentos", "/app/contas", "/app/limites", "/app/relatorios"] as const;
const mobilePrimaryPremium = ["/app", "/app/lancamentos", "/app/contas", "/app/fluxo-caixa", "/app/calendario"] as const;

export function AppShell() {
  const { plan, company, clients, activeClientId, selectClient } = useStore();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const isMaster = user?.role === "master";
  const isContador = user?.plan === "contador" || isMaster;
  const premium = hasPremiumAccess(user);
  const carteiraTo = "/contador";
  const links = useMemo(() => {
    const base = isContador
      ? allLinks.map((link) =>
          link.to === "/contador"
            ? { ...link, to: carteiraTo, label: isMaster ? "Carteira Contador" : link.label }
            : link,
        )
      : allLinks.filter((link) => link.to !== "/contador");
    if (premium) return base;
    return base.filter((link) => !isPremiumPath(link.to));
  }, [isContador, isMaster, premium]);

  const tabs = useMemo(() => {
    const primary = (premium ? mobilePrimaryPremium : mobilePrimaryPro)
      .map((to) => links.find((l) => l.to === to))
      .filter(Boolean) as typeof links;
    return primary;
  }, [links, premium]);

  function linkActive(to: string, end?: boolean) {
    if (to === "/app/relatorios") return reportPaths.includes(pathname);
    if (end) return pathname === to;
    return pathname === to || pathname.startsWith(`${to}/`);
  }

  function shortLabel(label: string) {
    if (label === "A receber / pagar") return "Contas";
    return label;
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-line bg-paper md:flex">
        <div className="px-5 py-5">
          <Logo to="/app" />
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-mute hover:bg-bg hover:text-ink",
                  (link.to === "/app/relatorios" ? reportPaths.includes(pathname) : isActive) &&
                    "bg-navy text-white shadow-sm hover:bg-navy hover:text-white",
                )
              }
            >
              <link.icon className="size-4" />
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="m-3 rounded-xl border border-line bg-bg p-3">
          <p className="text-[11px] uppercase tracking-wider text-mute">MEI ativo</p>
          <select
            className="input mt-2 py-1.5 text-xs"
            value={activeClientId}
            onChange={(e) => selectClient(e.target.value)}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.status === "arquivado" ? `(Arq.) ${c.company.nome}` : c.company.nome}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-mute">{plans[plan]?.name ?? "PODMEI Pro"}</p>
          {isMaster ? (
            <div className="mt-2 flex flex-col gap-1.5">
              <Link to="/master" className="inline-flex items-center gap-1 text-xs font-semibold text-orange">
                <Shield className="size-3.5" />
                Alterar para master
              </Link>
              <Link to="/contador" className="inline-flex items-center gap-1 text-xs font-semibold text-ink">
                <Briefcase className="size-3.5" />
                Módulo contador
              </Link>
            </div>
          ) : isContador ? (
            <Link to={carteiraTo} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-ink">
              <Briefcase className="size-3.5" />
              Módulo contador
            </Link>
          ) : null}
        </div>
      </aside>

      <div className="md:pl-60">
        <header className="sticky top-0 z-10 border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/80">
          <div className="flex items-center justify-between gap-2 px-4 py-3 md:px-8">
            <div className="flex min-w-0 items-start gap-2 md:hidden">
              <button
                type="button"
                className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-bg text-ink"
                aria-label="Abrir menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(true)}
              >
                <Menu className="size-5" />
              </button>
              <div className="min-w-0">
                <Logo to="/app" />
                {isContador && clients.length > 1 ? (
                  <select
                    className="input mt-2 max-w-[14rem] py-1 text-[11px]"
                    value={activeClientId}
                    onChange={(e) => selectClient(e.target.value)}
                    aria-label="MEI ativo"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company.nome}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-1 truncate text-[11px] text-mute">{company.nome}</p>
                )}
              </div>
            </div>
            <p className="hidden text-sm text-mute md:block">O poder de cuidar do seu negócio.</p>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <ThemeToggle />
              {user ? (
                <button
                  className="btn-ghost gap-1 !px-2.5 text-xs sm:!px-4"
                  type="button"
                  onClick={() => {
                    logout();
                    navigate("/", { replace: true });
                  }}
                >
                  <LogOut className="size-3.5" />
                  <span className="hidden sm:inline">Sair</span>
                </button>
              ) : (
                <Link to="/" className="btn-ghost text-xs">
                  Início
                </Link>
              )}
            </div>
          </div>
        </header>

        <main className="min-w-0 px-4 py-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-8 md:py-6 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile app tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label="Navegação principal"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {tabs.map((link) => {
            const active = linkActive(link.to, link.end);
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold",
                  active ? "text-navy" : "text-mute",
                )}
              >
                <link.icon className={cn("size-5", active && "stroke-[2.5]")} />
                <span className="truncate">{shortLabel(link.label)}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {menuOpen ? (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu completo">
          <button
            type="button"
            className="absolute inset-0 bg-ink/40"
            aria-label="Fechar menu"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col bg-paper shadow-xl">
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
              <Logo to="/app" />
              <button
                type="button"
                className="grid size-10 place-items-center rounded-xl border border-line bg-bg text-ink"
                aria-label="Fechar menu"
                onClick={() => setMenuOpen(false)}
              >
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-3">
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-mute">Menu</p>
              <div className="flex flex-col gap-1">
                {links.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium",
                      linkActive(link.to, link.end)
                        ? "bg-navy text-white"
                        : "text-ink hover:bg-bg",
                    )}
                  >
                    <link.icon className="size-4 shrink-0" />
                    <span className="leading-tight">{link.label}</span>
                  </NavLink>
                ))}
              </div>
            </nav>
            <div className="border-t border-line p-3">
              <p className="text-[11px] uppercase tracking-wider text-mute">MEI ativo</p>
              <select
                className="input mt-2 py-1.5 text-xs"
                value={activeClientId}
                onChange={(e) => selectClient(e.target.value)}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.status === "arquivado" ? `(Arq.) ${c.company.nome}` : c.company.nome}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-mute">{plans[plan]?.name ?? "PODMEI Pro"}</p>
              {isMaster ? (
                <div className="mt-2 flex flex-col gap-1.5">
                  <Link
                    to="/master"
                    onClick={() => setMenuOpen(false)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-orange"
                  >
                    <Shield className="size-3.5" />
                    Alterar para master
                  </Link>
                  <Link
                    to="/contador"
                    onClick={() => setMenuOpen(false)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-ink"
                  >
                    <Briefcase className="size-3.5" />
                    Módulo contador
                  </Link>
                </div>
              ) : isContador ? (
                <Link
                  to={carteiraTo}
                  onClick={() => setMenuOpen(false)}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-ink"
                >
                  <Briefcase className="size-3.5" />
                  Módulo contador
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
