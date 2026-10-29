// storage.js: semua urusan baca/tulis data ada di sini.
const KEY_TRANSAKSI = "bw_transaksi";

function ambilData(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch (e) {
    return []; // kalau data rusak, mulai dari kosong
  }
}

function simpanData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// Tanggal lokal format YYYY-MM-DD.
// Jangan pakai toISOString(): itu waktu UTC, jadi dini hari di Indonesia tanggalnya bisa mundur sehari.
function formatTanggal(d) {
  const bulan = String(d.getMonth() + 1).padStart(2, "0");
  const tgl = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${bulan}-${tgl}`;
}

function hariIni() {
  return formatTanggal(new Date());
}

function tambahTransaksi(tipe, nominal, catatan) {
  const data = ambilData(KEY_TRANSAKSI);
  data.push({
    id: Date.now(),
    tipe, // "masuk" atau "keluar"
    nominal: Number(nominal),
    catatan: catatan.trim(),
    tanggal: hariIni(),
    dibuat: Date.now(), // waktu persis pencatatan
  });
  simpanData(KEY_TRANSAKSI, data);
}

function hapusTransaksi(id) {
  const data = ambilData(KEY_TRANSAKSI).filter((t) => t.id !== id);
  simpanData(KEY_TRANSAKSI, data);
}

function formatRupiah(angka) {
  return "Rp " + angka.toLocaleString("id-ID");
}

// ---- Stok barang ----
const KEY_BARANG = "bw_barang";
const BATAS_MENIPIS = 5; // stok di bawah atau sama dengan angka ini ditandai merah

function tambahBarang(nama, stok, harga) {
  const data = ambilData(KEY_BARANG);
  data.push({
    id: Date.now(),
    nama: nama.trim(),
    stok: Number(stok),
    harga: Number(harga) || 0,
    diubah: Date.now(),
  });
  simpanData(KEY_BARANG, data);
}

// selisih bisa +1 atau -1. Stok tidak boleh di bawah 0.
function ubahStok(id, selisih) {
  const data = ambilData(KEY_BARANG).map((b) =>
    b.id === id
      ? { ...b, stok: Math.max(0, b.stok + selisih), diubah: Date.now() }
      : b,
  );
  simpanData(KEY_BARANG, data);
}

function hapusBarang(id) {
  const data = ambilData(KEY_BARANG).filter((b) => b.id !== id);
  simpanData(KEY_BARANG, data);
}

// ---- Format tanggal dan waktu (bahasa Indonesia) ----
function formatWaktuLengkap(ms) {
  return new Date(ms).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// "2026-10-29" -> "29 Okt 2026"
function formatTanggalPanjang(teks) {
  const [tahun, bulan, tgl] = teks.split("-").map(Number);
  return new Date(tahun, bulan - 1, tgl).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Catatan lama (sebelum ada jam) hanya punya tanggal, jadi tampilkan tanggalnya saja.
function labelWaktuTransaksi(t) {
  return t.dibuat
    ? formatWaktuLengkap(t.dibuat)
    : formatTanggalPanjang(t.tanggal);
}
