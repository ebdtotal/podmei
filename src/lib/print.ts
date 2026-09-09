import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_MM = 10;
const CONTENT_WIDTH_MM = A4_WIDTH_MM - MARGIN_MM * 2;
const CONTENT_HEIGHT_MM = A4_HEIGHT_MM - MARGIN_MM * 2;
/** Largura de captura ≈ área útil A4 em 96dpi. */
const CAPTURE_WIDTH_PX = Math.round((CONTENT_WIDTH_MM / 25.4) * 96);

function isNative() {
  return Capacitor.isNativePlatform();
}

function isShareCancel(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /cancel|dismiss|abort/i.test(msg);
}

/** Salva/baixa o PDF no desktop; no app abre o compartilhamento nativo. */
export async function saveOrSharePdf(doc: jsPDF, filename: string) {
  if (!isNative()) {
    doc.save(filename);
    return;
  }

  const base64 = doc.output("datauristring").split(",")[1];
  if (!base64) throw new Error("Não foi possível gerar o PDF.");

  const safeName = filename.replace(/[^\w.\-]+/g, "_");
  const written = await Filesystem.writeFile({
    path: safeName,
    data: base64,
    directory: Directory.Cache,
  });

  try {
    await Share.share({
      title: filename,
      url: written.uri,
      dialogTitle: "Compartilhar ou salvar PDF",
    });
  } catch (err) {
    if (!isShareCancel(err)) throw err;
  }
}

function buildA4PdfFromCanvas(canvas: HTMLCanvasElement): jsPDF {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const imgW = CONTENT_WIDTH_MM;
  const imgH = (canvas.height * imgW) / canvas.width;
  const imgData = canvas.toDataURL("image/jpeg", 0.93);

  let heightLeft = imgH;
  let yOffset = 0;

  pdf.addImage(imgData, "JPEG", MARGIN_MM, MARGIN_MM + yOffset, imgW, imgH);
  heightLeft -= CONTENT_HEIGHT_MM;

  while (heightLeft > 0.5) {
    yOffset -= CONTENT_HEIGHT_MM;
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", MARGIN_MM, MARGIN_MM + yOffset, imgW, imgH);
    heightLeft -= CONTENT_HEIGHT_MM;
  }

  return pdf;
}

/**
 * Gera PDF A4 a partir da área `.print-sheet` (web e app).
 * Web: baixa o arquivo. App: abre compartilhar/salvar.
 */
export async function printOrSharePdf(filename = "podmei-relatorio.pdf") {
  const sheet = document.querySelector(".print-sheet") as HTMLElement | null;
  if (!sheet) {
    window.alert("Nada para gerar em PDF nesta tela.");
    return;
  }

  const prev = {
    width: sheet.style.width,
    maxWidth: sheet.style.maxWidth,
    margin: sheet.style.margin,
    boxShadow: sheet.style.boxShadow,
    borderRadius: sheet.style.borderRadius,
    border: sheet.style.border,
    background: sheet.style.background,
  };

  try {
    sheet.style.width = `${CAPTURE_WIDTH_PX}px`;
    sheet.style.maxWidth = `${CAPTURE_WIDTH_PX}px`;
    sheet.style.margin = "0 auto";
    sheet.style.boxShadow = "none";
    sheet.style.borderRadius = "0";
    sheet.style.border = "none";
    sheet.style.background = "#ffffff";

    // Espera layout aplicar a largura A4 antes de capturar.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const canvas = await html2canvas(sheet, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: CAPTURE_WIDTH_PX,
      windowWidth: CAPTURE_WIDTH_PX,
    });

    const pdf = buildA4PdfFromCanvas(canvas);
    await saveOrSharePdf(pdf, filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
  } catch (err) {
    if (isShareCancel(err)) return;
    window.alert(err instanceof Error ? err.message : "Não foi possível gerar o PDF A4.");
  } finally {
    sheet.style.width = prev.width;
    sheet.style.maxWidth = prev.maxWidth;
    sheet.style.margin = prev.margin;
    sheet.style.boxShadow = prev.boxShadow;
    sheet.style.borderRadius = prev.borderRadius;
    sheet.style.border = prev.border;
    sheet.style.background = prev.background;
  }
}
