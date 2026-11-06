// ringkasan.js: isi laci, bon, dan stok di akhir setiap hari, disimpan di tabel meta,
// supaya tidak perlu menghitung ulang ribuan catatan setiap kali aplikasi dibuka.
//
// Ini hanya salinan untuk mempercepat: kalau hilang bisa dibangun ulang dari catatan.
// Kalau ada catatan baru atau terhapus di tanggal lama, hitung ulang mulai tanggal itu.
//
// Bentuknya: { "2026-11-04": { laci, bon: { idPelanggan: n }, stok: { idBarang: n } } }
// Hanya tanggal yang punya catatan yang disimpan.

import { db, ambilMeta, aturMeta } from "./db.js";
import { arahStok, tanggalCatatan } from "./hitung.js";
import { hariIni, tanggalDariMs, geserTanggal } from "./tanggal.js";

const KOSONG = { laci: 0, bon: {}, stok: {} };

// ---------- Fungsi murni ----------

// Isi di akhir tanggal itu: ambil tanggal terdekat yang tidak lebih baru
export function isiAkhirHari(ringkasan, tanggal) {
  let terdekat = null;
  for (const t of Object.keys(ringkasan)) {
    if (t <= tanggal && (terdekat === null || t > terdekat)) terdekat = t;
  }
  return terdekat ? ringkasan[terdekat] : KOSONG;
}

// Tambahkan efek satu catatan ke isi (isi diubah langsung)
function terapkan(isi, c) {
  if (c.ke === "laci") isi.laci += c.nominal;
  if (c.dari === "laci") isi.laci -= c.nominal;
  if (c.ke === "bon") isi.bon[c.pelanggan_id] = (isi.bon[c.pelanggan_id] || 0) + c.nominal;
  if (c.dari === "bon") isi.bon[c.pelanggan_id] = (isi.bon[c.pelanggan_id] || 0) - c.nominal;
  const arah = arahStok(c);
  for (const b of c.item || []) {
    if (b.barang_id) isi.stok[b.barang_id] = (isi.stok[b.barang_id] || 0) + arah * b.jumlah;
  }
}

const salin = (isi) => ({ laci: isi.laci, bon: { ...isi.bon }, stok: { ...isi.stok } });

// Hitung ulang mulai tanggal `mulai` sampai `sampai`. Tanggal sebelum `mulai` dipakai apa adanya.
// `catatan` cukup berisi catatan sejak `mulai`.
export function bangunRingkasan(lama, catatan, mulai, sampai) {
  const baru = {};
  for (const [t, isi] of Object.entries(lama)) if (t < mulai) baru[t] = isi;

  const urut = catatan
    .filter((c) => !c.deleted && tanggalCatatan(c) >= mulai && tanggalCatatan(c) <= sampai)
    .sort((a, b) => a.waktu - b.waktu);

  const isi = salin(isiAkhirHari(baru, geserTanggal(mulai, -1)));
  for (const c of urut) {
    terapkan(isi, c);
    baru[tanggalCatatan(c)] = salin(isi);
  }
  return baru;
}

// Isi akhir tanggal `sampai` ditambah catatan sesudahnya
export function isiSampai(ringkasan, catatanSesudah, tanggal) {
  const isi = salin(isiAkhirHari(ringkasan, tanggal));
  for (const c of catatanSesudah) if (!c.deleted) terapkan(isi, c);
  return isi;
}

// ---------- Penyimpanan ----------

const AWAL = "1970-01-01";

const catatanSejak = (tanggal) => {
  const [t, b, h] = tanggal.split("-").map(Number);
  return db.catatan.where("waktu").aboveOrEqual(new Date(t, b - 1, h).getTime()).toArray();
};

// Panggil setiap ada catatan baru atau terhapus. Boleh di dalam transaksi yang memuat tabel meta.
export async function tandaiBerubah(waktu) {
  const tanggal = tanggalDariMs(waktu);
  const mulai = await ambilMeta("ringkasan_ulang");
  if (!mulai || tanggal < mulai) await aturMeta("ringkasan_ulang", tanggal);
}

// Isi laci, bon, dan stok sekarang. Hari yang sudah lewat diambil dari ringkasan,
// hari ini dihitung dari catatan hari ini.
// Fungsi ini menulis ke tabel meta, jadi jangan dipanggil di dalam useLiveQuery.
export async function isiSekarang() {
  const kemarin = geserTanggal(hariIni(), -1);
  let ringkasan = (await ambilMeta("ringkasan")) || {};
  const sampai = (await ambilMeta("ringkasan_sampai")) || AWAL;
  const ulang = await ambilMeta("ringkasan_ulang");

  // Mulai dari yang paling awal: perubahan di tanggal lama, atau hari yang belum masuk ringkasan
  const belumMasuk = geserTanggal(sampai, 1);
  const mulai = ulang && ulang < belumMasuk ? ulang : belumMasuk;
  if (mulai <= kemarin) {
    ringkasan = bangunRingkasan(ringkasan, await catatanSejak(mulai), mulai, kemarin);
    await aturMeta("ringkasan", ringkasan);
    await aturMeta("ringkasan_sampai", kemarin);
  }
  // Perubahan yang hanya mengenai hari ini tidak perlu disimpan di ringkasan
  if (ulang) await db.meta.delete("ringkasan_ulang");

  return isiSampai(ringkasan, await catatanSejak(hariIni()), kemarin);
}
