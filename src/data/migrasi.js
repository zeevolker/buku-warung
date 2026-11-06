// migrasi.js: memindahkan data v3 ke format "dari → ke". Berjalan otomatis sekali,
// untuk data di HP (saat v4 pertama dibuka) dan data di cloud (saat sinkron pertama).
//
// Id, waktu, barang, pelanggan, dan modal dipertahankan apa adanya. v3 tidak pernah mencatat
// uang awal, jadi isi laci hasil pindahan bisa beda dari uang fisik, bahkan minus. Karena itu
// setelah pindah, aplikasi menampilkan sekali lembar "Cocokkan isi laci".

import { db, ambilMeta, aturMeta } from "./db.js";
import { tandaiBerubah } from "./ringkasan.js";
import { dariV1, dariV2 } from "./migrasiLama.js";
import { tanggalDariMs } from "./tanggal.js";

const NAMA_DB_LAMA = "buku-warung";
const PENANDA_SELESAI = "bw4_migrasi_lokal"; // di localStorage, supaya tidak hilang saat keluar akun

// ---------- Fungsi murni ----------

function tujuanCatatan(c, hargaBeli) {
  const b = c.barang?.[0];
  const jumlah = b?.jumlah || 0;
  switch (c.jenis) {
    case "jual":
      return { dari: "pembeli", ke: c.dibayar === "nanti" ? "bon" : "laci" };
    case "keluar":
      return { dari: "laci", ke: c.untuk === "belanja" ? "agen" : c.untuk === "pinjaman" ? "bon" : "biaya" };
    case "bayar":
      return { dari: "bon", ke: "laci" };
    case "stok": {
      // Di v3 koreksi stok tanpa uang. Di v4 dinilai dengan harga beli.
      const harga = hargaBeli(b?.barang_id);
      return {
        ...(jumlah > 0 ? { dari: "pemilik", ke: "stok" } : { dari: "stok", ke: "biaya" }),
        nominal: Math.abs(jumlah) * harga,
        item: b ? [{ ...b, jumlah: Math.abs(jumlah), harga, modal: harga }] : [],
      };
    }
    default:
      return null;
  }
}

// Catatan v3 yang tanggalnya tidak sama dengan created_at (misalnya hasil pindahan versi lama)
// memakai jam 12 siang tanggal itu, supaya tetap masuk laporan hari yang sama.
function waktuCatatan(c) {
  if (!c.tanggal || tanggalDariMs(c.created_at) === c.tanggal) return c.created_at;
  const [t, b, h] = c.tanggal.split("-").map(Number);
  return new Date(t, b - 1, h, 12).getTime();
}

export function catatanDariV3(catatan, barang = []) {
  const harga = new Map(barang.map((b) => [b.id, b.harga_beli || 0]));
  const hargaBeli = (id) => harga.get(id) || 0;
  const hasil = [];
  for (const c of catatan) {
    const tujuan = tujuanCatatan(c, hargaBeli);
    if (!tujuan) continue;
    hasil.push({
      id: c.id,
      created_at: c.created_at,
      updated_at: c.updated_at,
      deleted: Boolean(c.deleted),
      dirty: 1,
      waktu: waktuCatatan(c),
      pelanggan_id: tujuan.dari === "bon" || tujuan.ke === "bon" ? c.pelanggan_id : null,
      nominal: c.nominal || 0,
      item: c.barang || [],
      keterangan: c.keterangan || "",
      ...tujuan,
    });
  }
  return hasil;
}

export function barangDariV3(b, dirty = 0) {
  return { id: b.id, created_at: b.created_at, updated_at: b.updated_at, deleted: Boolean(b.deleted), dirty, nama: b.nama, harga_jual: b.harga_jual || 0, harga_beli: b.harga_beli || 0, batas_hampir_habis: b.batas_hampir_habis ?? 5 };
}

export function pelangganDariV3(p, dirty = 0) {
  return { id: p.id, created_at: p.created_at, updated_at: p.updated_at, deleted: Boolean(p.deleted), dirty, nama: p.nama, no_wa: p.no_wa || p.telepon || "" };
}

// Seluruh data v3 ke format v4
export function dataDariV3({ barang = [], pelanggan = [], catatan = [] }) {
  return {
    barang: barang.map((b) => barangDariV3(b, 1)),
    pelanggan: pelanggan.map((p) => pelangganDariV3(p, 1)),
    catatan: catatanDariV3(catatan, barang),
  };
}

// ---------- Menulis ke database ----------

// Hanya menambah baris yang belum ada, jadi aman kalau terpanggil dua kali
async function tambahYangBelumAda(tabel, daftar) {
  const ada = new Set(await tabel.toCollection().primaryKeys());
  const baru = daftar.filter((b) => !ada.has(b.id));
  if (baru.length) await tabel.bulkAdd(baru);
  return baru;
}

