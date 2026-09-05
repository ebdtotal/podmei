import { jsPDF } from "jspdf";
import type { Company, Entry } from "./types";
import { formatDate, formatMoney } from "./utils";

export function downloadReciboPdf(company: Company, entry: Entry) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const w = 210;

  doc.setFillColor(123, 44, 245);
  doc.rect(0, 0, w, 32, "F");

  if (company.logoDataUrl) {
    try {
      const format = company.logoDataUrl.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(company.logoDataUrl, format, 14, 5, 22, 22);
    } catch {
      /* logo inválida: segue o recibo sem imagem */
    }
  }

  const titleX = company.logoDataUrl ? 40 : 14;
  doc.setTextColor(34, 197, 94);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(company.nome || "POD MEI", titleX, 14, { maxWidth: 150 });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text("RECIBO DE PRESTAÇÃO DE SERVIÇO / VENDA", titleX, 22);

  doc.setTextColor(18, 32, 51);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Emitente", 14, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const emitente = [
    company.nome,
    `CNPJ ${company.cnpj}`,
    `${company.endereco} — ${company.bairro}`,
    `${company.cidade}/${company.uf}`,
    `${company.telefone} · ${company.email}`,
  ];
  emitente.forEach((line, i) => doc.text(line, 14, 54 + i * 6));

  doc.setDrawColor(215, 222, 234);
  doc.line(14, 88, 196, 88);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Recebemos de", 14, 100);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(entry.contraparte, 14, 108);

  doc.setFont("helvetica", "bold");
  doc.text("A importância de", 14, 122);
  doc.setFontSize(16);
  doc.setTextColor(11, 31, 74);
  doc.text(formatMoney(entry.valor), 14, 132);
  doc.setTextColor(18, 32, 51);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Referente a: ${entry.descricao}`, 14, 144);
  doc.text(`Documento: ${entry.documento}`, 14, 152);
  doc.text(`Forma de pagamento: ${entry.formaPagamento.toUpperCase()}`, 14, 160);
  doc.text(`Data: ${formatDate(entry.data)}`, 14, 168);
  doc.text(`Documento fiscal: ${entry.documentoFiscal ? "SIM" : "NÃO"}`, 14, 176);

  doc.setFillColor(244, 246, 251);
  doc.rect(14, 190, 182, 28, "F");
  doc.setFontSize(9);
  doc.text(
    "Este recibo comprova o recebimento do valor acima. Guarde junto ao Relatório Mensal das Receitas Brutas do MEI.",
    18,
    200,
    { maxWidth: 174 },
  );

  if (company.logoDataUrl) {
    try {
      const format = company.logoDataUrl.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(company.logoDataUrl, format, 14, 228, 16, 16);
    } catch {
      /* ignore */
    }
  }

  doc.line(120, 244, 196, 244);
  doc.setFontSize(9);
  doc.text(company.nome, 120, 250, { maxWidth: 76 });
  doc.text("Assinatura do empresário", 120, 256);

  doc.save(`recibo-${entry.data}-${entry.id}.pdf`);
}
