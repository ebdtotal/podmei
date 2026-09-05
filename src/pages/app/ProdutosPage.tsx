import { useMemo, useState } from "react";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Product, ProductKind } from "@/lib/types";
import { cn, formatMoney, todayIso } from "@/lib/utils";

const emptyForm = (kind: ProductKind): Omit<Product, "id"> => ({
  kind,
  nome: "",
  preco: 0,
  unidade: kind === "servico" ? "un" : "un",
  observacao: "",
  createdAt: todayIso(),
});

export function ProdutosPage() {
  const { products, addProduct, updateProduct, removeProduct } = useStore();
  const [kind, setKind] = useState<ProductKind>("produto");
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
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

  function reset(nextKind = kind) {
    setEditingId(null);
    setForm(emptyForm(nextKind));
  }

  function startEdit(product: Product) {
    setKind(product.kind);
    setEditingId(product.id);
    setForm({
      kind: product.kind,
      nome: product.nome,
      preco: product.preco,
      unidade: product.unidade || "un",
      observacao: product.observacao,
      createdAt: product.createdAt,
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
    if (editingId) {
      updateProduct(editingId, { ...form, nome, kind });
      setNotice("Cadastro atualizado.");
    } else {
      addProduct({ ...form, nome, kind });
      setNotice(`${kind === "produto" ? "Produto" : "Serviço"} cadastrado.`);
    }
    reset(kind);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink">Produtos e serviços</h1>
        <p className="mt-1 text-sm text-mute">
          Cadastre itens com preço. Nos lançamentos, a quantidade puxa o valor automaticamente (editável) e você pode
          aplicar desconto em R$ ou %.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-paper p-4">
          <p className="text-xs uppercase tracking-wide text-mute">Produtos</p>
          <p className="mt-1 font-display text-3xl">{nProdutos}</p>
        </div>
        <div className="rounded-2xl border border-line bg-paper p-4">
          <p className="text-xs uppercase tracking-wide text-mute">Serviços</p>
          <p className="mt-1 font-display text-3xl">{nServicos}</p>
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
            Preço unitário
            <input
              className="input mt-1"
              type="number"
              min="0"
              step="0.01"
              value={form.preco || ""}
              onChange={(e) => setForm({ ...form, preco: Number(e.target.value) })}
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
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-navy text-white">
            <tr className="text-left text-xs">
              <th className="px-3 py-3">Nome</th>
              <th>Preço</th>
              <th>Unidade</th>
              <th>Observação</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-mute">
                  Nenhum {kind === "produto" ? "produto" : "serviço"} cadastrado.
                </td>
              </tr>
            ) : (
              list.map((p, i) => (
                <tr key={p.id} className={cn(i % 2 ? "bg-bg/70" : "bg-paper")}>
                  <td className="px-3 py-2 font-medium">{p.nome}</td>
                  <td>{formatMoney(p.preco)}</td>
                  <td>{p.unidade || "un"}</td>
                  <td className="text-mute">{p.observacao || "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
