function emv(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

function crc16(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function pixCopiaECola(opts: { key: string; name: string; amount: number; txid: string; city?: string }) {
  const key = opts.key.trim();
  if (!key) return "";
  const merchant = emv("00", "BR.GOV.BCB.PIX") + emv("01", key);
  const name = opts.name.slice(0, 25) || "POD MEI";
  const city = (opts.city || "SAO PAULO").slice(0, 15);
  const txid = opts.txid.replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "PODMEI";
  const amount = opts.amount.toFixed(2);
  const body =
    emv("00", "01") +
    emv("26", merchant) +
    emv("52", "0000") +
    emv("53", "986") +
    emv("54", amount) +
    emv("58", "BR") +
    emv("59", name) +
    emv("60", city) +
    emv("62", emv("05", txid)) +
    "6304";
  return body + crc16(body);
}
