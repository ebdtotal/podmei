import { useMemo, useState } from "react";
import { History, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { MoneyBrInput } from "@/components/ui/MoneyBrInput";
import { useStore } from "@/lib/store";
import { stockLevel, stockMoveLabel } from "@/lib/stock";
import type { Product, ProductKind } from "@/lib/types";
import { cn, formatDate, formatMoney, todayIso } from "@/lib/utils";

const emptyForm = (kind: ProductKind) => ({
  kind,
  nome: "",
  preco: 0,
  unidade: "un",
  observacao: "",
  createdAt: todayIso(),
  estoqueAtual: kind === "produto" ? 0 : undefined,
  estoqueMinimo: kind === "produto" ? 0 : undefined,
  custoInicial: kind === "produto" ? 0 : undefined as number | undefined,
});

function stockBadge(product: Product) {
  const level = stockLevel(product);
  if (!level) return null;
  const atual = Number(product.estoqueAtual) || 0;
  const u = product.unidade || "un";
  if (level === "negativo") {
    return <span className="rounded-full bg-red/15 px-2 py-0.5 text-xs font-semibold text-red">{atual} {u} · negativo</span>;
  }
  if (level === "zerado") {
    return <span className="rounded-full bg-orange/15 px-2 py-0.5 text-xs font-semibold text-orange">Zerado</span>;
  }
  if (level === "baixo") {
    return <span className="rounded-full bg-gold/40 px-2 py-0.5 text-xs font-semibold text-ink">{atual} {u} · baixo</span>;
  }
  return <span className="text-xs font-medium text-mute">{atual} {u}</span>;
}

export function ProdutosPage() {
  const { products, stockMovements, addProduct, updateProduct, removeProduct } = useStore();
  const [kind, setKind] = useState<ProductKind>("produto");
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [historyProductId, setHistoryProductId] = useState<string | "all">("all");
  const [form, setForm] = useState(emptyForm("produto"));
  const [notice, setNotice] = useState("");

  const list = useMemo(() => {
    const t = q.toLowerCase();
    return products
      .filter((p) => p.kind === kind)
      .filter((p) => !t || p.nome.toLowerCase().includes(t) || p.observacao.toLowerCase().includes(t))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [products, kind, q]);

  const nProdutos = products.filter((p) => p.kind === "produto").length;
  const nServicos = products.filter((p) => p.kind === "servico").length;
  const nBaixo = products.filter((p) => {
    const l = stockLevel(p);
    return l === "baixo" || l === "zerado" || l === "negativo";
  }).length;

  const moves = useMemo(() => {
    const filtered = stockMovements.filter((m) =>
      historyProductId === "all" ? true : m.productId === historyProductId,
    );
    return [...filtered].sort(
      (a, b) => b.data.localeCompare(a.data) || b.createdAt.localeCompare(a.createdAt),
    );
  }, [stockMovements, historyProductId]);

  const productName = (id: string) => products.find((p) => p.id === id)?.nome || "—";

  function reset(nextKind = kind) {
    setEditingId(null);
    setForm(emptyForm(nextKind));
  }

  function startEdit(product: Product) {
    setKind(product.kind);
    setEditingId(product.id);
    setHistoryProductId(product.id);
    setForm({
      kind: product.kind,
      nome: product.nome,
      preco: product.preco,
      unidade: product.unidade || "un",
      observacao: product.observacao,
      createdAt: product.createdAt,
      estoqueAtual: product.kind === "produto" ? Number(product.estoqueAtual) || 0 : undefined,
      estoqueMinimo: product.kind === "produto" ? Number(product.estoqueMinimo) || 0 : undefined,
      custoInicial: product.kind === "produto" ? Number(product.custoMedio) || 0 : undefined,
    });
  }

  function save() {
    const nome = form.nome.trim();
    if (nome.length < 2) {
      setNotice("Informe o nome do produto ou serviço.");
      return;
    }
    if (form.preco < 0) {
      setNotice("O preço não pode ser negativo.");
      return;
    }
    const payload = {
      nome,
      kind,
      preco: form.preco,
      unidade: form.unidade,
      observacao: form.observacao,
      createdAt: form.createdAt,
      estoqueAtual: kind === "produto" ? Number(form.estoqueAtual) || 0 : undefined,
      estoqueMinimo: kind === "produto" ? Number(form.estoqueMinimo) || 0 : undefined,
      custoInicial: kind === "produto" ? Number(form.custoInicial) || 0 : undefined,
    };
    if (editingId) {
      updateProduct(editingId, payload);
      setNotice("Cadastro atualizado. Alterações de estoque entram no histórico como ajuste.");
    } else {
      addProduct(payload);
      setNotice(`${kind === "produto" ? "Produto" : "Serviço"} cadastrado.`);
    }
    reset(kind);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Produtos e serviços</h1>
          <p className="mt-1 text-sm text-mute">
            Estoque sobe na compra e desce na venda. Custo médio nas compras; margem na venda.{" "}
            <Link to="/app/estoque" className="font-semibold text-navy hover:underline">
              Relatório de estoque
            </Link>
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-paper p-4">
          <p className="text-xs uppercase tracking-wide text-mute">Produtos</p>
          <p className="mt-1 font-display text-3xl">{nProdutos}</p>
        </div>
        <div className="rounded-2xl border border-line bg-paper p-4">
          <p className="text-xs uppercase tracking-wide text-mute">Serviços</p>
          <p className="mt-1 font-display text-3xl">{nServicos}</p>
        </div>
        <div className="rounded-2xl border border-line bg-paper p-4">
          <p className="text-xs uppercase tracking-wide text-mute">Estoque em alerta</p>
          <p className={cn("mt-1 font-display text-3xl", nBaixo ? "text-orange" : "")}>{nBaixo}</p>
        </div>
      </div>

      {notice ? <p className="rounded-xl border border-gold bg-paper px-4 py-3 text-sm">{notice}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={cn("rounded-full px-4 py-1.5 text-sm font-semibold", kind === "produto" ? "bg-navy text-white" : "btn-ghost")}
          onClick={() => {
            setKind("produto");
            if (!editingId) setForm(emptyForm("produto"));
          }}
        >
          Produtos
        </button>
        <button
          type="button"
          className={cn("rounded-full px-4 py-1.5 text-sm font-semibold", kind === "servico" ? "bg-navy text-white" : "btn-ghost")}
          onClick={() => {
            setKind("servico");
            if (!editingId) setForm(emptyForm("servico"));
          }}
        >
          Serviços
        </button>
      </div>

      <section className="rounded-2xl border border-line bg-paper p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {editingId ? <Pencil className="size-4" /> : <Plus className="size-4" />}
          {editingId ? "Editar cadastro" : `Novo ${kind === "produto" ? "produto" : "serviço"}`}
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="block text-xs font-medium text-mute">
            Nome
            <input
              className="input mt-1"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder={kind === "produto" ? "Ex.: Camiseta básica" : "Ex.: Consultoria 1h"}
            />
          </label>
          <label className="block text-xs font-medium text-mute">
            Preço de venda
            <MoneyBrInput
              className="input mt-1"
              value={form.preco || 0}
              onChange={(preco) => setForm({ ...form, preco })}
              min={0}
            />
          </label>
          <label className="block text-xs font-medium text-mute">
            Unidade
            <input
              className="input mt-1"
              value={form.unidade}
              onChange={(e) => setForm({ ...form, unidade: e.target.value })}
              placeholder="un, hr, kg…"
            />
          </label>
          {kind === "produto" ? (
            <>
              <label className="block text-xs font-medium text-mute">
                Estoque atual
                <input
                  className="input mt-1"
                  type="number"
                  step="0.001"
                  value={form.estoqueAtual ?? 0}
                  onChange={(e) => setForm({ ...form, estoqueAtual: Number(e.target.value) })}
                />
              </label>
              <label className="block text-xs font-medium text-mute">
                Estoque mínimo (alerta)
                <input
                  className="input mt-1"
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.estoqueMinimo ?? 0}
                  onChange={(e) => setForm({ ...form, estoqueMinimo: Number(e.target.value) })}
                />
              </label>
              <label className="block text-xs font-medium text-mute">
                Custo médio / custo da entrada
                <MoneyBrInput
                  className="input mt-1"
                  value={form.custoInicial ?? 0}
                  onChange={(custoInicial) => setForm({ ...form, custoInicial })}
                  min={0}
                />
                <span className="mt-1 block text-[11px] font-normal text-mute">
                  Nas compras o custo médio é recalculado. Aqui serve para estoque inicial ou ajuste.
                </span>
              </label>
            </>
          ) : null}
          <label className="block text-xs font-medium text-mute md:col-span-2">
            Observação
            <input
              className="input mt-1"
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={save}>
            {editingId ? "Salvar alterações" : "Cadastrar"}
          </button>
          {editingId ? (
            <button type="button" className="btn-ghost" onClick={() => reset(kind)}>
              Cancelar
            </button>
          ) : null}
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Package className="size-4" />
          Lista
        </h2>
        <input
          className="input max-w-xs"
          placeholder="Buscar…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-navy text-white">
            <tr className="text-left text-xs">
              <th className="px-3 py-3">Nome</th>
              <th>Preço</th>
              {kind === "produto" ? <th>Custo médio</th> : null}
              {kind === "produto" ? <th>Margem</th> : null}
              <th>Unidade</th>
              {kind === "produto" ? <th>Estoque</th> : null}
              <th>Observação</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={kind === "produto" ? 8 : 5} className="px-3 py-6 text-center text-mute">
                  Nenhum {kind === "produto" ? "produto" : "serviço"} cadastrado.
                </td>
              </tr>
            ) : (
              list.map((p, i) => {
                const custo = Number(p.custoMedio) || 0;
                const margem = custo > 0 ? p.preco - custo : null;
                return (
                  <tr key={p.id} className={cn(i % 2 ? "bg-bg/70" : "bg-paper")}>
                    <td className="px-3 py-2 font-medium">{p.nome}</td>
                    <td>{formatMoney(p.preco)}</td>
                    {kind === "produto" ? (
                      <td className="text-mute">{custo > 0 ? formatMoney(custo) : "—"}</td>
                    ) : null}
                    {kind === "produto" ? (
                      <td className={cn(margem != null && margem < 0 && "text-red")}>
                        {margem != null ? formatMoney(margem) : "—"}
                      </td>
                    ) : null}
                    <td>{p.unidade || "un"}</td>
                    {kind === "produto" ? <td className="py-2">{stockBadge(p)}</td> : null}
                    <td className="text-mute">{p.observacao || "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="text-xs font-semibold text-mute"
                          onClick={() => setHistoryProductId(p.id)}
                          title="Ver histórico"
                        >
                          <History className="inline size-3.5" />
                        </button>
                        <button type="button" className="text-xs font-semibold text-navy" onClick={() => startEdit(p)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="text-xs text-red"
                          onClick={() => {
                            if (confirm(`Excluir “${p.nome}”?`)) removeProduct(p.id);
                          }}
                        >
                          <Trash2 className="inline size-3.5" /> Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {kind === "produto" ? (
        <section className="rounded-2xl border border-line bg-paper p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <History className="size-4" />
              Histórico de movimentos
            </h2>
            <select
              className="input w-auto max-w-xs"
              value={historyProductId}
              onChange={(e) => setHistoryProductId(e.target.value as string | "all")}
            >
              <option value="all">Todos os produtos</option>
              {products
                .filter((p) => p.kind === "produto")
                .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
            </select>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-mute">
                  <th className="py-2 pr-3">Data</th>
                  <th className="pr-3">Tipo</th>
                  <th className="pr-3">Produto</th>
                  <th className="pr-3">Qtd</th>
                  <th className="pr-3">Custo / preço</th>
                  <th className="pr-3">Margem</th>
                  <th className="pr-3">Saldo</th>
                  <th>Obs.</th>
                </tr>
              </thead>
              <tbody>
                {moves.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-mute">
                      Nenhum movimento ainda. Compras, vendas e ajustes aparecem aqui.
                    </td>
                  </tr>
                ) : (
                  moves.slice(0, 40).map((m) => (
                    <tr key={m.id} className="border-b border-line/60">
                      <td className="py-2 pr-3 whitespace-nowrap">{formatDate(m.data)}</td>
                      <td className="pr-3 font-medium">{stockMoveLabel(m.kind, m.sign)}</td>
                      <td className="pr-3">{productName(m.productId)}</td>
                      <td className="pr-3">
                        {(m.sign ?? (m.kind === "saida" ? -1 : 1)) < 0 ? "−" : "+"}
                        {m.qty}
                      </td>
                      <td className="pr-3 text-mute">
                        {m.kind === "saida"
                          ? m.unitPrice != null
                            ? formatMoney(m.unitPrice)
                            : "—"
                          : m.unitCost != null
                            ? formatMoney(m.unitCost)
                            : "—"}
                      </td>
                      <td className={cn("pr-3", m.marginTotal != null && m.marginTotal < 0 && "text-red")}>
                        {m.marginTotal != null ? formatMoney(m.marginTotal) : "—"}
                      </td>
                      <td className="pr-3">{m.saldoApos != null ? m.saldoApos : "—"}</td>
                      <td className="text-mute">{m.observacao || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
