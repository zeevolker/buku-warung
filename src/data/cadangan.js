// cadangan.js: simpan semua data ke file JSON dan pulihkan dari file.
// Tetap berguna walau ada sinkron cloud: untuk pengguna tanpa akun, dan sebagai arsip.

import { TABEL, semuaMentah, tulis } from "./db.js";
import { siapKirim } from "./sync.js";
import { ubahDataLama } from "./migrasi.js";

export async function buatIsiCadangan() {
  const data = {};
  for (const t of TABEL) data[t] = (await semuaMentah(t)).filter((b) => !b.deleted).map(siapKirim);
  return { aplikasi: "buku-warung", versi: 2, dibuat: Date.now(), data };
}

const angka = (n) => Number.isFinite(n);
const teks = (s) => typeof s === "string";

// Periksa isi file. Mengembalikan data versi 2 yang siap dipulihkan, atau null kalau tidak valid.
export function bacaIsiCadangan(o) {
  if (!o || o.aplikasi !== "buku-warung") return null;

  // File dari versi 1 (sebelum IndexedDB): ubah dulu ke format baru
  if (!o.versi || o.versi === 1) {
    if (!Array.isArray(o.transaksi) || !Array.isArray(o.barang)) return null;
    if (!o.transaksi.every((t) => ["masuk", "keluar"].includes(t.tipe) && angka(t.nominal))) return null;
    return { dibuat: o.dibuat, data: ubahDataLama({ transaksi: o.transaksi, barang: o.barang, kasbon: o.kasbon || [] }) };
  }

  if (o.versi !== 2 || !o.data) return null;
  const d = o.data;
  for (const t of TABEL) if (!Array.isArray(d[t]) || !d[t].every((b) => teks(b.id))) return null;
  const valid =
    d.transaksi.every((t) => ["masuk", "keluar"].includes(t.tipe) && angka(t.nominal) && teks(t.tanggal)) &&
    d.barang.every((b) => teks(b.nama)) &&
    d.pelanggan.every((p) => teks(p.nama)) &&
    d.stok_mutasi.every((m) => teks(m.barang_id) && angka(m.jumlah)) &&
    d.kasbon.every((k) => ["utang", "bayar"].includes(k.tipe) && angka(k.nominal) && teks(k.pelanggan_id));
  return valid ? { dibuat: o.dibuat, data: d } : null;
}

export function ringkasIsi(data) {
  return `${data.transaksi.length} catatan uang, ${data.barang.length} barang, ${data.pelanggan.length} pelanggan kasbon`;
}

// Ganti semua data di HP ini dengan isi cadangan. Data yang tidak ada di file ditandai terhapus
// (bukan dibuang), dan semuanya diberi waktu baru, supaya pemulihan ini juga menang saat sinkron.
export async function pulihkan(data) {
  const sekarang = Date.now();
  const perubahan = [];
  for (const t of TABEL) {
    const diFile = new Set(data[t].map((b) => b.id));
    for (const b of data[t]) perubahan.push({ tabel: t, baris: { ...b, deleted: false, updated_at: sekarang } });
    for (const b of await semuaMentah(t)) {
      if (!diFile.has(b.id) && !b.deleted) perubahan.push({ tabel: t, baris: { ...b, deleted: true, updated_at: sekarang } });
    }
  }
  await tulis(perubahan);
}
