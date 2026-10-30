// repo.js: semua aksi bisnis Buku Warung. Halaman tidak menulis ke database langsung,
// tapi lewat fungsi di sini, supaya aturan (relasi antar data) ada di satu tempat.
//
// Relasi antar data:
//   barang      ─< stok_mutasi   (stok = jumlah semua mutasinya)
//   pelanggan   ─< kasbon        (sisa = utang - bayar)
//   transaksi  ──  stok_mutasi   (jual tunai: uang masuk + stok berkurang)
//   kasbon     ──  stok_mutasi   (kasbon barang: utang + stok berkurang, tanpa uang masuk)
//   kasbon     ──  transaksi     (bayar kasbon: sisa berkurang + uang masuk)
//   kasbon     ──  transaksi     (pinjam uang tunai: utang bertambah + uang keluar)
// Menghapus satu sisi relasi ikut menghapus pasangannya, supaya angka selalu cocok.

import { semua, ambil, tulis } from "./db.js";
import { hitungStok, hitungSisaKasbon } from "./hitung.js";
import { buatId, kunciNama, formatRupiah } from "../lib/format.js";
import { hariIni } from "../lib/tanggal.js";

function baru(isi) {
  const sekarang = Date.now();
  return { id: buatId(), created_at: sekarang, updated_at: sekarang, deleted: false, ...isi };
}

function diubah(baris, isi) {
  return { ...baris, ...isi, updated_at: Date.now() };
}

const dihapus = (baris) => diubah(baris, { deleted: true });

// Hasil aksi: { galat: "pesan" } kalau ditolak, atau { ...data } kalau berhasil.
const tolak = (galat) => ({ galat });

// ---------- Transaksi (Catat Cepat) ----------

export async function catatTransaksi({ tipe, nominal, catatan }) {
  const t = baru({
    tipe,
    nominal,
    catatan: (catatan || "").trim(),
    tanggal: hariIni(),
    sumber: "manual",
    barang_id: null,
    jumlah: null,
    modal: null,
    kasbon_id: null,
    pelanggan_id: null,
  });
  await tulis([{ tabel: "transaksi", baris: t }]);
  return { transaksi: t };
}

// Hanya catatan manual yang bisa diubah. Penjualan dan bayaran kasbon terhubung ke data lain,
// jadi dibetulkan dengan menghapus lalu mencatat ulang.
export async function ubahTransaksi(id, { tipe, nominal, catatan }) {
  const t = await ambil("transaksi", id);
  if (!t || t.deleted) return tolak("Catatan tidak ditemukan.");
  if (t.sumber !== "manual") return tolak("Catatan ini terhubung ke stok atau kasbon. Hapus lalu catat ulang.");
  await tulis([{ tabel: "transaksi", baris: diubah(t, { tipe, nominal, catatan: (catatan || "").trim() }) }]);
  return {};
}

export async function hapusTransaksi(id) {
  const t = await ambil("transaksi", id);
  if (!t || t.deleted) return {};
  const perubahan = [{ tabel: "transaksi", baris: dihapus(t) }];

  if (t.sumber === "jual") {
    // Penjualan dihapus: stoknya kembali
    const mutasi = (await semua("stok_mutasi")).filter((m) => m.ref_id === t.id);
    mutasi.forEach((m) => perubahan.push({ tabel: "stok_mutasi", baris: dihapus(m) }));
  }
  if (t.sumber === "bayar_kasbon" && t.kasbon_id) {
    // Uang bayaran dihapus: catatan bayar di kasbon ikut terhapus, sisa utang naik lagi
    const k = await ambil("kasbon", t.kasbon_id);
    if (k && !k.deleted) perubahan.push({ tabel: "kasbon", baris: dihapus(k) });
  }
  if (t.sumber === "pinjam_kasbon" && t.kasbon_id) {
    // Uang pinjaman dihapus: utangnya ikut terhapus, kecuali sudah ada yang dibayar
    const k = await ambil("kasbon", t.kasbon_id);
    if (k && !k.deleted) {
      if (await sisaJadiMinus(k)) return tolak("Pinjaman ini sudah dibayar sebagian. Hapus dulu catatan bayarnya di halaman Kasbon.");
      perubahan.push({ tabel: "kasbon", baris: dihapus(k) });
    }
  }
  await tulis(perubahan);
  return {};
}

