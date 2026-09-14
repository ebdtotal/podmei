import { Link } from "react-router-dom";
import { type ReactNode } from "react";
import {
  ArrowRight,
  Camera,
  FileText,
  Gauge,
  Lock,
  Package,
  Receipt,
  Shield,
  ShieldCheck,
  TrendingUp,
  UserRound,
  Users,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/brand/ThemeToggle";
import { allowsExternalPurchaseUi, isIosApp } from "@/lib/native";
import { PLAN_KEYS, plans } from "@/lib/plans";
import { cn, formatMoney } from "@/lib/utils";

const features = [
  {
    icon: Gauge,
    title: "Limite do MEI visível",
    text: "Acompanhe os R$ 81 mil, o teto proporcional na abertura e a faixa de 20% do desenquadramento.",
  },
  {
    icon: Camera,
    title: "Áudio, texto e extrato",
    text: "Lance compra e venda por texto ou áudio, ou importe o PDF/Excel do banco.",
  },
  {
    icon: Package,
    title: "Controle de estoque",
    text: "Entrada e saída nas compras e vendas, custo médio, margem e alerta de produtos em falta ou parados.",
  },
  {
    icon: Users,
    title: "Clientes e fornecedores",
    text: "Cadastre quem compra e quem vende para o MEI e use nos lançamentos e nas contas.",
  },
  {
    icon: Receipt,
    title: "DRE, livro-caixa e razão",
    text: "Relatórios gerenciais prontos para imprimir, alimentados pelos lançamentos.",
  },
  {
    icon: FileText,
    title: "Receitas brutas automáticas",
    text: "O relatório mensal no modelo do MEI (comércio, indústria e serviços, com e sem nota).",
  },
  {
    icon: ShieldCheck,
    title: "DAS e DASN-SIMEI",
    text: "Cálculo do DAS 2026, competências pagas e planilha da declaração anual, com link oficial.",
  },
];

const values = [
  {
    icon: Zap,
    color: "text-[#7B2CF5]",
    title: "Simples",
    text: "Fácil de usar, feito para o seu dia a dia.",
  },
  {
    icon: ShieldLock,
    color: "text-[#2563EB]",
    title: "Confiável",
    text: "Seus dados e seu negócio protegidos.",
  },
  {
    icon: Users,
    color: "text-[#2563EB]",
    title: "Próxima",
    text: "Sempre com você, em cada passo.",
  },
  {
    icon: TrendingUp,
    color: "text-[#22C55E]",
    title: "Inteligente",
    text: "Tecnologia que trabalha por você.",
  },
];

const faqs = [
  {
    q: "Substitui o contador?",
    a: "Não. O MEI usa o PODMEI Pro ou Premium no dia a dia. O escritório entra no Contador ou Contador Premium, troca de CNPJ e acompanha os clientes. Contador Premium trata o próprio escritório como Simples Nacional, sem o teto de R$ 81 mil do MEI, e envia cobranças automáticas por e-mail nas contas a receber.",
  },
  {
    q: "Os dados ficam onde?",
    a: "Na sua conta online (nuvem). Entre com usuário e senha em qualquer computador e a área do MEI carrega sozinha. Também dá para exportar um backup em arquivo.",
  },
  {
    q: "Como funciona a cobrança?",
    a: "A assinatura é recorrente no Mercado Pago (mensal ou anual) até você cancelar em Empresa. O acesso é liberado após a confirmação do pagamento. No Contador Premium, o escritório ainda dispara e-mails automáticos de cobrança aos clientes (3 dias antes, no dia e 3 dias depois se não houver baixa), com assinatura configurável.",
  },
  {
    q: "Qual plano escolher?",
    a: "PODMEI Pro ou Premium para o MEI cuidar da própria empresa. Contador para a carteira de CNPJs. Contador Premium para o escritório no Simples Nacional, com ferramentas Premium e cobrança automática por e-mail.",
  },
];

function ShieldLock({ className, strokeWidth = 1.6 }: { className?: string; strokeWidth?: number }) {
  return (
    <span className={cn("relative inline-flex size-10 items-center justify-center", className)}>
      <Shield className="size-10" strokeWidth={strokeWidth} />
      <Lock className="absolute size-3.5" strokeWidth={2.2} />
    </span>
  );
}

export function LandingPage() {
  const canPurchase = allowsExternalPurchaseUi() || isIosApp();

  return (
    <div className="bg-bg text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo full />
          <nav className="hidden items-center gap-6 text-sm text-mute md:flex">
            <a href="#produto">Produto</a>
            <a href="#planos">Planos</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            {canPurchase ? (
              <Link to="/assinar/contador" className="hidden text-sm font-semibold text-ink sm:inline">
                Sou contador
              </Link>
            ) : null}
            <ThemeToggle />
            <Link to="/entrar" className={canPurchase ? "btn-ghost hidden sm:inline-flex" : "btn-ghost"}>
              Entrar
            </Link>
            {canPurchase ? (
              <Link to="/assinar/pro" className="btn-primary">
                Assinar
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 md:grid-cols-2 md:gap-10 md:py-20">
        <div className="relative z-10">
          <h1 className="flex items-center gap-4 md:gap-5">
            <img
              src="/pod-mei-icon.png"
              alt=""
              className="size-16 shrink-0 rounded-2xl object-cover shadow-md md:size-[5.25rem]"
            />
            <span className="leading-[1.05]">
              <span className="block font-display text-5xl font-bold tracking-tight md:text-7xl">
                POD<span className="text-[#22C55E]">MEI</span>
              </span>
              <span className="mt-1 block text-base font-medium md:text-xl">
                O poder de cuidar do <span className="text-[#22C55E]">seu negócio.</span>
              </span>
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-mute">
            Cadastre a empresa, controle estoque e margem, acompanhe o limite de faturamento, importe o extrato do banco
            e tire DRE, livro-caixa e a declaração anual — no formato que o fisco espera.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {canPurchase ? (
              <Link to="/assinar/pro" className="btn-primary h-12 gap-2 px-5">
                Assinar PODMEI Pro
                <ArrowRight className="size-4" />
              </Link>
            ) : null}
            <Link to="/entrar" className={canPurchase ? "btn-ghost h-12 px-5" : "btn-primary h-12 gap-2 px-5"}>
              {canPurchase ? "Abrir o sistema" : "Entrar na conta"}
              {!canPurchase ? <ArrowRight className="size-4" /> : null}
            </Link>
          </div>
        </div>
        <div className="relative min-h-[340px] pb-8 sm:min-h-[380px] md:min-h-[420px] md:pb-4">
          <HeroShowcase />
        </div>
      </section>

      <section id="produto" className="border-y border-line bg-paper py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 md:grid-cols-3">
          {features.map((f) => (
            <article key={f.title} className="rounded-2xl border border-line p-5">
              <f.icon className="size-6 text-navy" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-mute">{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((item) => (
            <article key={item.title} className="text-center">
              <item.icon className={cn("mx-auto size-10", item.color)} strokeWidth={1.6} />
              <h3 className="mt-4 font-display text-lg uppercase tracking-wide text-ink">{item.title}</h3>
              <p className="mt-2 text-sm text-mute">{item.text}</p>
            </article>
          ))}
        </div>
        <div
          className="mt-12 flex flex-col items-center gap-5 rounded-[2rem] px-6 py-6 text-center text-white sm:flex-row sm:rounded-full sm:px-8 sm:text-left"
          style={{ background: "linear-gradient(90deg, #7B2CF5 0%, #22C55E 100%)" }}
        >
          <span className="grid size-14 shrink-0 place-items-center rounded-full border-2 border-white">
            <UserRound className="size-7" strokeWidth={1.6} />
          </span>
          <p className="font-display text-xl leading-tight md:text-2xl">
            Você cuida do negócio.
            <br />
            O <span className="text-[#BBF7D0]">PODMEI</span> cuida da organização.
          </p>
        </div>
      </section>

      <section id="planos" className="mx-auto max-w-6xl px-4 py-16">
        <div>
          <h2 className="font-display text-4xl text-ink">Pacotes de acesso</h2>
          <p className="mt-2 text-mute">
            {isIosApp()
              ? "Pro, Premium, Contador e Contador Premium (com cobrança automática por e-mail). Assinatura pela App Store neste app."
              : canPurchase
                ? "Pro para o essencial. Premium para o MEI. Contador para a carteira. Contador Premium com Simples Nacional e cobranças automáticas por e-mail."
                : "Pro, Premium, Contador e Contador Premium (cobranças automáticas por e-mail)."}
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PLAN_KEYS.map((key) => {
            const p = plans[key];
            return (
              <article
                key={key}
                className={cn("rounded-3xl border bg-paper p-6", p.popular ? "border-green shadow-sm" : "border-line")}
              >
                {p.popular ? (
                  <p className="text-xs font-bold uppercase tracking-wide text-orange">Mais escolhido</p>
                ) : null}
                <h3 className="mt-1 font-display text-2xl">{p.name}</h3>
                <p className="mt-1 text-sm text-mute">{p.who}</p>
                <p className="mt-4 font-display text-4xl text-ink">
                  {formatMoney(p.month)}
                  <span className="text-base font-sans text-mute">/mês</span>
                </p>
                <ul className="mt-4 space-y-2 text-sm text-ink">
                  {p.features.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
                {canPurchase ? (
                  <Link to={`/assinar/${key}`} className="btn-primary mt-6 inline-flex w-full">
                    Assinar {p.name}
                  </Link>
                ) : (
                  <p className="mt-6 text-sm text-mute">Disponível para assinantes. Entre com sua conta.</p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section id="faq" className="border-t border-line bg-paper py-16">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="font-display text-3xl text-ink">Perguntas frequentes</h2>
          <div className="mt-6 space-y-4">
            {faqs.map((item) => (
              <article key={item.q} className="rounded-xl border border-line p-4">
                <h3 className="font-semibold">{item.q}</h3>
                <p className="mt-1 text-sm text-mute">{item.a}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-line py-8 text-center text-xs text-mute">
        <p>POD MEI · O poder de cuidar do seu negócio. · não substitui a Receita Federal</p>
        <p className="mt-2">
          <Link to="/privacidade" className="mx-2 hover:text-ink">
            Privacidade
          </Link>
          <Link to="/termos" className="mx-2 hover:text-ink">
            Termos
          </Link>
        </p>
      </footer>
    </div>
  );
}

function HeroShowcase() {
  return (
    <div
      className="relative mx-auto w-full max-w-xl select-none md:max-w-none"
      aria-label="Prévia do sistema PODMEI"
    >
      <div
        className="pointer-events-none absolute -inset-6 rounded-[2rem] opacity-70 blur-2xl md:-inset-8"
        style={{ background: "linear-gradient(135deg, rgba(123,44,245,0.18), rgba(34,197,94,0.16))" }}
        aria-hidden
      />

      {/* Print secundário: estoque */}
      <div className="absolute -right-1 top-6 z-0 w-[72%] rotate-[5deg] scale-[0.92] opacity-95 shadow-xl transition duration-500 md:-right-3 md:top-4 md:w-[78%]">
        <UiFrame title="Produtos e serviços">
          <div className="space-y-2 p-3 text-[10px] leading-snug text-slate-700 sm:text-[11px]">
            <div className="grid grid-cols-3 gap-1.5">
              <MiniStat label="Produtos" value="12" />
              <MiniStat label="Em alerta" value="2" tone="orange" />
              <MiniStat label="Valor estoque" value="R$ 4.280" />
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <div className="grid grid-cols-[1.4fr_0.7fr_0.8fr] bg-[#7B2CF5] px-2 py-1 text-[9px] font-semibold text-white">
                <span>Item</span>
                <span>Estoque</span>
                <span>Margem</span>
              </div>
              <RowProd nome="Camiseta básica" est="25 un" margem="R$ 22,40" />
              <RowProd nome="Caneca personalizada" est="3 un · baixo" margem="R$ 14,10" alert />
              <RowProd nome="Kit adesivos" est="40 un" margem="R$ 8,90" />
            </div>
          </div>
        </UiFrame>
      </div>

      {/* Print principal: painel */}
      <div className="relative z-10 w-[88%] -rotate-[2deg] shadow-2xl transition duration-500 hover:rotate-0">
        <UiFrame title="Painel do MEI" wide>
          <div className="space-y-2.5 p-3 text-[10px] leading-snug text-slate-700 sm:p-4 sm:text-[11px]">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Painel do MEI</p>
              <p className="font-display text-sm font-bold text-slate-900 sm:text-base">Minha Empresa MEI</p>
              <p className="text-[10px] text-slate-500">00.000.000/0001-00 · Cidade/UF</p>
            </div>
            <div className="rounded-lg bg-[#7B2CF5] p-2.5 text-white sm:p-3">
              <p className="text-[9px] text-white/75">Limite MEI 2026</p>
              <p className="font-display text-lg font-bold sm:text-xl">58%</p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/20">
                <div className="h-full w-[58%] rounded-full bg-[#22C55E]" />
              </div>
              <p className="mt-1 text-[10px] text-white/80">R$ 46.980 de R$ 81.000 · dentro do limite</p>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <MiniStat label="Receita do mês" value="R$ 8.430" />
              <MiniStat label="Resultado" value="R$ 5.100" tone="green" />
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
              <p className="text-[9px] font-semibold text-slate-500">Próximos avisos</p>
              <p className="mt-0.5 text-[10px]">DAS do mês · vencimento dia 20</p>
              <p className="text-[10px] text-amber-700">2 produtos com estoque baixo</p>
            </div>
          </div>
        </UiFrame>
      </div>

      {/* Print terciário: margem na venda */}
      <div className="absolute -bottom-2 left-0 z-20 w-[64%] rotate-[-4deg] shadow-xl transition duration-500 md:-bottom-4 md:left-2 md:w-[58%]">
        <UiFrame title="Lançamentos">
          <div className="space-y-2 p-3 text-[10px] leading-snug text-slate-700 sm:text-[11px]">
            <p className="font-semibold text-slate-900">Venda · comércio</p>
            <p className="text-slate-500">Produto demo · qtd 2 · R$ 49,90</p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Margem da venda</p>
              <p className="mt-0.5">CMV R$ 27,50/un · margem R$ 44,80</p>
              <p className="font-semibold text-[#7B2CF5]">Máx. desconto sem prejuízo: R$ 44,80 (45%)</p>
            </div>
          </div>
        </UiFrame>
      </div>
    </div>
  );
}

function UiFrame({
  title,
  children,
  wide,
}: {
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.14)]",
        wide ? "min-h-[240px]" : "",
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-3 py-2">
        <span className="size-2 rounded-full bg-red-500" />
        <span className="size-2 rounded-full bg-amber-500" />
        <span className="size-2 rounded-full bg-green-500" />
        <span className="ml-2 truncate text-[10px] font-medium text-slate-500">{title}</span>
      </div>
      <div className="flex">
        <div className="hidden w-14 shrink-0 border-r border-slate-100 bg-[#f8fafc] p-2 sm:block">
          <div className="mb-2 size-5 rounded" style={{ background: "linear-gradient(135deg, #7B2CF5, #22C55E)" }} />
          <div className="space-y-1.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={cn("h-1.5 rounded", i === 1 ? "bg-violet-500" : "bg-slate-200")}
              />
            ))}
          </div>
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "orange";
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-semibold text-slate-900",
          tone === "green" && "text-[#16a34a]",
          tone === "orange" && "text-[#ea580c]",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function RowProd({
  nome,
  est,
  margem,
  alert,
}: {
  nome: string;
  est: string;
  margem: string;
  alert?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1.4fr_0.7fr_0.8fr] border-t border-slate-100 px-2 py-1.5">
      <span className="truncate font-medium">{nome}</span>
      <span className={cn(alert && "font-semibold text-amber-700")}>{est}</span>
      <span>{margem}</span>
    </div>
  );
}
