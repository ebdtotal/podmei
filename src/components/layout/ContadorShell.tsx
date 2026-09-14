import { Briefcase, Building2, LayoutDashboard, LogOut } from "lucide-react";
import { useMemo, type MouseEvent } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/brand/ThemeToggle";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const baseLinks = [
  { to: "/contador/carteira", label: "Carteira", icon: LayoutDashboard, end: false },
  { to: "/contador/escritorio", label: "Escritório", icon: Briefcase, end: false },
];

const premiumHubLinks = [
  { to: "/contador", label: "Início", icon: LayoutDashboard, end: true },
  { to: "/app", label: "Meu escritório", icon: Building2, end: false, office: true },
  { to: "/contador/carteira", label: "Carteira de MEIs", icon: Briefcase, end: false },
  { to: "/contador/escritorio", label: "Escritório", icon: Briefcase, end: false },
];

function officeClientId(
  clients: { id: string; status: string; company: { regimeTributario?: string } }[],
) {
  return (
    clients.find((c) => c.company.regimeTributario === "simples_nacional" && c.status === "ativo")?.id ||
    clients.find((c) => c.company.regimeTributario === "simples_nacional")?.id ||
    ""
  );
}

export function ContadorShell() {
  const { accountant, clients } = useStore();
  const { selectClient } = useStore();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const ativos = clients.filter(
    (c) => c.status === "ativo" && c.company.regimeTributario !== "simples_nacional",
  ).length;
  const isMaster = user?.role === "master";
  const isPremium = user?.plan === "contador_premium";
  const links = useMemo(() => (isPremium ? premiumHubLinks : baseLinks), [isPremium]);

  function goOffice(e: MouseEvent) {
    e.preventDefault();
    const id = officeClientId(clients);
    if (id) selectClient(id);
    navigate("/app");
  }

  return (
    <div className={cn("min-h-screen bg-bg text-ink", isPremium && "theme-contador")}>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-line md:flex",
          isPremium ? "bg-[#f3e8ff]" : "bg-paper",
        )}
      >
        <div className="shrink-0 px-5 py-5">
          <Logo to="/contador" />
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-orange">
            {isMaster ? "Master · Contador" : isPremium ? "Contador Premium" : "Módulo do contador"}
          </p>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-3 pb-2">
          {links.map((link) =>
            "office" in link && link.office ? (
              <button
                key={link.label}
                type="button"
                onClick={goOffice}
                className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-medium text-mute hover:bg-white/70 hover:text-ink"
              >
                <link.icon className="size-4" />
                {link.label}
              </button>
            ) : (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-mute hover:bg-white/70 hover:text-ink",
                    isActive && "bg-navy text-white hover:bg-navy hover:text-white",
                  )
                }
              >
                <link.icon className="size-4" />
                {link.label}
              </NavLink>
            ),
          )}
          {!isPremium ? (
            <NavLink
              to="/app"
              className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-mute hover:bg-bg hover:text-ink"
            >
              <Building2 className="size-4" />
              Abrir MEI ativo
            </NavLink>
          ) : null}
          {isMaster ? (
            <NavLink
              to="/master"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-mute hover:bg-bg hover:text-ink"
            >
              <Briefcase className="size-4" />
              Painel master
            </NavLink>
          ) : null}
        </nav>
        <div className="m-3 shrink-0 rounded-xl border border-line bg-white/80 p-3">
          <p className="text-[11px] uppercase tracking-wider text-mute">Escritório</p>
          <p className="mt-1 text-sm font-semibold">{accountant.escritorio}</p>
          <p className="mt-1 text-xs text-mute">
            {ativos} MEI{ativos === 1 ? "" : "s"} na carteira
          </p>
        </div>
      </aside>
      <div className="md:pl-60">
        <header className="sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-3 md:px-8">
            <div className="md:hidden">
              <Logo to="/contador" />
            </div>
            <p className="hidden text-sm text-mute md:block">
              {accountant.nome || accountant.escritorio} · CRC {accountant.crc || "—"}
            </p>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                className="btn-ghost gap-1 text-xs"
                type="button"
                onClick={() => {
                  logout();
                  navigate("/entrar", { replace: true });
                }}
              >
                <LogOut className="size-3.5" />
                Sair
              </button>
              <span className="rounded-full bg-green px-3 py-1 text-xs font-semibold text-white">
                {isPremium ? "CONTADOR PREMIUM" : "CONTADOR"}
              </span>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:hidden">
            {links.map((link) =>
              "office" in link && link.office ? (
                <button
                  key={link.label}
                  type="button"
                  onClick={goOffice}
                  className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium text-mute"
                >
                  {link.label}
                </button>
              ) : (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    cn(
                      "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium text-mute",
                      isActive && "bg-navy text-white",
                    )
                  }
                >
                  {link.label}
                </NavLink>
              ),
            )}
          </nav>
        </header>
        <main className="px-4 py-6 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
