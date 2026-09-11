import { useMemo, useState, type ReactNode } from "react";
import { QuickContactModal } from "@/components/entries/QuickContactModal";
import { QuickProductModal } from "@/components/entries/QuickProductModal";
import { calcEntryTotal } from "@/lib/entryPricing";
import type {
  Contact,
  DiscountKind,
  Entry,
  EntryKind,
  PaymentMethod,
  PaymentStatus,
  Product,
  ProductKind,
  RevenueKind,
} from "@/lib/types";
import { matchContact, parseLancamento, type ParsedDraft } from "@/lib/parser";
import { useStore } from "@/lib/store";
import { formatMoney, todayIso } from "@/lib/utils";

const emptyDraft = (): ParsedDraft => ({
  kind: "venda",
  revenueKind: "servico",
  valor: 0,
  contraparte: "",
  descricao: "",
  documentoFiscal: false,
  formaPagamento: "pix",
  status: "liquidado",
  documento: "RECIBO",
  data: todayIso(),
  quantidade: 1,
  precoUnitario: 0,
  descontoTipo: "reais",
  descontoValor: 0,
  pagamentoModo: "avista",
  numParcelas: 2,
  valorEntrada: 0,
  confidence: "",
});

function isPending(status: PaymentStatus) {
  return status === "a_receber" || status === "a_pagar";
}

function pendingStatusFor(kind: EntryKind): PaymentStatus {
  return kind === "venda" ? "a_receber" : "a_pagar";
}

