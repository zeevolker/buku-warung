// cadangan.js: simpan semua data ke satu file, dan pulihkan dari file itu.
// File dari versi 1, 2, dan 3 juga bisa dibaca dan diubah otomatis.

import { db, ambilMeta, aturMeta } from "./db.js";
import { TABEL } from "./sync.js";
import { dataDariV3 } from "./migrasi.js";
import { dariV1, dariV2 } from "./migrasiLama.js";

const teks = (s) => typeof s === "string";
const angka = (n) => Number.isFinite(n);
const TEMPAT = ["laci", "bon", "stok", "pembeli", "agen", "biaya", "pemilik", "selisih"];

export async function buatIsiCadangan() {
  const data = {};
  for (const t of TABEL) {
    data[t] = (await db[t].toArray()).filter((b) => !b.deleted).map(({ dirty, ...baris }) => baris);
  }
  return { aplikasi: "buku-warung", versi: 4, dibuat: Date.now(), nama_warung: (await ambilMeta("nama_warung")) || "", data };
}

function validV4(d) {
  if (!TABEL.every((t) => Array.isArray(d[t]) && d[t].every((b) => teks(b.id)))) return false;
  return (
    d.barang.every((b) => teks(b.nama)) &&
    d.pelanggan.every((p) => teks(p.nama)) &&
    d.catatan.every((c) => TEMPAT.includes(c.dari) && TEMPAT.includes(c.ke) && angka(c.nominal) && angka(c.waktu) && Array.isArray(c.item) && ((c.dari !== "bon" && c.ke !== "bon") || teks(c.pelanggan_id)))
  );
}

const lengkapi = (d) => ({ pengingat: [], memo: [], ...d });

// Membaca isi file. Mengembalikan { dibuat, data, lama, nama_warung } atau null kalau tidak valid.
// lama = true berarti file dari versi sebelumnya, jadi isi laci perlu dicocokkan setelah dipulihkan.
export function bacaIsiCadangan(o) {
  if (!o || o.aplikasi !== "buku-warung") return null;

  if (!o.versi || o.versi === 1) {
    if (!Array.isArray(o.transaksi) || !Array.isArray(o.barang)) return null;
    const v3 = dariV1({ transaksi: o.transaksi, barang: o.barang, kasbon: o.kasbon || [] });
    return { dibuat: o.dibuat, lama: true, data: lengkapi(dataDariV3(v3)) };
  }
  if (o.versi === 2 && o.data && Array.isArray(o.data.barang)) {
    const v3 = { barang: o.data.barang, pelanggan: o.data.pelanggan || [], catatan: dariV2(o.data) };
    return { dibuat: o.dibuat, lama: true, data: lengkapi(dataDariV3(v3)) };
  }
  if (o.versi === 3 && o.data) {
    const d = o.data;
    if (!["barang", "pelanggan", "catatan"].every((t) => Array.isArray(d[t]) && d[t].every((b) => teks(b.id)))) return null;
    if (!d.catatan.every((c) => ["jual", "keluar", "bayar", "stok"].includes(c.jenis) && angka(c.nominal) && teks(c.tanggal) && Array.isArray(c.barang))) return null;
    return { dibuat: o.dibuat, lama: true, data: lengkapi(dataDariV3(d)) };
  }
  if (o.versi === 4 && o.data) {
    const d = lengkapi(o.data);
    return validV4(d) ? { dibuat: o.dibuat, lama: false, nama_warung: o.nama_warung, data: d } : null;
  }
  return null;
}

export const ringkasIsi = (d) => `${d.catatan.length} catatan, ${d.barang.length} barang, ${d.pelanggan.length} pelanggan`;

// Ganti semua data dengan isi cadangan. Yang tidak ada di file ditandai terhapus, dan semua diberi
// waktu baru, supaya pemulihan ini juga berlaku di cloud dan HP lain saat sinkron.
export async function pulihkan({ data, lama, nama_warung }) {
  const sekarang = Date.now();
  await db.transaction("rw", ...TABEL.map((t) => db[t]), db.meta, async () => {
    for (const t of TABEL) {
      const diFile = new Set(data[t].map((b) => b.id));
      for (const b of await db[t].toArray()) {
        if (!diFile.has(b.id) && !b.deleted) await db[t].put({ ...b, deleted: true, updated_at: sekarang, dirty: 1 });
      }
      await db[t].bulkPut(data[t].map((b) => ({ ...b, deleted: Boolean(b.deleted), updated_at: sekarang, dirty: 1 })));
    }
    // Ringkasan harian dibangun ulang dari awal
    for (const kunci of ["ringkasan", "ringkasan_sampai", "ringkasan_ulang"]) await db.meta.delete(kunci);
    await aturMeta("mulai_selesai", 1);
    if (nama_warung) await aturMeta("nama_warung", nama_warung);
    if (lama) await aturMeta("cocokkan_laci", 1);
  });
}