// ---------- Barang & stok ----------

export async function daftarBarang() {
  const [barang, mutasi] = await Promise.all([semua("barang"), semua("stok_mutasi")]);
  const stok = hitungStok(mutasi);
  return barang.map((b) => ({ ...b, stok: stok.get(b.id) || 0 }));
}

async function stokBarang(barangId) {
  const mutasi = (await semua("stok_mutasi")).filter((m) => m.barang_id === barangId);
  return hitungStok(mutasi).get(barangId) || 0;
}

function mutasiBaru(barangId, jumlah, alasan, refId = null) {
  return baru({ barang_id: barangId, jumlah, alasan, ref_id: refId, tanggal: hariIni() });
}

export async function tambahBarang({ nama, stok, harga_jual, harga_beli }) {
  nama = (nama || "").trim();
  if (!nama) return tolak("Isi nama barang dulu.");
  const ada = (await semua("barang")).some((b) => kunciNama(b.nama) === kunciNama(nama));
  if (ada) return tolak(`"${nama}" sudah ada di daftar.`);

  const b = baru({ nama, harga_jual: harga_jual || 0, harga_beli: harga_beli || 0 });
  const perubahan = [{ tabel: "barang", baris: b }];
  if (stok > 0) perubahan.push({ tabel: "stok_mutasi", baris: mutasiBaru(b.id, stok, "awal") });
  await tulis(perubahan);
  return { barang: b };
}

export async function ubahHargaBarang(id, { harga_jual, harga_beli }) {
  const b = await ambil("barang", id);
  if (!b || b.deleted) return tolak("Barang tidak ditemukan.");
  await tulis([{ tabel: "barang", baris: diubah(b, { harga_jual: harga_jual || 0, harga_beli: harga_beli || 0 }) }]);
  return {};
}

// Tombol + dan − : koreksi stok tanpa uang (barang datang, rusak, dipakai sendiri, ...)
export async function ubahStok(id, selisih) {
  if (selisih < 0 && (await stokBarang(id)) + selisih < 0) return tolak("Stok sudah 0.");
  await tulis([{ tabel: "stok_mutasi", baris: mutasiBaru(id, selisih, selisih > 0 ? "tambah" : "kurang") }]);
  return {};
}

export async function hapusBarang(id) {
  const b = await ambil("barang", id);
  if (b && !b.deleted) await tulis([{ tabel: "barang", baris: dihapus(b) }]);
  return {};
}

async function cekBisaJual(barangId, jumlah) {
  const b = await ambil("barang", barangId);
  if (!b || b.deleted) return { galat: "Barang tidak ditemukan." };
  if (!b.harga_jual) return { galat: "Isi harga jual dulu lewat Ubah harga." };
  if (!(jumlah >= 1)) return { galat: "Isi jumlah minimal 1." };
  const stok = await stokBarang(barangId);
  if (jumlah > stok) return { galat: `Stok tinggal ${stok}.` };
  return { b };
}

// Jual tunai: uang masuk + stok berkurang
export async function jualTunai(barangId, jumlah) {
  const { galat, b } = await cekBisaJual(barangId, jumlah);
  if (galat) return tolak(galat);

  const t = baru({
    tipe: "masuk",
    nominal: b.harga_jual * jumlah,
    catatan: `Jual ${jumlah} ${b.nama}`,
    tanggal: hariIni(),
    sumber: "jual",
    barang_id: b.id,
    jumlah,
    modal: b.harga_beli ? b.harga_beli * jumlah : null,
    kasbon_id: null,
    pelanggan_id: null,
  });
  await tulis([
    { tabel: "transaksi", baris: t },
    { tabel: "stok_mutasi", baris: mutasiBaru(b.id, -jumlah, "jual", t.id) },
  ]);
  return { transaksi: t };
}

// ---------- Pelanggan & kasbon ----------

