import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Check, Copy, ExternalLink } from "lucide-react";
import { IosPurchaseBlocked } from "@/components/auth/IosPurchaseBlocked";
import { Logo } from "@/components/brand/Logo";
import { allowsExternalPurchaseUi } from "@/lib/native";
import { mercadoPagoCheckoutUrl, redirectToMercadoPago } from "@/lib/payment";
import { plans } from "@/lib/plans";
import { platform } from "@/lib/platform";
import type { ConfirmPaymentResult, Lead } from "@/lib/platform-types";
import { formatMoney } from "@/lib/utils";

export function PayPage() {
  if (!allowsExternalPurchaseUi()) return <IosPurchaseBlocked />;
  return <PayPageInner />;
}

function PayPageInner() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const [lead, setLead] = useState<Lead | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");
  const [result, setResult] = useState<ConfirmPaymentResult | null>(null);
  const triedReturn = useRef(false);
  const redirected = useRef(false);

  const mpStatus = params.get("mp") || params.get("collection_status") || params.get("status") || "";
  const paymentId = params.get("payment_id") || params.get("collection_id") || "";

  useEffect(() => {
    if (!id) return;
    platform
      .getLead(id)
      .then(setLead)
      .catch((err) => setError(err instanceof Error ? err.message : "Pagamento não encontrado."));
  }, [id]);

  useEffect(() => {
    if (!lead || redirected.current) return;
    if (lead.status !== "aguardando_pagamento") return;
    if (mpStatus || paymentId) return;
    const url = mercadoPagoCheckoutUrl(lead);
    if (!url) return;
    redirected.current = true;
    redirectToMercadoPago(lead);
  }, [lead, mpStatus, paymentId]);

  useEffect(() => {
    if (!id || !lead || lead.status === "ativo" || triedReturn.current) return;
    if (mpStatus === "failure" || mpStatus === "rejected" || mpStatus === "cancelled") {
      setError("O pagamento não foi concluído no Mercado Pago. Você pode tentar de novo.");
      return;
    }
    const approved = mpStatus === "success" || mpStatus === "approved";
    if (!approved && !paymentId) return;
    triedReturn.current = true;
    setBusy(true);
    platform
      .confirmPayment(id, paymentId || undefined)
      .then((next) => {
        setLead(next.lead);
        setResult(next);
        if (next.pending) setError("");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Não foi possível confirmar."))
      .finally(() => {
        setBusy(false);
      });
  }, [id, lead, mpStatus, paymentId]);

  useEffect(() => {
    if (!id || !lead || lead.status === "ativo") return;
    if (
      lead.status !== "aguardando_confirmacao" &&
      mpStatus !== "success" &&
      mpStatus !== "approved" &&
      mpStatus !== "pending"
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      platform.getLead(id).then((next) => {
        setLead(next);
        if (next.status === "ativo") window.clearInterval(timer);
      }).catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [id, lead, mpStatus]);

  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1600);
  }

  async function confirm() {
    if (!id) return;
    setBusy(true);
    setError("");
    try {
      const next = await platform.confirmPayment(id, paymentId || undefined);
      setLead(next.lead);
      setResult(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível confirmar.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !lead) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4">
        <p className="text-red">{error}</p>
      </div>
    );
  }
  if (!lead) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4">
        <p className="text-mute">Carregando pagamento…</p>
      </div>
    );
  }

  const pack = plans[lead.plan];
  const isTest = lead.amount === 2 || Boolean(lead.title?.toLowerCase().includes("teste"));
  const done = lead.status === "ativo";
  const waiting = lead.status === "aguardando_confirmacao" || mpStatus === "pending";
  const payLink = lead.mpInitPoint || lead.paymentUrl;

  return (
    <div className="min-h-screen bg-bg px-4 py-10">
      <div className="mx-auto max-w-xl rounded-3xl border border-line bg-paper p-8">
        <Logo full />
        <h1 className="mt-6 font-display text-3xl text-ink">{done ? "Assinatura confirmada" : isTest ? "Pagar teste" : "Pagar assinatura"}</h1>
        <p className="mt-2 text-sm text-mute">
          {isTest ? "Teste PODMEI" : pack.name} · {lead.nome} · {formatMoney(lead.amount)}
          {isTest ? "" : ` / ${lead.cycle === "year" ? "ano" : "mês"}`}
        </p>
        {waiting && !done ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl bg-bg p-4">
              <p className="font-semibold">{busy ? "Confirmando no Mercado Pago…" : "Pagamento em análise"}</p>
              <p className="mt-2 text-sm text-mute">
                Assim que o Mercado Pago confirmar, a senha provisória chega em {lead.email}. Esta página atualiza
                sozinha.
              </p>
            </div>
            {lead.mpInitPoint ? (
              <a className="btn-ghost inline-flex gap-2" href={lead.mpInitPoint} rel="noreferrer">
                <ExternalLink className="size-4" />
                Abrir Mercado Pago de novo
              </a>
            ) : null}
          </div>
        ) : !done ? (
          <>
            <div className="mt-6 rounded-2xl bg-bg p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-mute">
                {lead.mpInitPoint ? "Link Mercado Pago" : "Link de pagamento"}
              </p>
              <p className="mt-1 break-all text-sm">{payLink}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a className="btn-primary gap-2" href={payLink} rel="noreferrer">
                  <ExternalLink className="size-4" />
                  {lead.mpInitPoint ? "Pagar no Mercado Pago" : "Abrir pagamento"}
                </a>
                <button className="btn-ghost gap-2" type="button" onClick={() => copy("link", payLink)}>
                  <Copy className="size-4" />
                  {copied === "link" ? "Copiado" : "Copiar link"}
                </button>
              </div>
            </div>
            {lead.pixPayload && !lead.mpInitPoint ? (
              <div className="mt-4 rounded-2xl bg-bg p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-mute">Pix copia e cola</p>
                <p className="mt-1 break-all text-xs text-mute">{lead.pixPayload}</p>
                <button className="btn-ghost mt-3 gap-2" type="button" onClick={() => copy("pix", lead.pixPayload || "")}>
                  <Copy className="size-4" />
                  {copied === "pix" ? "Copiado" : "Copiar Pix"}
                </button>
              </div>
            ) : (
              <p className="mt-4 text-sm text-mute">
                {lead.mpInitPoint
                  ? `Pague ${formatMoney(lead.amount)} no Mercado Pago (Pix, cartão ou saldo). Depois da aprovação, o acesso e a senha provisória vão para ${lead.email}.`
                  : `Pague ${formatMoney(lead.amount)} e confirme abaixo. A senha provisória chega em ${lead.email}. Para gerar o link oficial, cole o Access Token do Mercado Pago em public/api/config.php.`}
              </p>
            )}
            {error ? <p className="mt-4 text-sm text-red">{error}</p> : null}
            <button className="btn-ghost mt-6 w-full" disabled={busy} onClick={() => void confirm()}>
              {busy ? "Confirmando…" : lead.mpInitPoint ? "Já paguei no Mercado Pago" : "Já paguei — confirmar assinatura"}
            </button>
          </>
        ) : (
          <div className="mt-6 rounded-2xl bg-bg p-4">
            <p className="flex items-center gap-2 font-semibold text-green">
              <Check className="size-4" /> Acesso liberado
            </p>
            <p className="mt-2 text-sm text-mute">
              Enviamos o login e a senha para <strong>{lead.email}</strong>
              {result?.emailSent === false ? " (o e-mail do servidor não saiu; use os dados abaixo)." : "."}
            </p>
            {result?.username && result.tempPassword ? (
              <div className="mt-4 text-sm">
                <p>
                  Usuário: <strong>{result.username}</strong>
                </p>
                <p>
                  Senha: <strong>{result.tempPassword}</strong>
                </p>
              </div>
            ) : null}
            <Link to="/entrar" className="btn-primary mt-5 inline-flex">
              Entrar agora
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
