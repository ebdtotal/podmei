import {
  Briefcase,
  Building2,
  ContactRound,
  Ellipsis,
  FileText,
  Gauge,
  Landmark,
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  Scale,
  Wallet,
  BookOpen,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/brand/ThemeToggle";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { plans } from "@/lib/plans";
import { cn } from "@/lib/utils";

const links = [
  { to: "/contador", label: "Carteira", icon: Briefcase, end: false },
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/empresa", label: "Empresa", icon: Building2, end: false },
  { to: "/app/cadastros", label: "Clientes e fornecedores", icon: ContactRound, end: false },
  { to: "/app/produtos", label: "Produtos e serviços", icon: Package, end: false },
  { to: "/app/lancamentos", label: "Lançamentos", icon: BookOpen, end: false },
  { to: "/app/extrato", label: "Extrato bancário", icon: Landmark, end: false },
  { to: "/app/recibos", label: "Recibos", icon: Receipt, end: false },
  { to: "/app/contas", label: "A receber / pagar", icon: Scale, end: false },
  { to: "/app/folha", label: "Folha", icon: Users, end: false },
  { to: "/app/relatorios", label: "Relatórios", icon: FileText, end: false },
  { to: "/app/limites", label: "Limites", icon: Gauge, end: false },
  { to: "/app/planos", label: "Planos", icon: Wallet, end: false },
];

const reportPaths = [
  "/app/relatorios",
  "/app/relatorio-oficial",
  "/app/dre",
  "/app/livro-caixa",
  "/app/livro-razao",
  "/app/das",
  "/app/dasn",
];

const mobilePrimary = ["/app", "/app/lancamentos", "/app/contas", "/app/relatorios"] as const;

export function AppShell() {
  const { plan, company, clients, activeClientId, selectClient } = useStore();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const isMaster = user?.role === "master";
  const isContador = user?.plan === "contador" || isMaster;
  const carteiraTo = "/contador";
  const nav = isContador
    ? links.map((link) =>
        link.to === "/contador"
          ? { ...link, to: carteiraTo, label: isMaster ? "Carteira Contador" : link.label }
          : link,
      )
    : links.filter((link) => link.to !== "/contador");

  const tabs = useMemo(() => {
    const primary = mobilePrimary
      .map((to) => nav.find((l) => l.to === to))
      .filter(Boolean) as typeof nav;
    return primary;
  }, [nav]);

  const moreLinks = useMemo(
    () => nav.filter((l) => !mobilePrimary.includes(l.to as (typeof mobilePrimary)[number])),
    [nav],
  );

  const moreActive = moreLinks.some((l) =>
    l.to === "/app/relatorios" ? false : pathname === l.to || pathname.startsWith(`${l.to}/`),
  );

  function linkActive(to: string, end?: boolean) {
    if (to === "/app/relatorios") return reportPaths.includes(pathname);
    if (end) return pathname === to;
    return pathname === to || pathname.startsWith(`${to}/`);
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-line bg-paper md:flex">
        <div className="px-5 py-5">
          <Logo to="/app" />
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {nav.map((link) => (
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
          {isContador ? (
            <Link to={carteiraTo} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-ink">
              <Briefcase className="size-3.5" />
              Carteira do contador
            </Link>
          ) : null}
        </div>
      </aside>

      <div className="md:pl-60">
        <header className="sticky top-0 z-10 border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/80">
          <div className="flex items-center justify-between gap-2 px-4 py-3 md:px-8">
            <div className="min-w-0 md:hidden">
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

        <main className="px-4 py-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-8 md:py-6 md:pb-8">
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
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold",
                  active ? "text-navy" : "text-mute",
                )}
              >
                <link.icon className={cn("size-5", active && "stroke-[2.5]")} />
                <span className="truncate">{link.label === "A receber / pagar" ? "Contas" : link.label}</span>
              </NavLink>
            );
          })}
          <button
            type="button"
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold",
              moreOpen || moreActive ? "text-navy" : "text-mute",
            )}
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
          >
            <Ellipsis className="size-5" />
            Mais
          </button>
        </div>
      </nav>

      {moreOpen ? (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-ink/40"
            aria-label="Fechar menu"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] max-h-[70vh] overflow-y-auto rounded-t-3xl border border-line bg-paper p-4 shadow-xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-mute">Mais opções</p>
            <div className="grid grid-cols-2 gap-2">
              {moreLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-2xl border border-line px-3 py-3 text-sm font-medium",
                    linkActive(link.to, link.end) ? "border-navy bg-navy/10 text-navy" : "text-ink",
                  )}
                >
                  <link.icon className="size-4 shrink-0" />
                  <span className="leading-tight">{link.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
