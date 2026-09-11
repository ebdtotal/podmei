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

function revealPrintOnly(root: HTMLElement) {
  root.querySelectorAll(".hidden").forEach((el) => {
    if ([...el.classList].some((name) => name === "print:block" || name.startsWith("print:"))) {
      el.classList.remove("hidden");
    }
  });
}

/** Captura a folha num iframe claro, para o tema escuro não pintar o PDF. */
async function captureLightSheet(sheet: HTMLElement): Promise<HTMLCanvasElement> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;left:-12000px;top:0;width:900px;height:1600px;border:0;background:#ffffff;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    throw new Error("Não foi possível preparar o PDF.");
  }

  document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    doc.head.appendChild(node.cloneNode(true));
  });
  const extra = doc.createElement("style");
  extra.textContent = "html,body{margin:0;background:#fff;color:#0f172a}";
  doc.head.appendChild(extra);

  const clone = sheet.cloneNode(true) as HTMLElement;
  revealPrintOnly(clone);
  clone.style.width = `${CAPTURE_WIDTH_PX}px`;
  clone.style.maxWidth = `${CAPTURE_WIDTH_PX}px`;
  clone.style.margin = "0";
  clone.style.boxShadow = "none";
  clone.style.borderRadius = "0";
  clone.style.border = "none";
  clone.style.background = "#ffffff";
  clone.style.color = "#0f172a";
  doc.body.appendChild(clone);

  await new Promise((r) => setTimeout(r, 40));

  try {
    return await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: CAPTURE_WIDTH_PX,
      windowWidth: CAPTURE_WIDTH_PX,
    });
  } finally {
    iframe.remove();
  }
}

/**
 * Gera PDF A4 claro a partir da área `.print-sheet` (web e app).
 * O tema escuro da tela não entra no arquivo.
 */
export async function printOrSharePdf(filename = "podmei-relatorio.pdf") {
  const sheet = document.querySelector(".print-sheet") as HTMLElement | null;
  if (!sheet) {
    window.alert("Nada para gerar em PDF nesta tela.");
    return;
  }

  try {
    const canvas = await captureLightSheet(sheet);
    const pdf = buildA4PdfFromCanvas(canvas);
    await saveOrSharePdf(pdf, filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
  } catch (err) {
    if (isShareCancel(err)) return;
    window.alert(err instanceof Error ? err.message : "Não foi possível gerar o PDF A4.");
  }
}