export function EntryForm({
  initial,
  onSave,
  onCancel,
  autoFocusValor = false,
  allowParcelado = true,
}: {
  initial?: Partial<ParsedDraft>;
  onSave: (draft: ParsedDraft) => void;
  onCancel?: () => void;
  autoFocusValor?: boolean;
  /** Em edição, parcelado não gera novos lançamentos. */
  allowParcelado?: boolean;
}) {
  const { contacts, products } = useStore();
  const [draft, setDraft] = useState<ParsedDraft>(() => {
    const base = { ...emptyDraft(), ...initial };
    const unit = base.precoUnitario ?? base.valor ?? 0;
    const qty = base.quantidade && base.quantidade > 0 ? base.quantidade : 1;
    return {
      ...base,
      quantidade: qty,
      precoUnitario: unit,
      descontoTipo: base.descontoTipo ?? "reais",
      descontoValor: base.descontoValor ?? 0,
      pagamentoModo: allowParcelado ? base.pagamentoModo || "avista" : "avista",
      numParcelas: base.numParcelas && base.numParcelas > 0 ? base.numParcelas : 2,
      valorEntrada: base.valorEntrada ?? 0,
    };
  });
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const parcelado = allowParcelado && draft.pagamentoModo === "parcelado";
  const pending = isPending(draft.status) || parcelado;
  const totals = useMemo(
    () =>
      calcEntryTotal({
        quantidade: draft.quantidade,
        precoUnitario: draft.precoUnitario,
        descontoTipo: draft.descontoTipo,
        descontoValor: draft.descontoValor,
        valor: draft.valor,
      }),
    [draft.quantidade, draft.precoUnitario, draft.descontoTipo, draft.descontoValor, draft.valor],
  );
  const entrada = Math.max(0, draft.valorEntrada || 0);
  const numParcelas = Math.max(1, Math.floor(draft.numParcelas || 1));
  const saldoParcelas = Math.round((totals.liquido - entrada) * 100) / 100;
  const parcelaValor = parcelado && numParcelas > 0 && saldoParcelas > 0 ? saldoParcelas / numParcelas : 0;
  const parceladoOk =
    !parcelado ||
    (numParcelas >= 1 &&
      entrada < totals.liquido &&
      saldoParcelas > 0 &&
      Boolean(draft.vencimento || draft.data));
  const suggestions = useMemo(() => {
    const prefer = draft.kind === "venda" ? "cliente" : "fornecedor";
    return [...contacts].sort((a, b) => {
      if (a.kind === prefer && b.kind !== prefer) return -1;
      if (b.kind === prefer && a.kind !== prefer) return 1;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
  }, [contacts, draft.kind]);
  const catalog = useMemo(
    () => [...products].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [products],
  );
  const linked = draft.contactId
    ? contacts.find((c) => c.id === draft.contactId)
    : matchContact(draft.contraparte, contacts);
  const valid =
    totals.liquido > 0 &&
    draft.contraparte.trim().length > 1 &&
    (!pending || Boolean(draft.vencimento)) &&
    parceladoOk;

  function setContraparte(nome: string) {
    const hit = matchContact(nome, contacts);
    setDraft({ ...draft, contraparte: nome, contactId: hit?.id });
  }

  function setStatus(status: PaymentStatus) {
    if (parcelado && status === "liquidado") return;
    setDraft({
      ...draft,
      status,
      vencimento: isPending(status) ? draft.vencimento || draft.data : draft.vencimento,
    });
  }

  function setPagamentoModo(modo: "avista" | "parcelado") {
    if (modo === "parcelado") {
      const status = pendingStatusFor(draft.kind);
      setDraft({
        ...draft,
        pagamentoModo: "parcelado",
        status,
        vencimento: draft.vencimento || draft.data,
        numParcelas: draft.numParcelas && draft.numParcelas > 0 ? draft.numParcelas : 2,
        valorEntrada: draft.valorEntrada ?? 0,
      });
      return;
    }
    setDraft({
      ...draft,
      pagamentoModo: "avista",
    });
  }

  function applyProduct(p: Product, keepQty = true) {
    setDraft((prev) => ({
      ...prev,
      productId: p.id,
      descricao: p.nome,
      precoUnitario: p.preco,
      valor: p.preco,
      quantidade: keepQty && prev.quantidade && prev.quantidade > 0 ? prev.quantidade : 1,
      revenueKind:
        prev.kind === "venda"
          ? p.kind === "servico"
            ? "servico"
            : prev.revenueKind === "servico"
              ? "comercio"
              : prev.revenueKind
          : prev.revenueKind,
    }));
  }

  function pickProduct(productId: string) {
    if (!productId) {
      setDraft({ ...draft, productId: undefined });
      return;
    }
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    applyProduct(p);
  }

  function applyContact(contact: Contact) {
    setDraft((prev) => ({
      ...prev,
      contraparte: contact.nome,
      contactId: contact.id,
    }));
  }

  function resetForm() {
    setDraft(emptyDraft());
  }

  const descontoTipo = draft.descontoTipo || "reais";
  const defaultContactKind = draft.kind === "venda" ? "cliente" : "fornecedor";
  const defaultProductKind: ProductKind =
    draft.kind === "venda" && draft.revenueKind === "servico" ? "servico" : "produto";

  return (
    <>
    <form
      className="grid gap-3 sm:grid-cols-2 md:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        const status = parcelado ? pendingStatusFor(draft.kind) : draft.status;
        onSave({
          ...draft,
          status,
          valor: totals.liquido,
          precoUnitario: draft.precoUnitario ?? totals.bruto,
          quantidade: draft.quantidade && draft.quantidade > 0 ? draft.quantidade : 1,
          contactId: linked?.id,
          pagamentoModo: parcelado ? "parcelado" : "avista",
          numParcelas: parcelado ? numParcelas : undefined,
          valorEntrada: parcelado ? entrada : undefined,
          vencimento: parcelado || isPending(status) ? draft.vencimento || draft.data : undefined,
        });
        resetForm();
      }}
    >
      <Field label="Data da operação">
        <input
          type="date"
          value={draft.data}
          onChange={(e) =>
            setDraft({
              ...draft,
              data: e.target.value,
              vencimento: pending && !draft.vencimento ? e.target.value : draft.vencimento,
            })
          }
          className="input"
        />
      </Field>
      <Field label="Tipo">
        <select
          value={draft.kind}
          onChange={(e) => {
            const kind = e.target.value as EntryKind;
            setDraft({
              ...draft,
              kind,
              status: parcelado ? pendingStatusFor(kind) : draft.status,
            });
          }}
          className="input"
        >
          <option value="venda">Venda / receita</option>
          <option value="compra">Compra</option>
          <option value="despesa">Despesa</option>
        </select>
      </Field>
      {draft.kind === "venda" ? (
        <Field label="Atividade" className="sm:col-span-2 md:col-span-1">
          <select
            value={draft.revenueKind}
            onChange={(e) => setDraft({ ...draft, revenueKind: e.target.value as RevenueKind })}
            className="input"
          >
            <option value="servico">Serviço</option>
            <option value="comercio">Comércio</option>
            <option value="industria">Indústria</option>
            <option value="transporte_carga">Transporte de cargas</option>
            <option value="transporte_passageiros">Transporte de passageiros</option>
          </select>
        </Field>
      ) : null}
      <Field
        label="Cliente / fornecedor"
        className="sm:col-span-2 md:col-span-1"
        hint={
          <button
            type="button"
            className="font-semibold text-navy hover:underline"
            onClick={() => setContactModalOpen(true)}
          >
            Cadastrar
          </button>
        }
      >
        <input
          list="cadastros-contraparte"
          value={draft.contraparte}
          onChange={(e) => setContraparte(e.target.value)}
          className="input"
          placeholder="Digite ou escolha um cadastro"
          autoComplete="off"
        />
        <datalist id="cadastros-contraparte">
          {suggestions.map((c) => (
            <option
              key={c.id}
              value={c.nome}
              label={`${c.kind === "cliente" ? "Cliente" : "Fornecedor"} · ${c.documento || c.cidade || c.nome}`}
            />
          ))}
        </datalist>
        {linked ? (
          <p className="mt-1 text-[11px] text-mute">
            Cadastro: {linked.kind === "cliente" ? "cliente" : "fornecedor"}
            {linked.documento ? ` · ${linked.documento}` : ""}
            {linked.telefone ? ` · ${linked.telefone}` : ""}
          </p>
        ) : null}
      </Field>
      <Field
        label="Produto / serviço"
        className="sm:col-span-2 md:col-span-1"
        hint={
          <button
            type="button"
            className="font-semibold text-navy hover:underline"
            onClick={() => setProductModalOpen(true)}
          >
            Cadastrar
          </button>
        }
      >
        <select
          className="input"
          value={draft.productId || ""}
          onChange={(e) => pickProduct(e.target.value)}
        >
          <option value="">Avulso / digitar descrição</option>
          {catalog.map((p) => (
            <option key={p.id} value={p.id}>
              {p.kind === "servico" ? "Serviço" : "Produto"} · {p.nome} ({formatMoney(p.preco)})
            </option>
          ))}
        </select>
      </Field>
      <Field label="Descrição" className="sm:col-span-2 md:col-span-1">
        <input
          value={draft.descricao}
          onChange={(e) => setDraft({ ...draft, descricao: e.target.value })}
          className="input"
          placeholder="Nome do item no lançamento"
        />
      </Field>
      <Field label="Quantidade">
        <input
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          value={draft.quantidade || ""}
          onChange={(e) => setDraft({ ...draft, quantidade: Number(e.target.value) })}
          className="input"
        />
      </Field>
      <Field label="Valor unitário">
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          autoFocus={autoFocusValor && !(draft.precoUnitario || draft.valor)}
          value={draft.precoUnitario || ""}
          onChange={(e) => {
            const precoUnitario = Number(e.target.value);
            setDraft({ ...draft, precoUnitario, valor: precoUnitario });
          }}
          className="input"
        />
      </Field>
      <Field label="Desconto" className="sm:col-span-2 md:col-span-1">
        <div className="flex items-center gap-2">
          <div className="flex shrink-0 rounded-full border border-line bg-bg p-0.5" role="group" aria-label="Tipo de desconto">
            <button
              type="button"
              className={descontoTipo === "reais" ? "btn-primary !px-3 !py-2 text-xs" : "btn-ghost !px-3 !py-2 text-xs border-0"}
              aria-pressed={descontoTipo === "reais"}
              onClick={() => setDraft({ ...draft, descontoTipo: "reais" as DiscountKind })}
            >
              R$
            </button>
            <button
              type="button"
              className={descontoTipo === "percent" ? "btn-primary !px-3 !py-2 text-xs" : "btn-ghost !px-3 !py-2 text-xs border-0"}
              aria-pressed={descontoTipo === "percent"}
              onClick={() => setDraft({ ...draft, descontoTipo: "percent" as DiscountKind })}
            >
              %
            </button>
          </div>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            className="input min-w-0 flex-1"
            value={draft.descontoValor || ""}
            onChange={(e) => setDraft({ ...draft, descontoValor: Number(e.target.value) })}
            placeholder={descontoTipo === "percent" ? "0 %" : "0,00"}
            aria-label={descontoTipo === "percent" ? "Desconto em percentual" : "Desconto em reais"}
          />
        </div>
      </Field>
      <Field label="Documento">
        <input
          value={draft.documento}
          onChange={(e) => setDraft({ ...draft, documento: e.target.value })}
          className="input"
        />
      </Field>

      {allowParcelado ? (
        <Field label="Condição" className="sm:col-span-2 md:col-span-1">
          <div className="flex rounded-full border border-line bg-bg p-0.5" role="group" aria-label="Condição de pagamento">
            <button
              type="button"
              className={!parcelado ? "btn-primary flex-1 !px-3 !py-2 text-xs" : "btn-ghost flex-1 !px-3 !py-2 text-xs border-0"}
              aria-pressed={!parcelado}
              onClick={() => setPagamentoModo("avista")}
            >
              À vista
            </button>
            <button
              type="button"
              className={parcelado ? "btn-primary flex-1 !px-3 !py-2 text-xs" : "btn-ghost flex-1 !px-3 !py-2 text-xs border-0"}
              aria-pressed={parcelado}
              onClick={() => setPagamentoModo("parcelado")}
            >
              Parcelado
            </button>
          </div>
        </Field>
      ) : null}

      <Field label="Status">
        <select
          value={draft.status}
          onChange={(e) => setStatus(e.target.value as PaymentStatus)}
          className="input"
          disabled={parcelado}
        >
          <option value="liquidado">Liquidado</option>
          <option value="a_receber">A receber</option>
          <option value="a_pagar">A pagar</option>
        </select>
      </Field>
      {pending ? (
        <Field label={draft.status === "a_receber" ? "Data a receber" : "Data a pagar"}>
          <input
            type="date"
            value={draft.vencimento || ""}
            onChange={(e) => setDraft({ ...draft, vencimento: e.target.value })}
            className="input"
            required
          />
        </Field>
      ) : (
        <Field label="Pagamento">
          <select
            value={draft.formaPagamento}
            onChange={(e) => setDraft({ ...draft, formaPagamento: e.target.value as PaymentMethod })}
            className="input"
          >
            <option value="pix">PIX</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="debito">Débito</option>
            <option value="credito">Crédito</option>
            <option value="boleto">Boleto</option>
            <option value="transferencia">Transferência</option>
          </select>
        </Field>
      )}
      {pending ? (
        <Field label="Forma prevista">
          <select
            value={draft.formaPagamento}
            onChange={(e) => setDraft({ ...draft, formaPagamento: e.target.value as PaymentMethod })}
            className="input"
          >
            <option value="pix">PIX</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="debito">Débito</option>
            <option value="credito">Crédito</option>
            <option value="boleto">Boleto</option>
            <option value="transferencia">Transferência</option>
          </select>
        </Field>
      ) : null}

      {parcelado ? (
        <>
          <Field label="Qtd. de parcelas">
            <input
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              className="input"
              value={draft.numParcelas || ""}
              onChange={(e) => setDraft({ ...draft, numParcelas: Math.max(1, Math.floor(Number(e.target.value) || 0)) })}
              required
            />
          </Field>
          <Field label="Valor de entrada">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              className="input"
              value={draft.valorEntrada || ""}
              onChange={(e) => setDraft({ ...draft, valorEntrada: Number(e.target.value) })}
              placeholder="0,00"
            />
          </Field>
          <div className="rounded-2xl border border-line bg-bg px-3 py-3 text-sm sm:col-span-2 md:col-span-1">
            <p className="text-mute">
              Saldo {formatMoney(Math.max(0, saldoParcelas))}
              {saldoParcelas > 0 && numParcelas > 0
                ? ` · ${numParcelas}x de ~${formatMoney(parcelaValor)}`
                : ""}
            </p>
            <p className="mt-1 text-[11px] text-mute">
              1ª parcela na data a {draft.status === "a_pagar" ? "pagar" : "receber"}; demais a cada 30 dias.
              {entrada > 0 ? ` Entrada ${formatMoney(entrada)} liquidada na data da operação.` : ""}
            </p>
          </div>
        </>
      ) : null}

      <div className="rounded-2xl border border-line bg-bg px-3 py-3 text-sm sm:col-span-2 md:col-span-3">
        <p className="text-mute">
          Bruto {formatMoney(totals.bruto)}
          {totals.desconto > 0 ? ` − desconto ${formatMoney(totals.desconto)}` : ""}
          {" = "}
          <strong className="text-ink">líquido {formatMoney(totals.liquido)}</strong>
        </p>
      </div>

      <label className="flex min-h-11 items-center gap-3 text-sm sm:col-span-2 md:col-span-3">
        <input
          type="checkbox"
          className="size-4 accent-navy"
          checked={draft.documentoFiscal}
          onChange={(e) => setDraft({ ...draft, documentoFiscal: e.target.checked })}
        />
        Teve nota fiscal (NF-e / NFS-e)
      </label>
      {!valid ? (
        <p className="text-xs text-orange sm:col-span-2 md:col-span-3">
          {parcelado
            ? "Informe valor, cliente, data a receber/pagar, parcelas e entrada menor que o líquido."
            : pending
              ? "Informe valor, cliente/fornecedor e a data a receber ou a pagar."
              : "Informe o valor e o cliente/fornecedor para salvar."}
        </p>
      ) : null}
      <div className="sticky bottom-20 z-[5] -mx-1 flex gap-2 bg-paper/95 p-1 backdrop-blur sm:static sm:bottom-auto sm:mx-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none sm:col-span-2 md:col-span-3 md:bottom-auto">
        <button type="submit" disabled={!valid} className="btn-primary min-h-11 flex-1 disabled:opacity-50 sm:flex-none">
          Salvar lançamento
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="btn-ghost min-h-11">
            Cancelar
          </button>
        ) : null}
      </div>
    </form>
    <QuickContactModal
      open={contactModalOpen}
      defaultKind={defaultContactKind}
      defaultNome={draft.contraparte}
      onClose={() => setContactModalOpen(false)}
      onCreated={applyContact}
    />
    <QuickProductModal
      open={productModalOpen}
      defaultKind={defaultProductKind}
      defaultNome={draft.descricao}
      onClose={() => setProductModalOpen(false)}
      onCreated={(product) => applyProduct(product)}
    />
    </>
  );
}

