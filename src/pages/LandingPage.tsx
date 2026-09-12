import { Link } from "react-router-dom";
import {
  ArrowRight,
  Camera,
  FileText,
  Gauge,
  Lock,
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
    a: "Não. O MEI usa o PODMEI Pro no dia a dia. O contador entra no PODMEI Contador, troca de CNPJ e acompanha limite, DAS e relatórios de todos os clientes.",
  },
  {
    q: "Os dados ficam onde?",
    a: "Na sua conta online (nuvem). Entre com usuário e senha em qualquer computador e a área do MEI carrega sozinha. Também dá para exportar um backup em arquivo.",
  },
  {
    q: "Como funciona a cobrança?",
    a: "A assinatura é recorrente no Mercado Pago (mensal ou anual) até você cancelar em Empresa. O acesso é liberado após a confirmação do pagamento.",
  },
  {
    q: "Qual plano escolher?",
    a: "PODMEI Pro é para o MEI cuidar da própria empresa. PODMEI Contador é para o escritório administrar a carteira de CNPJs.",
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

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:py-24">
        <div>
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
            Cadastre a empresa, acompanhe o limite de faturamento, importe o extrato do banco e tire DRE, livro-caixa
            e a declaração anual — no formato que o fisco espera.
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
        <HeroCard />
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
              ? "Pro, Premium e Contador. Assinatura pela App Store neste app."
              : canPurchase
                ? "Pro para o essencial. Premium para caixa e visão completa. Contador para o escritório."
                : "Pro, Premium e Contador."}
          </p>
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
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

function HeroCard() {
  return (
    <div className="rounded-3xl p-6 text-white shadow-lg" style={{ background: "linear-gradient(135deg, #7B2CF5, #2563EB)" }}>
      <p className="text-xs font-semibold text-white/80">Limite MEI 2026</p>
      <p className="mt-2 font-display text-3xl">63,07% usado</p>
      <p className="mt-1 text-sm text-white/70">R$ 51.090,51 de R$ 81.000,00</p>
      <div className="mt-4 h-2 rounded-full bg-white/15">
        <div className="h-2 w-[63%] rounded-full bg-green" />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-white/10 p-3">
          <p className="text-white/60">Serviços no mês</p>
          <p className="mt-1 font-semibold">R$ 8.431,00</p>
        </div>
        <div className="rounded-xl bg-green p-3">
          <p className="text-white/80">Status</p>
          <p className="mt-1 font-semibold">Dentro do limite</p>
        </div>
      </div>
    </div>
  );
}
