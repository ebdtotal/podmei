import { Briefcase, Building2, CreditCard, LayoutDashboard, LogOut, Settings, Users, Wallet } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/brand/ThemeToggle";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const links = [
  { to: "/master/clientes", label: "Clientes", icon: Building2, end: false },
  { to: "/master/assinaturas", label: "Assinaturas", icon: CreditCard, end: false },
  { to: "/master/leads", label: "Leads", icon: Users, end: false },
  { to: "/master/financeiro", label: "Financeiro", icon: Wallet, end: false },
  { to: "/contador", label: "Carteira Contador", icon: LayoutDashboard, end: false },
  { to: "/contador/escritorio", label: "Escritório", icon: Briefcase, end: false },
  { to: "/master/configuracoes", label: "Configurações", icon: Settings, end: false },
];

export function MasterShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-bg text-ink">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-line bg-paper md:flex">
        <div className="shrink-0 px-5 py-5">
          <Logo to="/master" />
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-orange">Acesso master</p>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-3 pb-2">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-mute hover:bg-bg hover:text-ink",
                  isActive && "bg-navy text-white hover:bg-navy hover:text-white",
                )
              }
            >
              <link.icon className="size-4" />
              {link.label}
            </NavLink>
          ))}
          <NavLink
            to="/app"
            className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-mute hover:bg-bg hover:text-ink"
          >
            <Building2 className="size-4" />
            Abrir MEI ativo
          </NavLink>
        </nav>
        <div className="m-3 shrink-0 rounded-xl border border-line bg-bg p-3">
          <p className="text-[11px] uppercase tracking-wider text-mute">Master</p>
          <p className="mt-1 text-sm font-semibold">{user?.nome || user?.username}</p>
          <p className="mt-1 text-xs text-mute">{user?.username}</p>
        </div>
      </aside>
      <div className="md:pl-60">
        <header className="sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-3 md:px-8">
            <div className="md:hidden">
              <Logo to="/master" />
            </div>
            <p className="hidden text-sm text-mute md:block">
              Clientes, assinaturas, leads, financeiro e a carteira de MEIs.
            </p>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                className="btn-ghost gap-2 text-xs"
                type="button"
                onClick={() => {
                  logout();
                  navigate("/entrar", { replace: true });
                }}
              >
                <LogOut className="size-3.5" />
                Sair
              </button>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:hidden">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium text-mute",
                    isActive && "bg-navy text-white",
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
            <NavLink to="/app" className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium text-mute">
              Abrir MEI
            </NavLink>
          </nav>
        </header>
        <main className="px-4 py-6 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