function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`block text-xs font-medium text-mute ${className}`.trim()}>
      <span className="flex items-center justify-between gap-2">
        {label}
        {hint}
      </span>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export function SmartCapture({
  onDraft,
}: {
  onDraft: (draft: ParsedDraft, source: Entry["source"]) => void;
}) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState("");
  const hint = useMemo(() => parseLancamento(text), [text]);

  function applyText() {
    const parsed = parseLancamento(text);
    if (parsed) {
      setNotice("");
      onDraft(parsed, "texto");
      return;
    }
    setNotice("Não achei valor no texto. Ex.: Recebi R$ 850 de serviço da Maria no PIX.");
  }

  function startAudio() {
    const Speech = window as Window & {
      SpeechRecognition?: new () => {
        lang: string;
        start: () => void;
        onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onend: (() => void) | null;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        start: () => void;
        onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onend: (() => void) | null;
      };
    };
    const SR = Speech.SpeechRecognition || Speech.webkitSpeechRecognition;
    if (!SR) {
      setText("Seu navegador não reconhece áudio. Digite: Recebi R$ 500 de serviço no PIX.");
      return;
    }
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.onresult = (ev) => {
      const said = ev.results[0]?.[0]?.transcript ?? "";
      setText(said);
      const parsed = parseLancamento(said);
      if (parsed) onDraft(parsed, "audio");
    };
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }

  return (
    <div className="rounded-2xl border border-line bg-paper p-4">
      <p className="text-sm font-semibold">Lançar por texto ou áudio</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Ex.: Recebi R$ 850 de serviço da Maria no PIX."
        className="input mt-3 min-h-24"
      />
      {hint ? (
        <p className="mt-2 text-xs text-green">
          Detectado: {hint.kind} de {hint.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} ·{" "}
          {hint.contraparte}
          {hint.status !== "liquidado" && hint.vencimento ? ` · vence ${hint.vencimento}` : ""}
        </p>
      ) : null}
      {notice ? <p className="mt-2 text-xs text-orange">{notice}</p> : null}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <button type="button" className="btn-primary min-h-11" onClick={applyText}>
          Interpretar texto
        </button>
        <button type="button" className="btn-ghost min-h-11" onClick={startAudio}>
          {listening ? "Ouvindo…" : "Falar (áudio)"}
        </button>
      </div>
    </div>
  );
}
