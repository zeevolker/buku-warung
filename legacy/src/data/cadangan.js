// cadangan.js: simpan semua data ke satu file JSON, dan pulihkan dari file itu.

import { TABEL, semuaMentah, simpan } from "./db.js";
import { siapKirim } from "./sync.js";
import { dariV1, dariV2 } from "./migrasi.js";

export async function buatIsiCadangan() {
  const data = {};
  for (const t of TABEL) data[t] = (await semuaMentah(t)).filter((b) => !b.deleted).map(siapKirim);
  return { aplikasi: "buku-warung", versi: 3, dibuat: Date.now(), data };
}

const teks = (s) => typeof s === "string";
const angka = (n) => Number.isFinite(n);

// Baca isi file. Mengembalikan { dibuat, data: { barang, pelanggan, catatan } } atau null kalau tidak valid.
// File dari versi 1 dan 2 juga diterima dan diubah otomatis.
export function bacaIsiCadangan(o) {
  if (!o || o.aplikasi !== "buku-warung") return null;

  if (!o.versi || o.versi === 1) {
    if (!Array.isArray(o.transaksi) || !Array.isArray(o.barang)) return null;
    return { dibuat: o.dibuat, data: dariV1({ transaksi: o.transaksi, barang: o.barang, kasbon: o.kasbon || [] }) };
  }
  if (o.versi === 2 && o.data && Array.isArray(o.data.barang)) {
    return { dibuat: o.dibuat, data: { barang: o.data.barang, pelanggan: o.data.pelanggan || [], catatan: dariV2(o.data) } };
  }
  if (o.versi !== 3 || !o.data) return null;

  const d = o.data;
  if (!TABEL.every((t) => Array.isArray(d[t]) && d[t].every((b) => teks(b.id)))) return null;
  const valid =
    d.barang.every((b) => teks(b.nama)) &&
    d.pelanggan.every((p) => teks(p.nama)) &&
    d.catatan.every((c) => ["jual", "keluar", "bayar", "stok"].includes(c.jenis) && angka(c.nominal) && teks(c.tanggal) && Array.isArray(c.barang));
  return valid ? { dibuat: o.dibuat, data: d } : null;
}

export function ringkasIsi(d) {
  return `${d.catatan.length} catatan, ${d.barang.length} barang, ${d.pelanggan.length} pelanggan`;
}

// Ganti semua data dengan isi cadangan. Yang tidak ada di file ditandai terhapus, dan semua diberi
// waktu baru, supaya pemulihan ini juga berlaku di cloud dan HP lain saat sinkron.
export async function pulihkan(data) {
  const sekarang = Date.now();
  const perubahan = [];
  for (const t of TABEL) {
    const diFile = new Set(data[t].map((b) => b.id));
    for (const b of data[t]) perubahan.push({ tabel: t, baris: { ...b, deleted: false, updated_at: sekarang } });
    for (const b of await semuaMentah(t)) if (!diFile.has(b.id) && !b.deleted) perubahan.push({ tabel: t, baris: { ...b, deleted: true, updated_at: sekarang } });
  }
  await simpan(perubahan);
}