async function tandaiSudahPindah(catatanBaru) {
  if (!catatanBaru.length) return;
  await tandaiBerubah(Math.min(...catatanBaru.map((c) => c.waktu)));
  await aturMeta("cocokkan_laci", 1);
}

// ---------- Data di HP ----------

// Membaca database v3 tanpa membuatnya kalau ternyata belum ada
async function bacaDbLama() {
  if (!globalThis.indexedDB) return null;
  if (indexedDB.databases) {
    const daftar = await indexedDB.databases();
    if (!daftar.some((d) => d.name === NAMA_DB_LAMA)) return null;
  }
  const lama = await new Promise((ok) => {
    const req = indexedDB.open(NAMA_DB_LAMA);
    req.onupgradeneeded = () => req.transaction.abort(); // belum ada: batalkan
    req.onerror = () => ok(null);
    req.onsuccess = () => ok(req.result);
  });
  if (!lama) return null;
  const hasil = {};
  for (const nama of lama.objectStoreNames) {
    hasil[nama] = await new Promise((ok, gagal) => {
      const req = lama.transaction(nama).objectStore(nama).getAll();
      req.onsuccess = () => ok(req.result);
      req.onerror = () => gagal(req.error);
    });
  }
  lama.close();
  return hasil;
}

function bacaLocalStorage(kunci) {
  try {
    return JSON.parse(localStorage.getItem(kunci)) || [];
  } catch {
    return [];
  }
}

// Data v3 di HP. Kalau HP ini belum pernah membuka v3, data versi 1 atau 2 yang dipakai.
function dataLamaDiHp(lama) {
  const dasar = { barang: lama?.barang || [], pelanggan: lama?.pelanggan || [] };
  if (lama?.catatan?.length) return { ...dasar, catatan: lama.catatan };
  const dariDua = lama ? dariV2(lama) : [];
  if (dariDua.length) return { ...dasar, catatan: dariDua };
  if (!localStorage.getItem("bw_migrasi_v2")) {
    const v1 = { barang: bacaLocalStorage("bw_barang"), transaksi: bacaLocalStorage("bw_transaksi"), kasbon: bacaLocalStorage("bw_kasbon") };
    if (v1.barang.length || v1.transaksi.length || v1.kasbon.length) return dariV1(v1);
  }
  return { ...dasar, catatan: [] };
}

export const sudahPindahLokal = () => Boolean(localStorage.getItem(PENANDA_SELESAI));

// Mengembalikan jumlah catatan yang dipindahkan
export async function pindahkanDataHp() {
  if (sudahPindahLokal()) return 0;
  const lama = await bacaDbLama();
  const data = dataLamaDiHp(lama);
  const adaIsi = data.barang.length || data.pelanggan.length || data.catatan.length;

  let jumlah = 0;
  if (adaIsi) {
    const meta = new Map((lama?.meta || []).map((m) => [m.kunci, m.nilai]));
    await db.transaction("rw", db.barang, db.pelanggan, db.catatan, db.meta, async () => {
      // Barang dan pelanggan memakai tabel server yang sama, jadi status dirty-nya dipertahankan
      await tambahYangBelumAda(db.barang, data.barang.map((b) => barangDariV3(b, b.dirty ? 1 : 0)));
      await tambahYangBelumAda(db.pelanggan, data.pelanggan.map((p) => pelangganDariV3(p, p.dirty ? 1 : 0)));
      const baru = await tambahYangBelumAda(db.catatan, catatanDariV3(data.catatan, data.barang));
      await tandaiSudahPindah(baru);
      jumlah = baru.length;
      await aturMeta("mulai_selesai", 1);
      if (meta.get("pemilik")) await aturMeta("pemilik", meta.get("pemilik"));
      const nama = localStorage.getItem("bw_nama_warung");
      if (nama) await aturMeta("nama_warung", nama);
    });
  }
  localStorage.setItem(PENANDA_SELESAI, "1");
  return jumlah;
}

// ---------- Data di cloud ----------

// Catatan v3 di server diubah ke v4 dan ditandai dirty, jadi terkirim ke tabel catatan2
export async function pindahkanCatatanCloud(remote) {
  const semua = [];
  let sejak = "1970-01-01T00:00:00Z";
  for (let putaran = 0; putaran < 100; putaran++) {
    const daftar = await remote.ambilSejak("catatan", sejak, 1000);
    const baru = daftar.filter((c) => !semua.some((x) => x.id === c.id));
    semua.push(...baru);
    if (daftar.length < 1000 || !baru.length) break;
    sejak = daftar[daftar.length - 1].server_updated_at;
  }
  if (!semua.length) return 0;
  const barang = await db.barang.toArray();
  return db.transaction("rw", db.catatan, db.meta, async () => {
    const baru = await tambahYangBelumAda(db.catatan, catatanDariV3(semua, barang));
    await tandaiSudahPindah(baru);
    return baru.length;
  });
}

export const perluCocokkanLaci = () => ambilMeta("cocokkan_laci");
