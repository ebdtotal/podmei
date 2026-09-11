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

const UNSUPPORTED_COLOR = /oklab\(|oklch\(|color-mix\(|\blab\(|\blch\(|\bcolor\(/i;

function needsColorFix(value: string) {
  return UNSUPPORTED_COLOR.test(value);
}

/** O navegador entende oklab; html2canvas não. Devolve rgb/rgba. */
function colorToRgba(input: string) {
  const probe = document.createElement("span");
  probe.style.color = input;
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  if (computed && !needsColorFix(computed)) return computed;

  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return computed && !needsColorFix(computed) ? computed : "rgb(15, 23, 42)";
  ctx.clearRect(0, 0, 1, 1);
  try {
    ctx.fillStyle = input;
    ctx.fillRect(0, 0, 1, 1);
  } catch {
    return "rgb(15, 23, 42)";
  }
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  const alpha = Math.round((a / 255) * 1000) / 1000;
  if (alpha <= 0) return "rgba(0, 0, 0, 0)";
  if (alpha >= 1) return `rgb(${r}, ${g}, ${b})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function rewriteUnsupportedColors(css: string) {
  const names = ["color-mix", "oklab", "oklch", "lab", "lch", "color"];
  let out = "";
  let i = 0;
  while (i < css.length) {
    let replaced = false;
    if (!/[\w-]/.test(css[i - 1] ?? " ")) {
      for (const name of names) {
        if (!css.startsWith(`${name}(`, i)) continue;
        const start = i;
        let depth = 0;
        i += name.length;
        for (; i < css.length; i++) {
          if (css[i] === "(") depth += 1;
          else if (css[i] === ")") {
            depth -= 1;
            if (depth === 0) {
              i += 1;
              out += colorToRgba(css.slice(start, i));
              replaced = true;
              break;
            }
          }
        }
        break;
      }
    }
    if (!replaced) {
      out += css[i] ?? "";
      i += 1;
    }
  }
  return out;
}

async function neutralizeUnsupportedColors(doc: Document) {
  const links = [...doc.querySelectorAll('link[rel="stylesheet"]')] as HTMLLinkElement[];
  await Promise.all(
    links.map(async (link) => {
      try {
        const css = await fetch(link.href).then((res) => res.text());
        const style = doc.createElement("style");
        style.setAttribute("data-safe", "1");
        style.textContent = rewriteUnsupportedColors(css);
        link.replaceWith(style);
      } catch {
        link.remove();
      }
    }),
  );
  doc.querySelectorAll("style").forEach((style) => {
    if (style.getAttribute("data-safe") === "1") return;
    style.textContent = rewriteUnsupportedColors(style.textContent || "");
    style.setAttribute("data-safe", "1");
  });
}

function patchComputedColors(view: Window) {
  const original = view.getComputedStyle.bind(view);
  view.getComputedStyle = ((elt: Element, pseudo?: string | null) => {
    const style = original(elt, pseudo);
    return new Proxy(style, {
      get(target, prop, receiver) {
        if (prop === "getPropertyValue") {
          return (name: string) => {
            const value = target.getPropertyValue(name);
            return needsColorFix(value) ? colorToRgba(value) : value;
          };
        }
        const value = Reflect.get(target, prop, receiver);
        if (typeof value === "function") return value.bind(target);
        if (typeof value === "string" && needsColorFix(value)) return colorToRgba(value);
        return value;
      },
    });
  }) as typeof view.getComputedStyle;
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
    "position:fixed;left:-12000px;top:0;width:900px;height:2200px;border:0;background:#ffffff;";
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

  await neutralizeUnsupportedColors(doc);
  if (iframe.contentWindow) patchComputedColors(iframe.contentWindow);
  await new Promise((r) => setTimeout(r, 40));

  const options = {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    width: CAPTURE_WIDTH_PX,
    windowWidth: CAPTURE_WIDTH_PX,
    onclone: (clonedDoc: Document) => {
      clonedDoc.querySelectorAll("style").forEach((style) => {
        style.textContent = rewriteUnsupportedColors(style.textContent || "");
      });
      if (clonedDoc.defaultView) patchComputedColors(clonedDoc.defaultView);
    },
  };

  try {
    try {
      return await html2canvas(clone, options);
    } catch (err) {
      doc.querySelectorAll("style, link[rel='stylesheet']").forEach((node) => node.remove());
      const plain = doc.createElement("style");
      plain.textContent =
        "html,body{margin:0;background:#fff;color:#111} .print-sheet,.print-holerite{color:#111;background:#fff}";
      doc.head.appendChild(plain);
      return await html2canvas(clone, { ...options, onclone: undefined });
    }
  } finally {
    iframe.remove();
  }
}

/**
 * Gera PDF A4 claro a partir da área `.print-sheet` (web e app).
 * O tema escuro da tela não entra no arquivo.
 */
export async function printOrSharePdf(filename = "podmei-relatorio.pdf", selector = ".print-sheet") {
  const sheet = document.querySelector(selector) as HTMLElement | null;
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
