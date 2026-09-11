/** Remove o fundo sólido da logo e devolve PNG com transparência. */

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Imagem inválida."));
    img.src = src;
  });
}

function dist(r: number, g: number, b: number, br: number, bg: number, bb: number) {
  return Math.hypot(r - br, g - bg, b - bb);
}

export async function stripLogoBackground(src: string): Promise<string> {
  const img = await loadImage(src);
  const maxW = 960;
  const maxH = 280;
  const scale = Math.min(1, maxW / img.width, maxH / img.height);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return src;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;
  const bins = new Map<string, { n: number; r: number; g: number; b: number }>();

  const pushBorder = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    if (d[i + 3] < 16) return;
    const key = `${d[i] >> 4}-${d[i + 1] >> 4}-${d[i + 2] >> 4}`;
    const cur = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    cur.n += 1;
    cur.r += d[i];
    cur.g += d[i + 1];
    cur.b += d[i + 2];
    bins.set(key, cur);
  };

  for (let x = 0; x < w; x++) {
    pushBorder(x, 0);
    pushBorder(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    pushBorder(0, y);
    pushBorder(w - 1, y);
  }

  let bg: { r: number; g: number; b: number } | null = null;
  let best = 0;
  for (const bin of bins.values()) {
    if (bin.n > best) {
      best = bin.n;
      bg = { r: bin.r / bin.n, g: bin.g / bin.n, b: bin.b / bin.n };
    }
  }

  if (bg && best > 8) {
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8) continue;
      const delta = dist(d[i], d[i + 1], d[i + 2], bg.r, bg.g, bg.b);
      if (delta < 28) d[i + 3] = 0;
      else if (delta < 48) d[i + 3] = Math.round(((delta - 28) / 20) * d[i + 3]);
    }
  }

  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] < 12) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) return src;

  ctx.putImageData(image, 0, 0);
  const pad = 2;
  const sx = Math.max(0, minX - pad);
  const sy = Math.max(0, minY - pad);
  const sw = Math.min(w - sx, maxX - minX + 1 + pad * 2);
  const sh = Math.min(h - sy, maxY - minY + 1 + pad * 2);
  const out = document.createElement("canvas");
  out.width = sw;
  out.height = sh;
  const octx = out.getContext("2d");
  if (!octx) return canvas.toDataURL("image/png");
  octx.clearRect(0, 0, sw, sh);
  octx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return out.toDataURL("image/png");
}
