// db.js: penyimpanan di HP memakai IndexedDB.
//
// Hanya ada 3 tabel:
//   barang     nama, harga jual, harga beli (stok dihitung dari catatan)
//   pelanggan  nama, nomor HP (utang dihitung dari catatan)
//   catatan    setiap kejadian: jual, keluar, bayar, koreksi stok
//
// Kolom yang sama di setiap baris:
//   id          UUID, dibuat di HP supaya bisa mencatat saat offline
//   created_at  waktu dibuat (ms)
//   updated_at  waktu terakhir diubah (ms), untuk memilih versi terbaru saat sinkron
//   deleted     true kalau dihapus (tidak dibuang, supaya penghapusan ikut tersinkron)
//   dirty       1 kalau belum terkirim ke server (hanya ada di HP)

const NAMA_DB = "buku-warung";
const VERSI_DB = 2; // versi 1 = Buku Warung v2 (tabel lama ikut dibaca saat migrasi)

export const TABEL = ["barang", "pelanggan", "catatan"]; // urutan kirim: induk dulu
export const TABEL_LAMA = ["stok_mutasi", "kasbon", "transaksi"];

let janjiDb = null;

const jadiPromise = (req) =>
  new Promise((ok, gagal) => {
    req.onsuccess = () => ok(req.result);
    req.onerror = () => gagal(req.error);
  });

const selesai = (tx) =>
  new Promise((ok, gagal) => {
    tx.oncomplete = () => ok();
    tx.onerror = () => gagal(tx.error);
    tx.onabort = () => gagal(tx.error || new Error("Penyimpanan dibatalkan"));
  });

export function bukaDb() {
  janjiDb ??= new Promise((ok, gagal) => {
    const req = indexedDB.open(NAMA_DB, VERSI_DB);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const nama of [...TABEL, "meta"]) {
        if (!db.objectStoreNames.contains(nama)) db.createObjectStore(nama, { keyPath: nama === "meta" ? "kunci" : "id" });
      }
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => gagal(req.error);
    req.onblocked = () => gagal(new Error("Tutup tab Buku Warung yang lain, lalu muat ulang."));
  });
  return janjiDb;
}

function kabari(sumber) {
  globalThis.dispatchEvent?.(new CustomEvent("bw:data-berubah", { detail: { sumber } }));
}

// Semua baris, termasuk yang sudah dihapus
export async function semuaMentah(tabel) {
  const db = await bukaDb();
  if (!db.objectStoreNames.contains(tabel)) return [];
  return jadiPromise(db.transaction(tabel).objectStore(tabel).getAll());
}

// Baris yang belum dihapus
export async function semua(tabel) {
  return (await semuaMentah(tabel)).filter((b) => !b.deleted);
}

export async function ambil(tabel, id) {
  const db = await bukaDb();
  return jadiPromise(db.transaction(tabel).objectStore(tabel).get(id));
}

// Simpan beberapa baris sekaligus: semua tersimpan atau tidak sama sekali.
// perubahan = [{ tabel, baris }]. Baris ditandai dirty supaya dikirim ke server.
export async function simpan(perubahan) {
  if (!perubahan.length) return;
  const db = await bukaDb();
  const tx = db.transaction([...new Set(perubahan.map((p) => p.tabel))], "readwrite");
  for (const p of perubahan) tx.objectStore(p.tabel).put({ ...p.baris, dirty: 1 });
  await selesai(tx);
  kabari("lokal");
}

// Gabungkan baris dari server. pilih(lokal, server) memutuskan apakah versi server dipakai.
export async function gabungDariServer(tabel, daftar, pilih) {
  if (!daftar.length) return 0;
  const db = await bukaDb();
  const tx = db.transaction(tabel, "readwrite");
  const toko = tx.objectStore(tabel);
  let dipakai = 0;
  for (const server of daftar) {
    const lokal = await jadiPromise(toko.get(server.id));
    if (pilih(lokal, server)) {
      toko.put({ ...server, dirty: 0 });
      dipakai++;
    }
  }
  await selesai(tx);
  if (dipakai) kabari("server");
  return dipakai;
}

// Tandai terkirim, kecuali baris sudah diubah lagi sejak dikirim
export async function tandaiTerkirim(tabel, daftar) {
  const db = await bukaDb();
  const tx = db.transaction(tabel, "readwrite");
  const toko = tx.objectStore(tabel);
  for (const kirim of daftar) {
    const kini = await jadiPromise(toko.get(kirim.id));
    if (kini && kini.updated_at === kirim.updated_at) toko.put({ ...kini, dirty: 0 });
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

// Kosongkan semua data di HP ini (saat keluar akun atau ganti akun)
export async function kosongkanSemua() {
  const db = await bukaDb();
  const nama = [...TABEL, ...TABEL_LAMA, "meta"].filter((t) => db.objectStoreNames.contains(t));
  const tx = db.transaction(nama, "readwrite");
  for (const t of nama) tx.objectStore(t).clear();
  await selesai(tx);
  kabari("lokal");
}

export async function kosongkanTabelLama() {
  const db = await bukaDb();
  const nama = TABEL_LAMA.filter((t) => db.objectStoreNames.contains(t));
  if (!nama.length) return;
  const tx = db.transaction(nama, "readwrite");
  for (const t of nama) tx.objectStore(t).clear();
  await selesai(tx);
}
