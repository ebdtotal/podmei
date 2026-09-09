import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

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

/**
 * Web: diálogo de impressão do navegador.
 * App (iOS/Android): gera PDF da área .print-sheet e abre compartilhar/salvar.
 */
export async function printOrSharePdf(filename = "podmei-relatorio.pdf") {
  if (!isNative()) {
    window.print();
    return;
  }

  const sheet = document.querySelector(".print-sheet") as HTMLElement | null;
  if (!sheet) {
    window.alert("Nada para imprimir nesta tela.");
    return;
  }

  try {
    const canvas = await html2canvas(sheet, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;

    let heightLeft = imgH;
    let position = 0;
    pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
    heightLeft -= pageH;

    while (heightLeft > 0) {
      position = heightLeft - imgH;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
      heightLeft -= pageH;
    }

    await saveOrSharePdf(pdf, filename);
  } catch (err) {
    if (isShareCancel(err)) return;
    window.alert(err instanceof Error ? err.message : "Não foi possível gerar o PDF.");
  }
}