export async function daftarPelanggan() {
  const [pelanggan, kasbon] = await Promise.all([semua("pelanggan"), semua("kasbon")]);
  const sisa = hitungSisaKasbon(kasbon);
  return pelanggan.map((p) => ({
    ...p,
    sisa: sisa.get(p.id) || 0,
    kasbon: kasbon.filter((k) => k.pelanggan_id === p.id).sort((a, b) => b.created_at - a.created_at),
  }));
}

// Cari pelanggan dari nama (tidak peduli huruf besar/kecil), atau siapkan yang baru
async function siapkanPelanggan(nama, telepon) {
  const daftar = await semua("pelanggan");
  const ada = daftar.find((p) => kunciNama(p.nama) === kunciNama(nama));
  if (ada) {
    if (telepon && !ada.telepon) return { p: diubah(ada, { telepon: telepon.trim() }), perluDisimpan: true };
    return { p: ada, perluDisimpan: false };
  }
  return { p: baru({ nama: nama.trim().replace(/\s+/g, " "), telepon: (telepon || "").trim() }), perluDisimpan: true };
}

// Kalau utang ini dihapus, apakah sisa pelanggan jadi minus (karena sudah dibayar)?
// Pelanggan yang sudah dihapus tidak dicek lagi: kasbonnya sudah tidak tampil di mana pun,
// jadi catatan uangnya harus tetap bisa dihapus.
async function sisaJadiMinus(k) {
  const p = await ambil("pelanggan", k.pelanggan_id);
  if (!p || p.deleted) return false;
  const lain = (await semua("kasbon")).filter((x) => x.id !== k.id);
  return (hitungSisaKasbon(lain).get(k.pelanggan_id) || 0) < 0;
}

// Catat utang. Tiga jenis:
//   barang : barang dari daftar stok -> stok berkurang, nominal dari harga jual
//   lain   : barang di luar daftar stok (gorengan, pulsa, ...) -> nominal diisi manual
//   tunai  : pinjam uang dari laci -> ikut tercatat sebagai uang keluar
// Dua jenis pertama tidak mengubah Total, karena uangnya memang belum masuk.
export async function catatUtang({ nama, nominal, catatan, telepon, barangId, jumlah, jenis }) {
  nama = (nama || "").trim();
  if (!nama) return tolak("Isi nama pelanggan dulu.");
  jenis = barangId ? "barang" : jenis === "tunai" ? "tunai" : "lain";

  const perubahan = [];
  let isi;
  if (barangId) {
    const { galat, b } = await cekBisaJual(barangId, jumlah);
    if (galat) return tolak(galat);
    isi = {
      nominal: b.harga_jual * jumlah,
      catatan: (catatan || "").trim() || `${jumlah} ${b.nama}`,
      barang_id: b.id,
      jumlah,
      modal: b.harga_beli ? b.harga_beli * jumlah : null,
    };
  } else {
    if (!(nominal > 0)) return tolak("Isi jumlah utang lebih dari 0.");
    isi = { nominal, catatan: (catatan || "").trim(), barang_id: null, jumlah: null, modal: null };
  }

  const { p, perluDisimpan } = await siapkanPelanggan(nama, telepon);
  if (perluDisimpan) perubahan.push({ tabel: "pelanggan", baris: p });

  const k = baru({ pelanggan_id: p.id, tipe: "utang", jenis, tanggal: hariIni(), transaksi_id: null, ...isi });
  perubahan.push({ tabel: "kasbon", baris: k });
  if (barangId) perubahan.push({ tabel: "stok_mutasi", baris: mutasiBaru(barangId, -jumlah, "kasbon", k.id) });
  if (jenis === "tunai") {
    // Uang keluar dari laci, terhubung ke utangnya
    const t = baru({
      tipe: "keluar",
      nominal: k.nominal,
      catatan: "Pinjaman kasbon: " + p.nama,
      tanggal: hariIni(),
      sumber: "pinjam_kasbon",
      barang_id: null,
      jumlah: null,
      modal: null,
      kasbon_id: k.id,
      pelanggan_id: p.id,
    });
    k.transaksi_id = t.id;
    perubahan.push({ tabel: "transaksi", baris: t });
  }

  await tulis(perubahan);
  return { kasbon: k, pelanggan: p };
}

