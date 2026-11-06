// format.js: format angka dan pembuat ID.

// 15000 -> "Rp 15.000", -9000 -> "−Rp 9.000"
export function formatRupiah(angka) {
  const n = Number(angka || 0);
  return (n < 0 ? "−Rp " : "Rp ") + Math.abs(n).toLocaleString("id-ID");
}

// 15000 -> "15.000"
export const ribuan = (n) => Number(n || 0).toLocaleString("id-ID");

// ID dibuat di HP, bukan di server, supaya bisa mencatat saat offline tanpa bentrok dengan HP lain.
export function buatId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  // Cadangan untuk browser lama / halaman non-https
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Nomor HP Indonesia untuk wa.me: "0812-3456" -> "628123456"
export function nomorWhatsApp(telepon) {
  let n = String(telepon || "").replace(/\D/g, "");
  if (n.startsWith("0")) n = "62" + n.slice(1);
  else if (n.startsWith("8")) n = "62" + n;
  return n;
}

// Bandingkan nama tanpa peduli huruf besar/kecil dan spasi berlebih
export const kunciNama = (nama) => String(nama || "").trim().replace(/\s+/g, " ").toLowerCase();
