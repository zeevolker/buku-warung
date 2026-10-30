// migrasi.js: pindahkan data versi 1 (localStorage) ke format baru (IndexedDB).
// Data lama TIDAK dihapus dari localStorage, supaya kalau ada masalah masih bisa dipulihkan.

import { buatId } from "../lib/format.js";
import { tanggalDariMs } from "../lib/tanggal.js";

const KEY_LAMA = { transaksi: "bw_transaksi", barang: "bw_barang", kasbon: "bw_kasbon" };
const KEY_SELESAI = "bw_migrasi_v2";

// Fungsi murni: data lama -> baris-baris baru. Dipakai juga untuk memulihkan file cadangan versi 1.
export function ubahDataLama(lama, idBaru = buatId) {
  const sekarang = Date.now();
  const dasar = (waktu) => ({ id: idBaru(), created_at: waktu, updated_at: sekarang, deleted: false });
  const hasil = { barang: [], pelanggan: [], stok_mutasi: [], kasbon: [], transaksi: [] };

  // Barang
  const idBarang = new Map(); // id lama -> id baru
  for (const b of lama.barang || []) {
    const baris = { ...dasar(b.id || sekarang), nama: b.nama, harga_jual: b.harga || 0, harga_beli: b.hargaBeli || 0 };
    idBarang.set(b.id, baris.id);
    hasil.barang.push(baris);
  }

  // Transaksi
  for (const t of lama.transaksi || []) {
    const waktu = t.dibuat || t.id || sekarang;
    let sumber = "manual";
    if (t.barangId) sumber = "jual";
    else if ((t.catatan || "").startsWith("Bayar kasbon: ")) sumber = "bayar_kasbon";

    const baris = {
      ...dasar(waktu),
      tipe: t.tipe,
      nominal: t.nominal,
      catatan: t.catatan || "",
      tanggal: t.tanggal || tanggalDariMs(waktu),
      sumber: sumber === "jual" && !idBarang.has(t.barangId) ? "manual" : sumber,
      barang_id: idBarang.get(t.barangId) || null,
      jumlah: t.jumlah || null,
      modal: Number.isFinite(t.modal) ? t.modal : null,
      kasbon_id: null,
      pelanggan_id: null,
      _waktuLama: waktu,
    };
    hasil.transaksi.push(baris);
  }

  // Stok: versi lama menyimpan stok akhir. Penjualan lama dibuat jadi mutasi "jual",
  // dan stok awal = stok akhir + yang sudah terjual, supaya hasil akhirnya sama persis
  // dan menghapus penjualan lama tetap mengembalikan stoknya.
  for (const b of lama.barang || []) {
    const idB = idBarang.get(b.id);
    const penjualan = hasil.transaksi.filter((t) => t.sumber === "jual" && t.barang_id === idB);
    const terjual = penjualan.reduce((n, t) => n + (t.jumlah || 0), 0);
    const awal = (b.stok || 0) + terjual;
    if (awal) {
      hasil.stok_mutasi.push({ ...dasar(b.id || sekarang), barang_id: idB, jumlah: awal, alasan: "awal", ref_id: null, tanggal: tanggalDariMs(b.id || sekarang) });
    }
    for (const t of penjualan) {
      hasil.stok_mutasi.push({ ...dasar(t.created_at), barang_id: idB, jumlah: -(t.jumlah || 0), alasan: "jual", ref_id: t.id, tanggal: t.tanggal });
    }
  }

  // Kasbon: satu pelanggan lama berisi daftar mutasi utang/bayar
  for (const p of lama.kasbon || []) {
    const pel = { ...dasar(p.id || sekarang), nama: p.nama, telepon: p.telepon || "" };
    hasil.pelanggan.push(pel);
    for (const m of p.mutasi || []) {
      const waktu = m.dibuat || sekarang;
      const k = {
        ...dasar(waktu),
        pelanggan_id: pel.id,
        tipe: m.tipe,
        nominal: m.nominal,
        catatan: m.catatan || "",
        tanggal: tanggalDariMs(waktu),
        barang_id: null,
        jumlah: null,
        modal: null,
        transaksi_id: null,
      };
      if (m.tipe === "bayar") {
        // Versi lama mencatat uang masuk "Bayar kasbon: Nama" pada saat yang hampir sama. Hubungkan.
        const pasangan = hasil.transaksi.find(
          (t) =>
            t.sumber === "bayar_kasbon" &&
            !t.kasbon_id &&
            t.catatan === "Bayar kasbon: " + p.nama &&
            t.nominal === m.nominal &&
            Math.abs(t._waktuLama - waktu) < 10000
        );
        if (pasangan) {
          k.transaksi_id = pasangan.id;
          pasangan.kasbon_id = k.id;
          pasangan.pelanggan_id = pel.id;
        }
      }
      hasil.kasbon.push(k);
    }
  }

  hasil.transaksi.forEach((t) => delete t._waktuLama);
  return hasil;
}

function bacaLama(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}

// Dijalankan sekali saat aplikasi dibuka. tulisSemua(hasil) menyimpan ke IndexedDB.
export async function jalankanMigrasi({ apakahKosong, tulis }) {
  try {
    if (localStorage.getItem(KEY_SELESAI)) return false;
  } catch {
    return false;
  }
  const lama = { transaksi: bacaLama(KEY_LAMA.transaksi), barang: bacaLama(KEY_LAMA.barang), kasbon: bacaLama(KEY_LAMA.kasbon) };
  const adaData = lama.transaksi.length || lama.barang.length || lama.kasbon.length;

  if (adaData && (await apakahKosong())) {
    const hasil = ubahDataLama(lama);
    const perubahan = [];
    for (const [tabel, daftar] of Object.entries(hasil)) daftar.forEach((baris) => perubahan.push({ tabel, baris }));
    await tulis(perubahan);
  }
  localStorage.setItem(KEY_SELESAI, String(Date.now()));
  return Boolean(adaData);
}
