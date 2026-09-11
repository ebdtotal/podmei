import { jsPDF } from "jspdf";
import type { Company, Entry } from "./types";
import { formatDate, formatMoney } from "./utils";
import { saveOrSharePdf } from "./print";

const BAND = { r: 7, g: 11, b: 20 };
const GOLD = { r: 230, g: 179, b: 37 };
const INK = { r: 15, g: 23, b: 42 };

type LogoSize = { dataUrl: string; format: "PNG" | "JPEG"; w: number; h: number };

function imageFormat(dataUrl: string): "PNG" | "JPEG" {
  return dataUrl.includes("image/png") ? "PNG" : "JPEG";
}

function loadLogo(dataUrl: string): Promise<LogoSize> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxW = 78;
      const maxH = 22;
      const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
      resolve({
        dataUrl,
        format: imageFormat(dataUrl),
        w: img.naturalWidth * scale,
        h: img.naturalHeight * scale,
      });
    };
    img.onerror = () => reject(new Error("logo"));
    img.src = dataUrl;
  });
}

function headerLines(company: Company) {
  const lines: string[] = [];
  if (company.cnpj.trim()) lines.push(`CNPJ: ${company.cnpj.trim()}`);
  if (company.telefone.trim()) lines.push(`WHATSAPP: ${company.telefone.trim()}`);
  if (company.email.trim()) lines.push(`E-MAIL: ${company.email.trim()}`);
  if (company.instagram?.trim()) lines.push(`INSTAGRAM ${company.instagram.trim()}`);
  return lines;
}

export async function downloadReciboPdf(company: Company, entry: Entry) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const left = 14;
  const right = pageW - 14;

  const lines = headerLines(company);
  const logo = company.logoDataUrl
    ? await loadLogo(company.logoDataUrl).catch(() => null)
    : null;
  const textBlock = 6 + lines.length * 4.4;
  const bandH = Math.max(34, (logo?.h ?? 0) + 12, textBlock + 10);

  doc.setFillColor(BAND.r, BAND.g, BAND.b);
  doc.rect(0, 0, pageW, bandH, "F");

  if (logo) {
    const y = (bandH - logo.h) / 2;
    try {
      doc.addImage(logo.dataUrl, logo.format, left, y, logo.w, logo.h);
    } catch {
      /* logo inválida */
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const nameY = (bandH - textBlock) / 2 + 4;
  const name = (company.nome || "Empresa").toUpperCase();
  const nameLines = doc.splitTextToSize(name, 88);
  doc.text(nameLines, right, nameY, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(GOLD.r, GOLD.g, GOLD.b);
  lines.forEach((line, i) => {
    doc.text(line, right, nameY + nameLines.length * 4.2 + 2 + i * 4.4, { align: "right" });
  });

  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.setFont("times", "bold");
  doc.setFontSize(22);
  doc.text("RECIBO", pageW / 2, bandH + 16, { align: "center" });

  const responsavel = company.responsavel?.trim();
  const empresa = company.nome?.trim() || "a empresa";
  const cnpj = company.cnpj.trim() || "CNPJ não informado";
  const quem = [responsavel, empresa].filter(Boolean).join(" ");
  const cliente = entry.contraparte.trim() || "o cliente";
  const descricao = entry.descricao.trim() || "o serviço";

  const paragrafos = [
    `Pelo presente, eu ${quem} inscrita no CNPJ ${cnpj} declaro que RECEBI no dia ${formatDate(entry.data)}, o valor de ${formatMoney(entry.valor)}, de ${cliente}.`,
    `Declaro ainda que o valor recebido se refere-se a ${descricao}.`,
    "Sendo expressão de verdade e sem qualquer coação, firmo o presente.",
  ];

  doc.setFont("times", "normal");
  doc.setFontSize(12);
  let y = bandH + 30;
  for (const paragrafo of paragrafos) {
    const wrapped = doc.splitTextToSize(paragrafo, 170);
    doc.text(wrapped, left, y);
    y += wrapped.length * 6.4 + 6;
  }

  const signY = Math.max(y + 18, 230);
  doc.setDrawColor(INK.r, INK.g, INK.b);
  doc.line(120, signY, right, signY);
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.text(responsavel || empresa, 120, signY + 6, { maxWidth: 76 });
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("Assinatura", 120, signY + 11);

  await saveOrSharePdf(doc, `recibo-${entry.data}-${entry.id}.pdf`);
}
