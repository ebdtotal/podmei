import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { stripLogoBackground } from "@/lib/logo";
import { downloadReciboPdf } from "@/lib/pdf";
import { isSale } from "@/lib/mei";
import { useStore } from "@/lib/store";
import { formatDate, formatMoney } from "@/lib/utils";

export function RecibosPage() {
  const { company, entries } = useStore();
  const sales = entries.filter(isSale);
  const [logoPreview, setLogoPreview] = useState(company.logoDataUrl ?? "");

  useEffect(() => {
    const src = company.logoDataUrl;
    if (!src) {
      setLogoPreview("");
      return;
    }
    let cancelled = false;
    void stripLogoBackground(src).then((next) => {
      if (!cancelled) setLogoPreview(next);
    });
    return () => {
      cancelled = true;
    };
  }, [company.logoDataUrl]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">Recibos em PDF</h1>
          <p className="mt-1 text-sm text-mute">
            Cada venda cadastrada vira um recibo com os dados da empresa. Use quando a operação não tiver NFS-e.
          </p>
        </div>
        {logoPreview ? (
          <img
            src={logoPreview}
            alt="Logo no recibo"
            className="h-14 w-40 rounded-lg bg-[#070b14] object-contain px-2"
          />
        ) : null}
      </div>
      {!company.logoDataUrl ? (
        <p className="rounded-xl border border-gold bg-paper px-4 py-3 text-sm">
          Use PNG transparente, 720 × 200 px. Ainda não há logo no cadastro.{" "}
          <Link to="/app/empresa" className="font-semibold text-ink underline">
            Suba a logo em Empresa
          </Link>{" "}
          para ela aparecer no PDF.
        </p>
      ) : null}
      <div className="overflow-hidden rounded-2xl border border-line bg-paper">
        <table className="w-full text-sm">
          <thead className="bg-navy text-left text-xs text-white">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th>Cliente</th>
              <th>Descrição</th>
              <th>Valor</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sales.map((e) => (
              <tr key={e.id} className="border-t border-line">
                <td className="px-4 py-3">{formatDate(e.data)}</td>
                <td>{e.contraparte}</td>
                <td>{e.descricao}</td>
                <td className="font-medium">{formatMoney(e.valor)}</td>
                <td className="pr-4 text-right">
                  <button className="btn-primary" onClick={() => void downloadReciboPdf(company, e)}>
                    Gerar PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
