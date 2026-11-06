// tanggal.js: semua urusan tanggal memakai waktu LOKAL dalam format teks "YYYY-MM-DD".
// Teks seperti ini bisa dibandingkan langsung dengan < dan >. Jangan pakai toISOString():
// itu waktu UTC, jadi dini hari di Indonesia tanggalnya bisa mundur sehari.

export function formatTanggal(d) {
  const bulan = String(d.getMonth() + 1).padStart(2, "0");
  const tgl = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${bulan}-${tgl}`;
}

export const hariIni = () => formatTanggal(new Date());
export const tanggalDariMs = (ms) => formatTanggal(new Date(ms));

function keDate(teks) {
  const [tahun, bulan, tgl] = teks.split("-").map(Number);
  return new Date(tahun, bulan - 1, tgl);
}

// Geser sebanyak `selisih` hari (boleh negatif)
export function geserTanggal(teks, selisih) {
  const d = keDate(teks);
  d.setDate(d.getDate() + selisih);
  return formatTanggal(d);
}

// Senin dari minggu tanggal itu
export function awalMinggu(teks) {
  const d = keDate(teks);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Minggu=0 -> mundur 6 hari
  return formatTanggal(d);
}

// "2026-11-05" -> "Kamis, 5 Nov"
export const labelTanggal = (teks) => keDate(teks).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short" });
// "2026-11-05" -> "5 Nov"
export const labelTanggalPendek = (teks) => keDate(teks).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
// "2026-10-15" -> "Oktober 2026"
export const labelBulan = (teks) => keDate(teks).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
// "2026-09-01" -> "Sep"
export const namaBulanPendek = (teks) => keDate(teks).toLocaleDateString("id-ID", { month: "short" });
// Milidetik -> "09.30"
export const jamDariMs = (ms) => new Date(ms).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

export const awalBulan = (teks) => teks.slice(0, 8) + "01";

export function akhirBulan(teks) {
  const d = keDate(awalBulan(teks));
  return formatTanggal(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

// Tanggal 1 dari bulan yang digeser sebanyak `selisih`
export function geserBulan(teks, selisih) {
  const d = keDate(awalBulan(teks));
  return formatTanggal(new Date(d.getFullYear(), d.getMonth() + selisih, 1));
}
