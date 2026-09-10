import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";
import { allowsExternalPurchaseUi } from "@/lib/native";
import { platform } from "@/lib/platform";

const SESSION_KEY = "podmei-assine";

export type AssinarRetornoTipo = "sucesso" | "falha" | "pendente";

export function AssinarRetornoPage({ tipo }: { tipo: AssinarRetornoTipo }) {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<"aguardando" | "pago" | "pendente" | "erro">(
    tipo === "sucesso" ? "aguardando" : tipo === "pendente" ? "pendente" : "erro",
  );
  const [info, setInfo] = useState<{
    email: string;
    nome: string;
    username?: string;
    tempPassword?: string;
    emailSent?: boolean;
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (tipo !== "sucesso") return;
    let salvo: { email?: string; nome?: string; signupId?: string } = {};
    try {
      salvo = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "{}") as typeof salvo;
    } catch {
      /* ignore */
    }
    const sid = params.get("sid") || params.get("external_reference") || salvo.signupId || "";
    const paymentId = params.get("payment_id") || params.get("collection_id") || "";
    const preapprovalId = params.get("preapproval_id") || "";
    if (!sid && !preapprovalId) {
      setStatus("erro");
      setErro("Não encontramos esta assinatura. Se o pagamento foi aprovado, fale no suporte.");
      return;
    }

    let cancel = false;
    const esperar = async () => {
      for (let i = 0; i < 16; i++) {
        try {
          const r = await platform.paymentStatus(sid || salvo.signupId || "", paymentId || undefined, preapprovalId || undefined);
          if (cancel) return;
          setInfo({
            email: r.email || salvo.email || "",
            nome: r.nome || salvo.nome || "",
            username: r.username,
            tempPassword: r.tempPassword,
            emailSent: r.emailSent,
          });
          if (r.status === "pago") {
            setStatus("pago");
            return;
          }
        } catch (err) {
          if (cancel) return;
          if (i === 15) {
            setStatus("erro");
            setErro(err instanceof Error ? err.message : "Não foi possível confirmar o pagamento.");
            return;
          }
        }
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
      }
      if (!cancel) setStatus("pendente");
    };
    void esperar();
    return () => {
      cancel = true;
    };
  }, [tipo, params]);

  const titulo =
    status === "pago"
      ? "Pagamento confirmado"
      : status === "erro" || tipo === "falha"
        ? tipo === "falha"
          ? "Pagamento não concluído"
          : "Não foi possível confirmar"
        : status === "pendente" || tipo === "pendente"
          ? "Pagamento em análise"
          : "Confirmando pagamento";

  return (
    <div className="min-h-screen bg-bg px-4 py-10">
      <div className="mx-auto max-w-lg rounded-3xl border border-line bg-paper p-8">
        <Logo full />
        <h1 className="mt-6 text-center font-display text-3xl text-ink">{titulo}</h1>
        {tipo === "falha" ? (
          <p className="mt-2 text-center text-sm text-mute">
            Você pode tentar de novo. Nenhum acesso é criado antes do pagamento aprovado.
          </p>
        ) : null}
        {(status === "pendente" || tipo === "pendente") && status !== "pago" ? (
          <p className="mt-2 text-center text-sm text-mute">
            Assim que o pagamento for aprovado, enviamos o usuário e a senha inicial para o e-mail cadastrado.
          </p>
        ) : null}
        {tipo === "sucesso" && status === "aguardando" ? (
          <p className="mt-2 text-center text-sm text-mute">
            Estamos confirmando o pagamento e preparando o seu acesso…
          </p>
        ) : null}
        {status === "pago" ? (
          <div className="mt-2 space-y-3 text-center text-sm text-mute">
            <p>
              {info?.emailSent === false
                ? "Pagamento ok. O e-mail automático falhou — use os dados abaixo:"
                : "Enviamos o login e a senha inicial para "}
              {info?.emailSent !== false ? <b>{info?.email || "o e-mail cadastrado"}</b> : null}
              {info?.nome ? ` (${info.nome})` : ""}.
            </p>
            {info?.username && info?.tempPassword ? (
              <div className="rounded-2xl bg-bg p-4 text-left text-ink">
                <p>
                  Usuário: <strong>{info.username}</strong>
                </p>
                <p>
                  Senha: <strong>{info.tempPassword}</strong>
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
        {status === "pendente" && tipo === "sucesso" ? (
          <p className="mt-2 text-center text-sm text-mute">
            O pagamento ainda está sendo confirmado. Se o e-mail não chegar em alguns minutos, fale no suporte.
          </p>
        ) : null}
        {erro ? <p className="mt-3 text-center text-sm text-red">{erro}</p> : null}
        <div className="mt-8 space-y-3">
          {status === "pago" ? (
            <Link to="/entrar" className="btn-primary flex w-full justify-center">
              Ir para o login
            </Link>
          ) : (
            <Link
              to={allowsExternalPurchaseUi() ? "/assinar/pro" : "/entrar"}
              className="btn-primary flex w-full justify-center"
            >
              {allowsExternalPurchaseUi()
                ? tipo === "falha"
                  ? "Tentar de novo"
                  : "Voltar aos planos"
                : "Ir para o login"}
            </Link>
          )}
          <Link to="/" className="block text-center text-sm font-semibold text-ink">
            Início
          </Link>
        </div>
      </div>
    </div>
  );
}
