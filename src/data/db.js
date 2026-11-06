// db.js: database di HP (IndexedDB lewat Dexie).
//
// Kolom yang sama di semua tabel kecuali meta:
//   created_at, updated_at  waktu dibuat dan terakhir diubah (milidetik)
//   deleted                 hapus lunak, supaya penghapusan ikut terkirim ke HP lain
//   dirty                   1 kalau perlu dikirim ke cloud
//
// Catatan: uang pindah dari `dari` ke `ke`. Isinya salah satu:
//   "laci", "bon", "stok", "pembeli", "agen", "biaya", "pemilik", "selisih"
//   Kalau "bon", pelanggan_id wajib diisi.
//   item = [{ barang_id, nama, jumlah, harga, modal }]
//   modal = harga beli per unit SAAT catatan dibuat, tidak pernah diubah lagi.

import Dexie from "dexie";
import { buatId } from "./format.js";

export const db = new Dexie("buku-warung-v4");

// Yang ditulis di sini hanya kolom yang perlu dicari cepat, bukan semua kolom
db.version(1).stores({
  barang: "id, dirty",
  pelanggan: "id, dirty",
  catatan: "id, waktu, pelanggan_id, dirty",
  pengingat: "id, dirty",
  memo: "id, dirty",
  meta: "kunci",
});

export function barisBaru(isi) {
  const sekarang = Date.now();
  return { id: buatId(), created_at: sekarang, updated_at: sekarang, deleted: false, dirty: 1, ...isi };
}

export const barisDiubah = (baris, isi) => ({ ...baris, ...isi, updated_at: Date.now(), dirty: 1 });

// Semua baris yang belum dihapus
export async function semuaAda(tabel) {
  return (await tabel.toArray()).filter((b) => !b.deleted);
}

export async function ambilMeta(kunci) {
  return (await db.meta.get(kunci))?.nilai ?? null;
}

export const aturMeta = (kunci, nilai) => db.meta.put({ kunci, nilai });
