// format.js: format angka, nomor HP, dan pembuat ID.

export function formatRupiah(angka) {
  return "Rp " + Number(angka || 0).toLocaleString("id-ID");
}

// Nomor HP Indonesia untuk wa.me: "0812-3456" -> "628123456"
export function nomorWhatsApp(telepon) {
  let n = String(telepon || "").replace(/\D/g, "");
  if (n.startsWith("0")) n = "62" + n.slice(1);
  else if (n.startsWith("8")) n = "62" + n;
  return n;
}

// ID unik (UUID). Dibuat di HP, bukan di server, supaya data bisa dibuat saat offline
// lalu dikirim belakangan tanpa bentrok dengan data dari HP lain.
export function buatId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  // Cadangan untuk browser lama / halaman non-https
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Bandingkan nama tanpa peduli huruf besar/kecil dan spasi berlebih
export function kunciNama(nama) {
  return String(nama || "").trim().replace(/\s+/g, " ").toLowerCase();
}
