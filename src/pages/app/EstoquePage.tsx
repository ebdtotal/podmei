import { Package, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BackToReports } from "@/components/layout/BackToReports";
import { printOrSharePdf } from "@/lib/print";
import { productsEmFalta, productsParados, stockLevel } from "@/lib/stock";
import { useStore } from "@/lib/store";
import { cn, formatDate, formatMoney, todayIso } from "@/lib/utils";

function levelLabel(level: string) {
  if (level === "negativo") return "Negativo";
  if (level === "zerado") return "Zerado";
  if (level === "baixo") return "Baixo";
  return "Ok";
}

export function EstoquePage() {
  const { company, products, stockMovements } = useStore();
  const [diasParado, setDiasParado] = useState(60);

  const emFalta = useMemo(() => productsEmFalta(products), [products]);
  const parados = useMemo(
    () => productsParados(products, stockMovements, diasParado),
    [products, stockMovements, diasParado],
  );

  const nProdutos = products.filter((p) => p.kind === "produto").length;
  const valorEstoque = useMemo(
    () =>
      products
        .filter((p) => p.kind === "produto")
        .reduce((s, p) => s + Math.max(0, Number(p.estoqueAtual) || 0) * (Number(p.custoMedio) || 0), 0),
    [products],
  );

  return (
    <div className="space-y-6">
      <BackToReports />
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Estoque</h1>
          <p className="mt-1 text-sm text-mute">
            Produtos em falta e parados. Custo médio e margem vêm das compras e do preço de venda.{" "}
            <Link to="/app/produtos" className="font-semibold text-navy hover:underline">
              Ir para produtos
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium text-mute">
            Dias sem saída
            <select
              className="input mt-1 w-auto"
              value={diasParado}
              onChange={(e) => setDiasParado(Number(e.target.value))}
            >
              <option value={30}>30 dias</option>
              <option value={60}>60 dias</option>
              <option value={90}>90 dias</option>
              <option value={180}>180 dias</option>
            </select>
          </label>
          <button
            type="button"
            className="btn-primary gap-2"
            onClick={() => void printOrSharePdf("estoque.pdf")}
          >
            <Printer className="size-4" />
            Exportar PDF
          </button>
        </div>
      </div>

      <div className="no-print grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-paper p-4">
          <p className="text-xs uppercase tracking-wide text-mute">Produtos</p>
          <p className="mt-1 font-display text-3xl">{nProdutos}</p>
        </div>
        <div className="rounded-2xl border border-line bg-paper p-4">
          <p className="text-xs uppercase tracking-wide text-mute">Em falta</p>
          <p className={cn("mt-1 font-display text-3xl", emFalta.length ? "text-orange" : "")}>
            {emFalta.length}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-paper p-4">
          <p className="text-xs uppercase tracking-wide text-mute">Valor em estoque (custo)</p>
          <p className="mt-1 font-display text-2xl">{formatMoney(valorEstoque)}</p>
        </div>
      </div>

      <article
        className="print-sheet hidden border border-ink bg-paper p-6 text-[13px]"
        aria-hidden="true"
      >
        <h2 className="text-center text-base font-bold">RELATÓRIO DE ESTOQUE</h2>
        <p className="mt-1 text-center text-[11px]">
          {company.nome} · CNPJ {company.cnpj} · {formatDate(todayIso())}
        </p>
        <p className="mt-2 text-center text-[11px] text-mute">
          {nProdutos} produtos · {emFalta.length} em falta · {parados.length} parados (≥ {diasParado} d) · valor a custo{" "}
          {formatMoney(valorEstoque)}
        </p>

        <h3 className="mt-6 border-b border-ink pb-1 text-sm font-bold">Produtos em falta</h3>
        <table className="mt-2 w-full text-[12px]">
          <thead>
            <tr className="border-b border-ink text-left">
              <th className="py-1.5 pr-2">Produto</th>
              <th className="pr-2">Estoque</th>
              <th className="pr-2">Mín.</th>
              <th className="pr-2">Situação</th>
              <th className="pr-2">Custo méd.</th>
              <th>Preço</th>
            </tr>
          </thead>
          <tbody>
            {emFalta.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-3 text-mute">
                  Nenhum produto em alerta.
                </td>
              </tr>
            ) : (
              emFalta.map((r) => (
                <tr key={r.product.id} className="border-b border-ink/30">
                  <td className="py-1.5 pr-2 font-medium">{r.product.nome}</td>
                  <td className="pr-2">
                    {Number(r.product.estoqueAtual) || 0} {r.product.unidade || "un"}
                  </td>
                  <td className="pr-2">{Number(r.product.estoqueMinimo) || 0}</td>
                  <td className="pr-2">{levelLabel(r.level)}</td>
                  <td className="pr-2">{r.custoMedio > 0 ? formatMoney(r.custoMedio) : "—"}</td>
                  <td>
                    {formatMoney(r.preco)}
                    {r.margemUnit != null ? ` (${formatMoney(r.margemUnit)}/un)` : ""}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <h3 className="mt-6 border-b border-ink pb-1 text-sm font-bold">
          Produtos parados (sem saída há {diasParado}+ dias)
        </h3>
        <table className="mt-2 w-full text-[12px]">
          <thead>
            <tr className="border-b border-ink text-left">
              <th className="py-1.5 pr-2">Produto</th>
              <th className="pr-2">Estoque</th>
              <th className="pr-2">Dias</th>
              <th className="pr-2">Última saída</th>
              <th className="pr-2">Custo méd.</th>
              <th>Valor parado</th>
            </tr>
          </thead>
          <tbody>
            {parados.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-3 text-mute">
                  Nenhum produto parado neste critério.
                </td>
              </tr>
            ) : (
              parados.map((r) => {
                const qty = Number(r.product.estoqueAtual) || 0;
                const valor = qty * r.custoMedio;
                return (
                  <tr key={r.product.id} className="border-b border-ink/30">
                    <td className="py-1.5 pr-2 font-medium">{r.product.nome}</td>
                    <td className="pr-2">
                      {qty} {r.product.unidade || "un"}
                      {stockLevel(r.product) === "baixo" ? " · baixo" : ""}
                    </td>
                    <td className="pr-2">{r.diasParado != null ? `${r.diasParado} d` : "—"}</td>
                    <td className="pr-2">{r.ultimaSaida ? formatDate(r.ultimaSaida) : "Nunca"}</td>
                    <td className="pr-2">{r.custoMedio > 0 ? formatMoney(r.custoMedio) : "—"}</td>
                    <td>{r.custoMedio > 0 ? formatMoney(valor) : "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </article>

      <section className="no-print rounded-2xl border border-line bg-paper p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Package className="size-4 text-orange" />
          Produtos em falta
        </h2>
        <p className="mt-1 text-xs text-mute">Abaixo do mínimo, zerados ou com saldo negativo.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-mute">
                <th className="py-2 pr-3">Produto</th>
                <th className="pr-3">Estoque</th>
                <th className="pr-3">Mínimo</th>
                <th className="pr-3">Situação</th>
                <th className="pr-3">Custo médio</th>
                <th>Preço / margem</th>
              </tr>
            </thead>
            <tbody>
              {emFalta.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-mute">
                    Nenhum produto em alerta.
                  </td>
                </tr>
              ) : (
                emFalta.map((r) => (
                  <tr key={r.product.id} className="border-b border-line/60">
                    <td className="py-2 pr-3 font-medium">{r.product.nome}</td>
                    <td className="pr-3">
                      {Number(r.product.estoqueAtual) || 0} {r.product.unidade || "un"}
                    </td>
                    <td className="pr-3 text-mute">{Number(r.product.estoqueMinimo) || 0}</td>
                    <td className="pr-3 font-semibold text-orange">{levelLabel(r.level)}</td>
                    <td className="pr-3">{r.custoMedio > 0 ? formatMoney(r.custoMedio) : "—"}</td>
                    <td>
                      {formatMoney(r.preco)}
                      {r.margemUnit != null ? (
                        <span className={cn("ml-2 text-xs", r.margemUnit < 0 ? "text-red" : "text-mute")}>
                          ({formatMoney(r.margemUnit)}/un)
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="no-print rounded-2xl border border-line bg-paper p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Package className="size-4" />
          Produtos parados
        </h2>
        <p className="mt-1 text-xs text-mute">
          Com saldo positivo e sem saída há pelo menos o período escolhido.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-mute">
                <th className="py-2 pr-3">Produto</th>
                <th className="pr-3">Estoque</th>
                <th className="pr-3">Dias parado</th>
                <th className="pr-3">Última saída</th>
                <th className="pr-3">Custo médio</th>
                <th>Valor parado</th>
              </tr>
            </thead>
            <tbody>
              {parados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-mute">
                    Nenhum produto parado neste critério.
                  </td>
                </tr>
              ) : (
                parados.map((r) => {
                  const qty = Number(r.product.estoqueAtual) || 0;
                  const valor = qty * r.custoMedio;
                  return (
                    <tr key={r.product.id} className="border-b border-line/60">
                      <td className="py-2 pr-3 font-medium">{r.product.nome}</td>
                      <td className="pr-3">
                        {qty} {r.product.unidade || "un"}
                        {stockLevel(r.product) === "baixo" ? (
                          <span className="ml-2 text-xs text-orange">baixo</span>
                        ) : null}
                      </td>
                      <td className="pr-3">{r.diasParado != null ? `${r.diasParado} d` : "—"}</td>
                      <td className="pr-3 text-mute">
                        {r.ultimaSaida ? formatDate(r.ultimaSaida) : "Nunca"}
                      </td>
                      <td className="pr-3">{r.custoMedio > 0 ? formatMoney(r.custoMedio) : "—"}</td>
                      <td>{r.custoMedio > 0 ? formatMoney(valor) : "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
