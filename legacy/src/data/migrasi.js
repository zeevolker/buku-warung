// migrasi.js: pindahkan data dari versi lama ke format v3 (barang, pelanggan, catatan).
//
//   versi 1  data di localStorage (bw_barang, bw_transaksi, bw_kasbon)
//   versi 2  data di IndexedDB (tabel transaksi, kasbon, stok_mutasi)
//
// Dijalankan sekali saat aplikasi dibuka. Data versi 1 di localStorage tidak dihapus,
// supaya masih bisa dipulihkan kalau ada masalah.

import { buatId } from "../lib/format.js";
import { tanggalDariMs } from "../lib/tanggal.js";
import { semuaMentah, simpan, ambilMeta, aturMeta, kosongkanTabelLama } from "./db.js";

const kosong = { dibayar: null, untuk: null, pelanggan_id: null, barang: [], keterangan: "" };

// ---------- Versi 1 -> v3 (fungsi murni) ----------
export function dariV1(lama, idBaru = buatId) {
  const sekarang = Date.now();
  const dasar = (waktu) => ({ id: idBaru(), created_at: waktu || sekarang, updated_at: sekarang, deleted: false });
  const hasil = { barang: [], pelanggan: [], catatan: [] };

  const barangBaru = new Map(); // id lama -> baris baru
  for (const b of lama.barang || []) {
    const baris = { ...dasar(b.id), nama: b.nama, harga_jual: b.harga || 0, harga_beli: b.hargaBeli || 0 };
    barangBaru.set(b.id, baris);
    hasil.barang.push(baris);
  }

  // Bayaran kasbon versi 1 juga tercatat sebagai uang masuk "Bayar kasbon: Nama".
  // Uang masuk itu dilewati, karena catatan "bayar" di bawah sudah menghitungnya.
  const bayaranKasbon = new Set();
  for (const p of lama.kasbon || []) {
    for (const m of p.mutasi || []) if (m.tipe === "bayar") bayaranKasbon.add(`${p.nama}|${m.nominal}|${Math.round((m.dibuat || 0) / 10000)}`);
  }

  const terjual = new Map(); // id barang baru -> jumlah terjual
  for (const t of lama.transaksi || []) {
    const waktu = t.dibuat || t.id;
    const tanggal = t.tanggal || tanggalDariMs(waktu);
    const b = barangBaru.get(t.barangId);
    if (t.tipe === "masuk" && b && t.jumlah) {
      terjual.set(b.id, (terjual.get(b.id) || 0) + t.jumlah);
      const modal = Number.isFinite(t.modal) ? Math.round(t.modal / t.jumlah) : null;
      hasil.catatan.push({ ...dasar(waktu), ...kosong, jenis: "jual", tanggal, nominal: t.nominal, dibayar: "sekarang", barang: [{ barang_id: b.id, nama: b.nama, jumlah: t.jumlah, harga: Math.round(t.nominal / t.jumlah), modal }] });
    } else if (t.tipe === "masuk") {
      const nama = (t.catatan || "").replace("Bayar kasbon: ", "");
      const kunci = `${nama}|${t.nominal}|${Math.round((waktu || 0) / 10000)}`;
      if ((t.catatan || "").startsWith("Bayar kasbon: ") && bayaranKasbon.has(kunci)) continue;
      hasil.catatan.push({ ...dasar(waktu), ...kosong, jenis: "jual", tanggal, nominal: t.nominal, dibayar: "sekarang", keterangan: t.catatan || "" });
    } else {
      hasil.catatan.push({ ...dasar(waktu), ...kosong, jenis: "keluar", tanggal, nominal: t.nominal, untuk: "biaya", keterangan: t.catatan || "" });
    }
  }

  // Versi 1 menyimpan stok akhir. Stok awal = stok akhir + yang sudah terjual.
  for (const [idLama, b] of barangBaru) {
    const lamaB = (lama.barang || []).find((x) => x.id === idLama);
    const awal = (lamaB.stok || 0) + (terjual.get(b.id) || 0);
    if (awal) hasil.catatan.push({ ...dasar(b.created_at), ...kosong, jenis: "stok", tanggal: tanggalDariMs(b.created_at), keterangan: "Stok awal", barang: [{ barang_id: b.id, nama: b.nama, jumlah: awal }] });
  }

  for (const p of lama.kasbon || []) {
    const pel = { ...dasar(p.id), nama: p.nama, telepon: p.telepon || "" };
    hasil.pelanggan.push(pel);
    for (const m of p.mutasi || []) {
      const isi = m.tipe === "utang" ? { jenis: "jual", dibayar: "nanti", keterangan: m.catatan || "" } : { jenis: "bayar" };
      hasil.catatan.push({ ...dasar(m.dibuat), ...kosong, ...isi, tanggal: tanggalDariMs(m.dibuat || sekarang), nominal: m.nominal, pelanggan_id: pel.id });
    }
  }
  return hasil;
}

