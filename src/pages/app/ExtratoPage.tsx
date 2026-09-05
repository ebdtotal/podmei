import { FileSpreadsheet, FileText, Upload } from "lucide-react";
import { useState } from "react";
import {
  draftToBankEntry,
  EXTRATO_MODELO_CSV,
  extractPdfText,
  markDuplicates,
  parseExcelMatrix,
  parseSpreadsheet,
  parseStatementLines,
  type BankDraft,
} from "@/lib/extrato";
import { useStore } from "@/lib/store";
import type { EntryKind } from "@/lib/types";
import { cn, currentYear, formatDate, formatMoney } from "@/lib/utils";

export function ExtratoPage() {
  const { entries, addEntries } = useStore();
  const [drafts, setDrafts] = useState<BankDraft[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");

  async function onFile(file: File) {
    setError("");
    setSaved("");
    setFileName(file.name);
    setBusy(true);
    try {
      const year = currentYear();
      const buf = await file.arrayBuffer();
      const name = file.name.toLowerCase();
      let parsed: BankDraft[] = [];
      if (name.endsWith(".pdf")) {
        const text = await extractPdfText(buf);
        parsed = parseStatementLines(text, year);
        if (parsed.length === 0) {
          setError(
            "Não achei linhas com data e valor neste PDF. Exporte o extrato em Excel/CSV ou um PDF com texto selecionável (não imagem).",
          );
        }
      } else if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")) {
        parsed = await parseSpreadsheet(buf, year);
        if (parsed.length === 0) {
          setError("Não achei colunas de data e valor. Use o modelo CSV ou um extrato com cabeçalho Data / Histórico / Valor.");
        }
      } else {
        setError("Envie PDF, Excel (.xlsx) ou CSV.");
      }
      setDrafts(markDuplicates(parsed, entries));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao ler o arquivo.");
      setDrafts([]);
    } finally {
      setBusy(false);
    }
  }

  function patch(id: string, next: Partial<BankDraft>) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...next } : d)));
  }

  const selected = drafts.filter((d) => d.selected);
  const entradas = selected.filter((d) => d.direcao === "entrada").reduce((s, d) => s + d.valor, 0);
  const saidas = selected.filter((d) => d.direcao === "saida").reduce((s, d) => s + d.valor, 0);

  function importSelected() {
    const list = selected.map(draftToBankEntry);
    if (list.length === 0) return;
    addEntries(list);
    setSaved(`${list.length} lançamento(s) importados do extrato.`);
    setDrafts([]);
    setFileName("");
  }

  function loadModelo() {
    setError("");
    setSaved("");
    setFileName("modelo-extrato-mei.csv");
    const rows = EXTRATO_MODELO_CSV.trim()
      .split(/\r?\n/)
      .map((line) => line.split(","));
    const parsed = parseExcelMatrix(rows, currentYear());
    setDrafts(markDuplicates(parsed, entries));
  }

  function downloadModelo() {
    const blob = new Blob([EXTRATO_MODELO_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-extrato-mei.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink">Leitor de extrato bancário</h1>
        <p className="mt-1 max-w-2xl text-sm text-mute">
          Envie o PDF ou o Excel do banco. O app separa entradas (receitas) e saídas (despesas/compras). Confira e
          importe para o livro-caixa.
        </p>
      </div>

      <section className="rounded-2xl border border-dashed border-navy/30 bg-paper p-6">
        <div className="flex flex-wrap items-center gap-3">
          <label className="btn-primary cursor-pointer gap-2">
            <Upload className="size-4" />
            {busy ? "Lendo arquivo…" : "Enviar PDF ou Excel"}
            <input
              type="file"
              accept=".pdf,.xlsx,.xls,.csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFile(file);
                e.target.value = "";
              }}
            />
          </label>
          <button type="button" className="btn-ghost gap-2" onClick={downloadModelo}>
            <FileSpreadsheet className="size-4" />
            Baixar modelo CSV
          </button>
          <button type="button" className="btn-ghost" onClick={loadModelo}>
            Ver com dados de exemplo
          </button>
        </div>
        <p className="mt-3 text-xs text-mute">
          Funciona com extratos em texto (Nubank, Inter, Itaú, Bradesco, BB, C6) e planilhas com colunas Data, Histórico,
          Valor e, se houver, Débito/Crédito ou Tipo C/D. PDF escaneado (imagem) não é lido.
        </p>
        {fileName ? (
          <p className="mt-2 flex items-center gap-2 text-sm">
            <FileText className="size-4 text-ink" />
            {fileName}
          </p>
        ) : null}
        {error ? <p className="mt-2 text-sm text-red">{error}</p> : null}
        {saved ? <p className="mt-2 text-sm text-green">{saved}</p> : null}
      </section>

      {drafts.length > 0 ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Mini label="Linhas lidas" value={String(drafts.length)} />
            <Mini label="Receitas selecionadas" value={formatMoney(entradas)} />
            <Mini label="Saídas selecionadas" value={formatMoney(saidas)} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-mute">
              {selected.length} selecionada(s). Linhas já lançadas no mesmo dia e valor vêm desmarcadas.
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost" onClick={() => setDrafts((d) => d.map((x) => ({ ...x, selected: !x.duplicate })))}>
                Marcar novas
              </button>
              <button type="button" className="btn-primary" onClick={importSelected} disabled={selected.length === 0}>
                Importar {selected.length} lançamento(s)
              </button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-navy text-left text-xs text-white">
                <tr>
                  <th className="px-3 py-3">Ok</th>
                  <th>Data</th>
                  <th>Histórico</th>
                  <th>Direção</th>
                  <th>Tipo</th>
                  <th>Valor</th>
                  <th>Contraparte</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((d) => (
                  <tr key={d.id} className={cn("border-t border-line", d.duplicate && "bg-orange/5")}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={d.selected}
                        onChange={(e) => patch(d.id, { selected: e.target.checked })}
                      />
                    </td>
                    <td>{formatDate(d.data)}</td>
                    <td className="max-w-xs truncate" title={d.raw}>
                      {d.descricao}
                      {d.duplicate ? <span className="ml-2 text-[11px] font-semibold text-orange">já lançado</span> : null}
                    </td>
                    <td>
                      <select
                        className="input w-28 py-1"
                        value={d.direcao}
                        onChange={(e) => {
                          const direcao = e.target.value as BankDraft["direcao"];
                          const kind: EntryKind = direcao === "entrada" ? "venda" : d.kind === "venda" ? "despesa" : d.kind;
                          patch(d.id, { direcao, kind, revenueKind: direcao === "entrada" ? (d.revenueKind ?? "servico") : undefined });
                        }}
                      >
                        <option value="entrada">Receita</option>
                        <option value="saida">Saída</option>
                      </select>
                    </td>
                    <td>
                      <select
                        className="input w-32 py-1"
                        value={d.kind}
                        onChange={(e) => patch(d.id, { kind: e.target.value as EntryKind })}
                      >
                        <option value="venda">Venda</option>
                        <option value="despesa">Despesa</option>
                        <option value="compra">Compra</option>
                      </select>
                    </td>
                    <td className="font-medium">{formatMoney(d.valor)}</td>
                    <td>
                      <input
                        className="input py-1"
                        value={d.contraparte}
                        onChange={(e) => patch(d.id, { contraparte: e.target.value })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-paper p-4">
      <p className="text-xs text-mute">{label}</p>
      <p className="mt-1 font-display text-2xl text-ink">{value}</p>
    </div>
  );
}
