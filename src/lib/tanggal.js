// tanggal.js: semua urusan tanggal memakai waktu LOKAL dalam format teks "YYYY-MM-DD".
// Jangan pakai toISOString() untuk tanggal: itu waktu UTC, jadi dini hari di Indonesia
// tanggalnya bisa mundur sehari. Teks "YYYY-MM-DD" bisa dibandingkan langsung dengan < dan >.

export const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

export function formatTanggal(d) {
  const bulan = String(d.getMonth() + 1).padStart(2, "0");
  const tgl = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${bulan}-${tgl}`;
}

export function hariIni() {
  return formatTanggal(new Date());
}

export function tanggalDariMs(ms) {
  return formatTanggal(new Date(ms));
}

function keDate(teks) {
  const [tahun, bulan, tgl] = teks.split("-").map(Number);
  return new Date(tahun, bulan - 1, tgl);
}

// Geser tanggal sebanyak `selisih` hari (boleh negatif).
export function geserTanggal(teks, selisih) {
  const d = keDate(teks);
  d.setDate(d.getDate() + selisih);
  return formatTanggal(d);
}

// Senin minggu ini
export function awalMinggu(teks = hariIni()) {
  const d = keDate(teks);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Minggu=0 -> mundur 6 hari
  return formatTanggal(d);
}

export function awalBulan(teks = hariIni()) {
  return teks.slice(0, 8) + "01";
}

// 1793277839971 -> "29 Okt 2026, 19.46"
export function formatWaktuLengkap(ms) {
  return new Date(ms).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// "2026-10-29" -> "29 Okt 2026"
export function formatTanggalPanjang(teks) {
  return keDate(teks).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// "2026-10-29" -> "Kamis, 29 Oktober 2026"
export function formatTanggalLengkap(teks) {
  return keDate(teks).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