// ---------- Versi 2 -> v3 (fungsi murni) ----------
// Setiap kejadian versi 2 bisa tersebar di 2-3 tabel (misalnya bayar kasbon = baris kasbon
// + baris transaksi). Di v3 semuanya jadi SATU catatan, memakai id baris utamanya.
export function dariV2({ barang = [], pelanggan = [], transaksi = [], kasbon = [], stok_mutasi = [] }) {
  const ada = (b) => !b.deleted;
  const namaBarang = new Map(barang.map((b) => [b.id, b.nama]));
  const kasbonAda = new Map(kasbon.filter(ada).map((k) => [k.id, k]));
  const pelangganAda = new Set(pelanggan.filter(ada).map((p) => p.id));
  const catatan = [];
  const dasar = (b) => ({ id: b.id, created_at: b.created_at, updated_at: Date.now(), deleted: false, ...kosong, tanggal: b.tanggal });

  for (const t of transaksi.filter(ada)) {
    // Bayar kasbon / pinjaman tunai yang kasbonnya masih ada: diwakili catatan kasbonnya
    if ((t.sumber === "bayar_kasbon" || t.sumber === "pinjam_kasbon") && kasbonAda.has(t.kasbon_id)) continue;
    if (t.sumber === "jual" && t.barang_id && t.jumlah) {
      const modal = t.modal === null || t.modal === undefined ? null : Math.round(t.modal / t.jumlah);
      catatan.push({ ...dasar(t), jenis: "jual", nominal: t.nominal, dibayar: "sekarang", barang: [{ barang_id: t.barang_id, nama: namaBarang.get(t.barang_id) || t.catatan, jumlah: t.jumlah, harga: Math.round(t.nominal / t.jumlah), modal }] });
    } else if (t.tipe === "masuk") {
      if (t.sumber === "bayar_kasbon" && pelangganAda.has(t.pelanggan_id)) catatan.push({ ...dasar(t), jenis: "bayar", nominal: t.nominal, pelanggan_id: t.pelanggan_id });
      else catatan.push({ ...dasar(t), jenis: "jual", nominal: t.nominal, dibayar: "sekarang", keterangan: t.catatan || "" });
    } else {
      catatan.push({ ...dasar(t), jenis: "keluar", nominal: t.nominal, untuk: "biaya", keterangan: t.catatan || "" });
    }
  }

  for (const k of kasbonAda.values()) {
    const jenis = k.tipe === "bayar" ? null : k.jenis || (k.barang_id ? "barang" : "lain");
    if (k.tipe === "bayar") {
      catatan.push({ ...dasar(k), jenis: "bayar", nominal: k.nominal, pelanggan_id: k.pelanggan_id });
    } else if (jenis === "tunai") {
      catatan.push({ ...dasar(k), jenis: "keluar", untuk: "pinjaman", nominal: k.nominal, pelanggan_id: k.pelanggan_id, keterangan: k.catatan || "" });
    } else {
      const isi = jenis === "barang" && k.jumlah
        ? [{ barang_id: k.barang_id, nama: namaBarang.get(k.barang_id) || k.catatan, jumlah: k.jumlah, harga: Math.round(k.nominal / k.jumlah), modal: k.modal === null || k.modal === undefined ? null : Math.round(k.modal / k.jumlah) }]
        : [];
      catatan.push({ ...dasar(k), jenis: "jual", dibayar: "nanti", nominal: k.nominal, pelanggan_id: k.pelanggan_id, barang: isi, keterangan: isi.length ? "" : k.catatan || "" });
    }
  }

  // Pergerakan stok tanpa uang (stok awal, tombol + dan −). Yang karena jual/kasbon sudah ikut di atas.
  for (const m of stok_mutasi.filter(ada)) {
    if (m.alasan === "jual" || m.alasan === "kasbon") continue;
    catatan.push({ ...dasar(m), jenis: "stok", keterangan: m.alasan === "awal" ? "Stok awal" : "Koreksi stok", barang: [{ barang_id: m.barang_id, nama: namaBarang.get(m.barang_id) || "", jumlah: m.jumlah }] });
  }
  return catatan;
}

// ---------- Menjalankan migrasi ----------
function bacaV1() {
  const baca = (k) => {
    try {
      return JSON.parse(localStorage.getItem(k)) || [];
    } catch {
      return [];
    }
  };
  return { barang: baca("bw_barang"), transaksi: baca("bw_transaksi"), kasbon: baca("bw_kasbon") };
}

export async function jalankanMigrasi() {
  if ((await ambilMeta("versi_data")) === 3) return;

  // Versi 2: tabel lama di IndexedDB
  const lama = {};
  for (const t of ["barang", "pelanggan", "transaksi", "kasbon", "stok_mutasi"]) lama[t] = await semuaMentah(t);
  const catatanV2 = dariV2(lama);
  if (catatanV2.length) {
    await simpan(catatanV2.map((baris) => ({ tabel: "catatan", baris })));
  } else if (!localStorage.getItem("bw_migrasi_v2")) {
    // Versi 1: localStorage (hanya kalau belum pernah dipindahkan oleh versi 2)
    const v1 = bacaV1();
    if (v1.barang.length || v1.transaksi.length || v1.kasbon.length) {
      const h = dariV1(v1);
      await simpan([...h.barang.map((baris) => ({ tabel: "barang", baris })), ...h.pelanggan.map((baris) => ({ tabel: "pelanggan", baris })), ...h.catatan.map((baris) => ({ tabel: "catatan", baris }))]);
    }
  }
  localStorage.setItem("bw_migrasi_v2", "1");
  await kosongkanTabelLama();
  await aturMeta("versi_data", 3);
}
