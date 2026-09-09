import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useStore } from "@/lib/store";
import type { Product, ProductKind } from "@/lib/types";
import { todayIso } from "@/lib/utils";

export function QuickProductModal({
  open,
  defaultKind,
  defaultNome = "",
  onClose,
  onCreated,
}: {
  open: boolean;
  defaultKind: ProductKind;
  defaultNome?: string;
  onClose: () => void;
  onCreated: (product: Product) => void;
}) {
  const { addProduct } = useStore();
  const [kind, setKind] = useState<ProductKind>(defaultKind);
  const [nome, setNome] = useState(defaultNome);
  const [preco, setPreco] = useState(0);
  const [unidade, setUnidade] = useState("un");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setKind(defaultKind);
    setNome(defaultNome);
    setPreco(0);
    setUnidade("un");
    setError("");
  }, [open, defaultKind, defaultNome]);

  function save() {
    const n = nome.trim();
    if (n.length < 2) {
      setError("Informe o nome do produto ou serviço.");
      return;
    }
    if (preco < 0) {
      setError("O preço não pode ser negativo.");
      return;
    }
    const product = addProduct({
      kind,
      nome: n,
      preco,
      unidade: unidade.trim() || "un",
      observacao: "",
      createdAt: todayIso(),
    });
    onCreated(product);
    onClose();
  }

  return (
    <Modal
      open={open}
      title={kind === "produto" ? "Cadastrar produto" : "Cadastrar serviço"}
      onClose={onClose}
    >
      <div className="grid gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={kind === "produto" ? "btn-primary !px-3 !py-2 text-xs" : "btn-ghost !px-3 !py-2 text-xs"}
            onClick={() => setKind("produto")}
          >
            Produto
          </button>
          <button
            type="button"
            className={kind === "servico" ? "btn-primary !px-3 !py-2 text-xs" : "btn-ghost !px-3 !py-2 text-xs"}
            onClick={() => setKind("servico")}
          >
            Serviço
          </button>
        </div>
        <label className="block text-xs font-medium text-mute">
          Nome
          <input
            className="input mt-1"
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={kind === "produto" ? "Ex.: Camiseta básica" : "Ex.: Consultoria 1h"}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-mute">
            Preço unitário
            <input
              className="input mt-1"
              type="number"
              min="0"
              step="0.01"
              value={preco || ""}
              onChange={(e) => setPreco(Number(e.target.value))}
            />
          </label>
          <label className="block text-xs font-medium text-mute">
            Unidade
            <input
              className="input mt-1"
              value={unidade}
              onChange={(e) => setUnidade(e.target.value)}
              placeholder="un, hr, kg…"
            />
          </label>
        </div>
        {error ? <p className="text-sm text-red">{error}</p> : null}
        <div className="mt-1 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={save}>
            Salvar cadastro
          </button>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
}
