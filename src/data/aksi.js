// aksi.js: semua yang bisa dilakukan pengguna. Halaman memanggil fungsi di sini,
// bukan menulis ke database sendiri.
//
// Setiap aksi hanya MENAMBAH satu catatan (atau mengubah barang/pelanggan).
// Tidak ada angka stok atau utang yang disimpan, jadi tidak ada yang perlu "dibetulkan"
// saat sebuah catatan dihapus: angkanya otomatis dihitung ulang dari catatan yang tersisa.
//
// Setiap fungsi mengembalikan { galat: "pesan" } kalau ditolak, atau data kalau berhasil.

import { semua, ambil, simpan } from "./db.js";
import { hitungStok, hitungUtang } from "./hitung.js";
import { buatId, kunciNama, formatRupiah } from "../lib/format.js";
import { hariIni } from "../lib/tanggal.js";

const tolak = (galat) => ({ galat });

function baru(isi) {
  const sekarang = Date.now();
  return { id: buatId(), created_at: sekarang, updated_at: sekarang, deleted: false, ...isi };
}

const ubah = (baris, isi) => ({ ...baris, ...isi, updated_at: Date.now() });

function catatanBaru(isi) {
  return baru({
    jenis: null,
    tanggal: hariIni(),
    nominal: 0,
    dibayar: null,
    untuk: null,
    pelanggan_id: null,
    barang: [],
    keterangan: "",
    ...isi,
  });
}

// ---------- Membaca ----------

export async function daftarBarang() {
  const [barang, catatan] = await Promise.all([semua("barang"), semua("catatan")]);
  const stok = hitungStok(catatan);
  return barang.map((b) => ({ ...b, stok: stok.get(b.id) || 0 })).sort((a, b) => a.nama.localeCompare(b.nama));
}

export async function daftarPelanggan() {
  const [pelanggan, catatan] = await Promise.all([semua("pelanggan"), semua("catatan")]);
  const utang = hitungUtang(catatan);
  return pelanggan.map((p) => ({ ...p, utang: utang.get(p.id) || 0 }));
}

// Cari pelanggan dari nama (huruf besar/kecil tidak dibedakan), atau buat baru
async function siapkanPelanggan(nama) {
  nama = (nama || "").trim().replace(/\s+/g, " ");
  if (!nama) return { galat: "Tulis nama pelanggannya." };
  const ada = (await semua("pelanggan")).find((p) => kunciNama(p.nama) === kunciNama(nama));
  if (ada) return { pelanggan: ada, baru: false };
  return { pelanggan: baru({ nama, telepon: "" }), baru: true };
}

// ---------- Jual ----------
// pilihan = [{ barang_id, jumlah }]; lainnya = nominal untuk barang di luar daftar (gorengan, pulsa)
export async function catatJual({ pilihan = [], lainnya = 0, keterangan = "", dibayar = "sekarang", namaPelanggan = "" }) {
  const barang = new Map((await daftarBarang()).map((b) => [b.id, b]));
  const isi = [];
  for (const p of pilihan.filter((p) => p.jumlah > 0)) {
    const b = barang.get(p.barang_id);
    if (!b) return tolak("Barang tidak ditemukan.");
    if (!b.harga_jual) return tolak(`Harga jual ${b.nama} belum diisi. Isi dulu di halaman Barang.`);
    if (p.jumlah > b.stok) return tolak(`Stok ${b.nama} tinggal ${b.stok}.`);
    isi.push({ barang_id: b.id, nama: b.nama, jumlah: p.jumlah, harga: b.harga_jual, modal: b.harga_beli || null });
  }
  const nominal = isi.reduce((n, b) => n + b.harga * b.jumlah, 0) + (lainnya || 0);
  if (nominal <= 0) return tolak("Pilih barang atau isi nominal dulu.");

  const perubahan = [];
  let pelangganId = null;
  if (dibayar === "nanti") {
    const h = await siapkanPelanggan(namaPelanggan);
    if (h.galat) return h;
    if (h.baru) perubahan.push({ tabel: "pelanggan", baris: h.pelanggan });
    pelangganId = h.pelanggan.id;
  }
  const c = catatanBaru({ jenis: "jual", nominal, dibayar, pelanggan_id: pelangganId, barang: isi, keterangan: keterangan.trim() });
  perubahan.push({ tabel: "catatan", baris: c });
  await simpan(perubahan);
  return { catatan: c };
}

// ---------- Uang keluar ----------
// untuk: "belanja" (stok bertambah), "biaya" (listrik, plastik), "pinjaman" (utang pelanggan bertambah)
export async function catatKeluar({ nominal, untuk, barangId, jumlah, namaPelanggan, keterangan = "" }) {
  if (!(nominal > 0)) return tolak("Isi jumlah uangnya dulu.");
  const perubahan = [];
  const isi = { jenis: "keluar", nominal, untuk, keterangan: keterangan.trim() };

  if (untuk === "belanja") {
    const b = await ambil("barang", barangId);
    if (!b || b.deleted) return tolak("Pilih barang yang dibeli.");
    if (!(jumlah > 0)) return tolak("Isi jumlah barang yang dibeli.");
    const hargaSatuan = Math.round(nominal / jumlah);
    isi.barang = [{ barang_id: b.id, nama: b.nama, jumlah, harga: hargaSatuan }];
    // Harga beli (modal) barang diperbarui ke harga belanja terakhir, supaya untung tetap akurat
    if (b.harga_beli !== hargaSatuan) perubahan.push({ tabel: "barang", baris: ubah(b, { harga_beli: hargaSatuan }) });
  } else if (untuk === "pinjaman") {
    const h = await siapkanPelanggan(namaPelanggan);
    if (h.galat) return h;
    if (h.baru) perubahan.push({ tabel: "pelanggan", baris: h.pelanggan });
    isi.pelanggan_id = h.pelanggan.id;
  } else {
    isi.untuk = "biaya";
  }
  const c = catatanBaru(isi);
  perubahan.push({ tabel: "catatan", baris: c });
  await simpan(perubahan);
  return { catatan: c };
}

