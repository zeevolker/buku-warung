// db.js: penyimpanan lokal memakai IndexedDB.
//
// Kenapa bukan localStorage lagi?
// - localStorage hanya muat sekitar 5 MB dan semuanya disimpan sebagai satu teks besar.
// - IndexedDB menyimpan baris per baris, muat jauh lebih banyak, dan mendukung transaksi:
//   beberapa perubahan (misalnya catat penjualan + kurangi stok) tersimpan semua atau tidak sama sekali.
//
// Setiap baris punya kolom bersama:
//   id          UUID, dibuat di HP
//   created_at  waktu dibuat (ms)
//   updated_at  waktu terakhir diubah (ms), dipakai untuk menentukan versi terbaru saat sinkron
//   deleted     true kalau dihapus. Baris tidak benar-benar dibuang supaya penghapusan ikut tersinkron
//   dirty       1 kalau belum terkirim ke server (hanya ada di HP, tidak dikirim)

const NAMA_DB = "buku-warung";
const VERSI_DB = 1;

// Urutan ini penting untuk sinkron: induk (barang, pelanggan) dikirim sebelum anaknya.
export const TABEL = ["barang", "pelanggan", "stok_mutasi", "kasbon", "transaksi"];

let janjiDb = null;

function jadiPromise(permintaan) {
  return new Promise((berhasil, gagal) => {
    permintaan.onsuccess = () => berhasil(permintaan.result);
    permintaan.onerror = () => gagal(permintaan.error);
  });
}

function selesai(tx) {
  return new Promise((berhasil, gagal) => {
    tx.oncomplete = () => berhasil();
    tx.onerror = () => gagal(tx.error);
    tx.onabort = () => gagal(tx.error || new Error("Transaksi dibatalkan"));
  });
}

export function bukaDb() {
  if (!janjiDb) {
    janjiDb = new Promise((berhasil, gagal) => {
      const req = indexedDB.open(NAMA_DB, VERSI_DB);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const nama of TABEL) {
          if (!db.objectStoreNames.contains(nama)) db.createObjectStore(nama, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "kunci" });
      };
      req.onsuccess = () => berhasil(req.result);
      req.onerror = () => gagal(req.error);
      req.onblocked = () => gagal(new Error("Database sedang dipakai tab lain. Tutup tab Buku Warung yang lain."));
    });
  }
  return janjiDb;
}

function kabari(sumber) {
  globalThis.dispatchEvent?.(new CustomEvent("bw:data-berubah", { detail: { sumber } }));
}

// Semua baris yang belum dihapus
export async function semua(tabel) {
  return (await semuaMentah(tabel)).filter((b) => !b.deleted);
}

// Termasuk yang sudah dihapus (untuk sinkron dan cadangan)
export async function semuaMentah(tabel) {
  const db = await bukaDb();
  return jadiPromise(db.transaction(tabel).objectStore(tabel).getAll());
}

export async function ambil(tabel, id) {
  const db = await bukaDb();
  return jadiPromise(db.transaction(tabel).objectStore(tabel).get(id));
}

// Simpan beberapa perubahan sekaligus dalam SATU transaksi.
// perubahan: [{ tabel: "transaksi", baris: {...} }, ...]
// Baris ditandai dirty supaya nanti dikirim ke server.
export async function tulis(perubahan) {
  if (perubahan.length === 0) return;
  const db = await bukaDb();
  const nama = [...new Set(perubahan.map((p) => p.tabel))];
  const tx = db.transaction(nama, "readwrite");
  for (const p of perubahan) tx.objectStore(p.tabel).put({ ...p.baris, dirty: 1 });
  await selesai(tx);
  kabari("lokal");
}

// Simpan baris yang datang dari server (tidak ditandai dirty).
// pilih(lokal, server) menentukan apakah baris server dipakai.
export async function gabungDariServer(tabel, daftar, pilih) {
  if (daftar.length === 0) return 0;
  const db = await bukaDb();
  const tx = db.transaction(tabel, "readwrite");
  const toko = tx.objectStore(tabel);
  let dipakai = 0;
  for (const server of daftar) {
    const lokal = await jadiPromise(toko.get(server.id));
    if (pilih(lokal, server)) {
      toko.put({ ...server, dirty: 0 });
      dipakai += 1;
    }
  }
  await selesai(tx);
  if (dipakai) kabari("server");
  return dipakai;
}

// Tandai sudah terkirim, tapi hanya kalau baris belum diubah lagi sejak dikirim
export async function tandaiTerkirim(tabel, daftar) {
  const db = await bukaDb();
  const tx = db.transaction(tabel, "readwrite");
  const toko = tx.objectStore(tabel);
  for (const terkirim of daftar) {
    const sekarang = await jadiPromise(toko.get(terkirim.id));
    if (sekarang && sekarang.updated_at === terkirim.updated_at) toko.put({ ...sekarang, dirty: 0 });
  }
  await selesai(tx);
}

export async function jumlahBelumTerkirim() {
  let n = 0;
  for (const t of TABEL) n += (await semuaMentah(t)).filter((b) => b.dirty).length;
  return n;
}

export async function ambilMeta(kunci) {
  const db = await bukaDb();
  const hasil = await jadiPromise(db.transaction("meta").objectStore("meta").get(kunci));
  return hasil ? hasil.nilai : null;
}

export async function aturMeta(kunci, nilai) {
  const db = await bukaDb();
  const tx = db.transaction("meta", "readwrite");
  tx.objectStore("meta").put({ kunci, nilai });
  await selesai(tx);
}

// Kosongkan semua data di HP ini (dipakai saat keluar akun atau ganti akun)
export async function kosongkanSemua() {
  const db = await bukaDb();
  const tx = db.transaction([...TABEL, "meta"], "readwrite");
  for (const t of [...TABEL, "meta"]) tx.objectStore(t).clear();
  await selesai(tx);
  kabari("lokal");
}

export async function apakahKosong() {
  for (const t of TABEL) if ((await semuaMentah(t)).length) return false;
  return true;
}