// Terima bayaran kasbon. Kalau catatKas true, bayaran juga tercatat sebagai uang masuk
// dan keduanya saling terhubung.
export async function terimaBayar(pelangganId, { nominal, catatan, catatKas = true }) {
  const p = await ambil("pelanggan", pelangganId);
  if (!p || p.deleted) return tolak("Pelanggan tidak ditemukan.");
  if (!(nominal > 0)) return tolak("Isi jumlahnya dulu.");
  const sisa = hitungSisaKasbon(await semua("kasbon")).get(p.id) || 0;
  if (nominal > sisa) return tolak(`Melebihi sisa utang (${formatRupiah(sisa)}).`);

  const k = baru({
    pelanggan_id: p.id,
    tipe: "bayar",
    jenis: null,
    nominal,
    catatan: (catatan || "").trim(),
    tanggal: hariIni(),
    barang_id: null,
    jumlah: null,
    modal: null,
    transaksi_id: null,
  });
  const perubahan = [];
  if (catatKas) {
    const t = baru({
      tipe: "masuk",
      nominal,
      catatan: "Bayar kasbon: " + p.nama,
      tanggal: hariIni(),
      sumber: "bayar_kasbon",
      barang_id: null,
      jumlah: null,
      modal: null,
      kasbon_id: k.id,
      pelanggan_id: p.id,
    });
    k.transaksi_id = t.id;
    perubahan.push({ tabel: "transaksi", baris: t });
  }
  perubahan.unshift({ tabel: "kasbon", baris: k });
  await tulis(perubahan);
  return { kasbon: k };
}

export async function hapusKasbon(id) {
  const k = await ambil("kasbon", id);
  if (!k || k.deleted) return {};

  // Jangan sampai sisa jadi minus (bayaran lebih besar dari utang)
  if (k.tipe === "utang" && (await sisaJadiMinus(k))) return tolak("Hapus dulu catatan bayarnya, karena utang ini sudah dibayar.");

  const perubahan = [{ tabel: "kasbon", baris: dihapus(k) }];
  if (k.tipe === "utang" && k.barang_id) {
    // Kasbon barang dihapus: stoknya kembali
    (await semua("stok_mutasi"))
      .filter((m) => m.ref_id === k.id)
      .forEach((m) => perubahan.push({ tabel: "stok_mutasi", baris: dihapus(m) }));
  }
  if (k.transaksi_id) {
    // Bayaran dihapus: uang masuknya ikut terhapus. Pinjaman tunai dihapus: uang keluarnya ikut terhapus.
    const t = await ambil("transaksi", k.transaksi_id);
    if (t && !t.deleted) perubahan.push({ tabel: "transaksi", baris: dihapus(t) });
  }
  await tulis(perubahan);
  return {};
}

// Pelanggan hanya bisa dihapus kalau sudah lunas. Uang yang pernah dibayar
// tetap ada di catatan keuangan, karena uangnya memang sudah diterima.
export async function hapusPelanggan(id) {
  const p = await ambil("pelanggan", id);
  if (!p || p.deleted) return {};
  const kasbon = (await semua("kasbon")).filter((k) => k.pelanggan_id === id);
  const sisa = hitungSisaKasbon(kasbon).get(id) || 0;
  if (sisa > 0) return tolak(`Masih ada utang ${formatRupiah(sisa)}. Lunasi atau hapus catatan utangnya dulu.`);
  // Catatan kasbonnya sengaja tidak ikut dihapus: Ringkasan tetap menghitung untung dan
  // arus kasbon dari masa lalu dengan benar. Pelanggannya saja yang tidak tampil lagi.
  await tulis([{ tabel: "pelanggan", baris: dihapus(p) }]);
  return {};
}

export async function ubahTelepon(id, telepon) {
  const p = await ambil("pelanggan", id);
  if (!p || p.deleted) return tolak("Pelanggan tidak ditemukan.");
  await tulis([{ tabel: "pelanggan", baris: diubah(p, { telepon: (telepon || "").trim() }) }]);
  return {};
}
