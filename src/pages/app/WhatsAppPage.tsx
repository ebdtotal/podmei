import { useState } from "react";
import { draftToEntry, parseLancamento } from "@/lib/parser";
import { useStore } from "@/lib/store";
import { todayIso, uid } from "@/lib/utils";

export function WhatsAppPage() {
  const { whatsapp, addWhatsapp, addEntry, whatsappPhone, setWhatsappPhone, company } = useStore();
  const [text, setText] = useState("");

  function send(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    addWhatsapp({ id: uid("wa"), from: "mei", text: trimmed, at: new Date().toISOString() });
    const parsed = parseLancamento(trimmed);
    if (!parsed) {
      addWhatsapp({
        id: uid("wa"),
        from: "bot",
        at: new Date().toISOString(),
        text: "Não identifiquei o valor. Exemplo: Recebi R$ 850 de serviço da Maria no PIX, sem nota.",
      });
      return;
    }
    parsed.data = todayIso();
    const entry = draftToEntry(parsed, "whatsapp");
    addEntry(entry);
    addWhatsapp({
      id: uid("wa"),
      from: "bot",
      at: new Date().toISOString(),
      text: `Lançamento criado: ${entry.kind} de ${entry.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (${entry.contraparte}). Confira em Lançamentos.`,
    });
    setText("");
  }

  const waLink = `https://wa.me/${whatsappPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
    `Olá, ${company.nome}. Quero lançar uma venda no POD MEI.`,
  )}`;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <section className="flex h-[70vh] flex-col rounded-2xl border border-line bg-paper">
        <div className="rounded-t-2xl bg-[#075e54] px-4 py-3 text-white">
          <p className="text-sm font-semibold">WhatsApp · POD MEI</p>
          <p className="text-xs opacity-80">Envie texto como faria no celular. Áudio entra em Lançamentos.</p>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto bg-[#ece5dd] p-4">
          {whatsapp.map((m) => (
            <div
              key={m.id}
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                m.from === "mei" ? "ml-auto bg-[#dcf8c6]" : "bg-white"
              }`}
            >
              {m.text}
            </div>
          ))}
        </div>
        <form
          className="flex gap-2 border-t border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
        >
          <input
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Recebi R$ 500 de serviço no PIX…"
          />
          <button className="btn-primary" type="submit">
            Enviar
          </button>
        </form>
      </section>
      <aside className="space-y-4">
        <div className="rounded-2xl border border-line bg-paper p-4">
          <h2 className="text-sm font-semibold">Número conectado</h2>
          <input
            className="input mt-2"
            value={whatsappPhone}
            onChange={(e) => setWhatsappPhone(e.target.value)}
          />
          <a className="btn-primary mt-3 inline-flex w-full" href={waLink} target="_blank" rel="noreferrer">
            Abrir conversa no WhatsApp
          </a>
          <p className="mt-3 text-xs text-mute">
            No plano Completo, o mesmo interpretador recebe mensagens da API Cloud (Meta). Configure o webhook
            apontando para o backend com o token do app, sem gravar senha na planilha.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-paper p-4 text-sm text-mute">
          <p className="font-semibold text-ink">Formatos aceitos</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>Texto: “Paguei R$ 150 de contabilidade no PIX”</li>
            <li>Áudio: use o botão em Lançamentos (Chrome/Edge)</li>
            <li>Nota no texto: “Venda com NF-e de R$ 1.200 de comércio”</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