// ---------- Terima bayar ----------
export async function catatBayar({ pelangganId, nominal }) {
  const p = await ambil("pelanggan", pelangganId);
  if (!p || p.deleted) return tolak("Pilih pelanggan yang membayar.");
  if (!(nominal > 0)) return tolak("Isi jumlah yang dibayar.");
  const utang = hitungUtang(await semua("catatan")).get(p.id) || 0;
  if (nominal > utang) return tolak(`Utang ${p.nama} tinggal ${formatRupiah(utang)}.`);
  const c = catatanBaru({ jenis: "bayar", nominal, pelanggan_id: p.id });
  await simpan([{ tabel: "catatan", baris: c }]);
  return { catatan: c };
}

// ---------- Menghapus catatan ----------
// Ditolak kalau hasilnya tidak masuk akal: stok jadi minus, atau utang jadi minus
// (misalnya menghapus utang yang sudah dibayar).
export async function hapusCatatan(id) {
  const c = await ambil("catatan", id);
  if (!c || c.deleted) return {};
  const sisa = (await semua("catatan")).filter((x) => x.id !== id);

  const stok = hitungStok(sisa);
  for (const b of c.barang || []) {
    if (b.barang_id && (stok.get(b.barang_id) || 0) < 0) return tolak(`Stok ${b.nama} akan jadi minus. Hapus dulu penjualan ${b.nama} yang lebih baru.`);
  }
  if (c.pelanggan_id && (hitungUtang(sisa).get(c.pelanggan_id) || 0) < 0) {
    return tolak("Utang ini sudah dibayar. Hapus dulu catatan bayarnya.");
  }
  await simpan([{ tabel: "catatan", baris: ubah(c, { deleted: true }) }]);
  return {};
}

// ---------- Barang ----------
export async function simpanBarang({ id, nama, harga_jual, harga_beli, stokAwal = 0 }) {
  nama = (nama || "").trim();
  if (!nama) return tolak("Tulis nama barangnya.");
  const lain = (await semua("barang")).find((b) => b.id !== id && kunciNama(b.nama) === kunciNama(nama));
  if (lain) return tolak(`"${nama}" sudah ada di daftar.`);

  if (id) {
    const b = await ambil("barang", id);
    if (!b || b.deleted) return tolak("Barang tidak ditemukan.");
    await simpan([{ tabel: "barang", baris: ubah(b, { nama, harga_jual: harga_jual || 0, harga_beli: harga_beli || 0 }) }]);
    return {};
  }
  const b = baru({ nama, harga_jual: harga_jual || 0, harga_beli: harga_beli || 0 });
  const perubahan = [{ tabel: "barang", baris: b }];
  if (stokAwal > 0) {
    perubahan.push({ tabel: "catatan", baris: catatanBaru({ jenis: "stok", keterangan: "Stok awal", barang: [{ barang_id: b.id, nama, jumlah: stokAwal }] }) });
  }
  await simpan(perubahan);
  return { barang: b };
}

// Koreksi stok: pengguna mengetik stok yang sebenarnya, selisihnya dicatat
export async function koreksiStok(barangId, stokBenar) {
  const b = (await daftarBarang()).find((x) => x.id === barangId);
  if (!b) return tolak("Barang tidak ditemukan.");
  if (!(stokBenar >= 0)) return tolak("Stok tidak boleh minus.");
  const selisih = stokBenar - b.stok;
  if (!selisih) return {};
  const c = catatanBaru({ jenis: "stok", keterangan: "Koreksi stok", barang: [{ barang_id: b.id, nama: b.nama, jumlah: selisih }] });
  await simpan([{ tabel: "catatan", baris: c }]);
  return { catatan: c };
}

export async function hapusBarang(id) {
  const b = await ambil("barang", id);
  if (b && !b.deleted) await simpan([{ tabel: "barang", baris: ubah(b, { deleted: true }) }]);
  return {};
}

// ---------- Pelanggan ----------
export async function tambahPelanggan(nama, telepon = "") {
  const h = await siapkanPelanggan(nama);
  if (h.galat) return h;
  if (!h.baru) return tolak(`${h.pelanggan.nama} sudah ada.`);
  await simpan([{ tabel: "pelanggan", baris: { ...h.pelanggan, telepon: telepon.trim() } }]);
  return { pelanggan: h.pelanggan };
}

export async function ubahPelanggan(id, { nama, telepon }) {
  const p = await ambil("pelanggan", id);
  if (!p || p.deleted) return tolak("Pelanggan tidak ditemukan.");
  nama = (nama ?? p.nama).trim();
  if (!nama) return tolak("Nama tidak boleh kosong.");
  await simpan([{ tabel: "pelanggan", baris: ubah(p, { nama, telepon: (telepon ?? p.telepon).trim() }) }]);
  return {};
}

// Hanya kalau utangnya sudah lunas. Catatannya tetap ada, karena uangnya memang pernah keluar/masuk.
export async function hapusPelanggan(id) {
  const p = await ambil("pelanggan", id);
  if (!p || p.deleted) return {};
  const utang = hitungUtang(await semua("catatan")).get(id) || 0;
  if (utang > 0) return tolak(`${p.nama} masih punya utang ${formatRupiah(utang)}.`);
  await simpan([{ tabel: "pelanggan", baris: ubah(p, { deleted: true }) }]);
  return {};
}
