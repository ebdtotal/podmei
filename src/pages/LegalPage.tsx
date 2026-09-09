import { Link } from "react-router-dom";

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <Link to="/" className="font-display text-lg text-ink">
            PODMEI
          </Link>
          <Link to="/entrar" className="text-sm font-medium text-ink">
            Entrar
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display text-3xl text-ink">{title}</h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-mute">{children}</div>
      </main>
      <footer className="border-t border-line py-6 text-center text-xs text-mute">
        <Link to="/privacidade" className="mx-2 hover:text-ink">
          Privacidade
        </Link>
        <Link to="/termos" className="mx-2 hover:text-ink">
          Termos
        </Link>
        <a className="mx-2 hover:text-ink" href="https://podmei.com">
          podmei.com
        </a>
      </footer>
    </div>
  );
}

export function PrivacidadePage() {
  return (
    <Shell title="Política de privacidade">
      <p>Última atualização: 5 de setembro de 2026.</p>
      <p>
        O PODMEI (
        <a className="font-medium text-ink underline" href="https://podmei.com">
          podmei.com
        </a>
        ) é um aplicativo de gestão financeira para MEI e escritórios contábeis. Esta política descreve quais dados
        tratamos no site e no app para iPhone.
      </p>
      <h2 className="pt-2 text-base font-semibold text-ink">Quais dados coletamos</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Cadastro: nome, e-mail, usuário e senha (hash).</li>
        <li>Dados do negócio: CNPJ, razão social, endereço e demais campos que você informar.</li>
        <li>Lançamentos, cadastros e relatórios gerados por você.</li>
        <li>Pagamento da assinatura via Mercado Pago (não guardamos o número completo do cartão).</li>
        <li>Registros técnicos de acesso para segurança e operação.</li>
      </ul>
      <h2 className="pt-2 text-base font-semibold text-ink">Para que usamos</h2>
      <p>
        Autenticar a conta, sincronizar o workspace na nuvem, processar assinaturas, enviar e-mails de acesso e manter o
        serviço estável. Não vendemos dados.
      </p>
      <h2 className="pt-2 text-base font-semibold text-ink">Compartilhamento</h2>
      <p>
        Compartilhamos apenas com provedores essenciais (hospedagem, e-mail e Mercado Pago) no limite necessário, ou quando
        a lei exigir.
      </p>
      <h2 className="pt-2 text-base font-semibold text-ink">Exclusão da conta</h2>
      <p>
        Você pode excluir a própria conta em <strong className="text-ink">Empresa → Excluir minha conta</strong> no app ou
        no site. Isso remove usuário, assinatura e workspace associados, salvo obrigação legal de guarda.
      </p>
      <h2 className="pt-2 text-base font-semibold text-ink">Contato</h2>
      <p>
        Dúvidas: canal de suporte da ficha na App Store ou{" "}
        <a className="font-medium text-ink underline" href="https://podmei.com">
          podmei.com
        </a>
        .
      </p>
    </Shell>
  );
}

export function TermosPage() {
  return (
    <Shell title="Termos de uso">
      <p>Última atualização: 5 de setembro de 2026.</p>
      <p>
        Ao assinar um plano ou entrar no PODMEI, você concorda com estes termos. O serviço é oferecido para gestão
        financeira do MEI e de escritórios contábeis (planos Pro e Contador).
      </p>
      <h2 className="pt-2 text-base font-semibold text-ink">Assinatura e pagamento</h2>
      <p>
        A cobrança é recorrente pelo Mercado Pago, conforme o plano escolhido no site. O acesso no aplicativo segue o plano
        pago. O acesso pode ser suspenso em caso de inadimplência. Você pode cancelar a renovação em Empresa.
      </p>
      <h2 className="pt-2 text-base font-semibold text-ink">Conta e responsabilidade</h2>
      <p>
        Você é responsável pelos dados lançados e por guardar o login em segurança. O PODMEI não substitui a Receita
        Federal nem orientação contábil oficial.
      </p>
      <h2 className="pt-2 text-base font-semibold text-ink">Uso aceitável</h2>
      <p>Não use o sistema para conteúdo ilegal, spam ou para acessar dados de outra conta. Podemos suspender contas em abuso.</p>
      <h2 className="pt-2 text-base font-semibold text-ink">Encerramento</h2>
      <p>
        Você pode excluir a conta a qualquer momento em Empresa. Após a exclusão, o acesso e os dados são removidos conforme
        a política de privacidade.
      </p>
    </Shell>
  );
}
