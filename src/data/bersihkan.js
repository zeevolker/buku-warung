// bersihkan.js: menghapus permanen data yang sudah dihapus pengguna, setelah 30 hari.
//
// Aturannya sama dengan fungsi bersihkan_data_terhapus di server (lihat supabase/migrations):
// catatan dulu, baru barang dan pelanggan, dan barang atau pelanggan yang masih disebut catatan
// yang tersisa tetap disimpan, supaya riwayat lama utuh. Baris yang belum dihapus tidak disentuh.

import { db, ambilMeta, aturMeta } from "./db.js";
import { TABEL, namaServer } from "./sync.js";
import { tandaiBerubah } from "./ringkasan.js";

const SEHARI = 24 * 60 * 60 * 1000;
export const MASA_TUNGGU = 30 * SEHARI;
const UKURAN_HALAMAN = 1000;
const BATAS_PUTARAN = 10000; // pengaman: jangan berputar selamanya

// ---------- Fungsi murni ----------

// Pengguna tamu tidak punya server, jadi dirty tidak berarti apa-apa
export function bolehDibersihkan(baris, { sekarang, tamu = false }) {
  if (!baris.deleted) return false;
  if (!tamu && baris.dirty) return false;
  return baris.updated_at < sekarang - MASA_TUNGGU;
}

// Barang dan pelanggan yang disebut catatan-catatan ini, termasuk catatan yang sudah dihapus
export function idDipakai(catatan) {
  const barang = new Set();
  const pelanggan = new Set();
  for (const c of catatan) {
    if (c.pelanggan_id) pelanggan.add(c.pelanggan_id);
    for (const b of c.item || []) if (b.barang_id) barang.add(b.barang_id);
  }
  return { barang, pelanggan };
}

// data = { barang: [...], pelanggan: [...], catatan: [...], pengingat: [...], memo: [...] }
// Hasilnya daftar id yang boleh dihapus per tabel.
export function pilihYangDibersihkan(data, pilihan) {
  const lolos = (daftar = []) => daftar.filter((b) => bolehDibersihkan(b, pilihan)).map((b) => b.id);
  const catatan = lolos(data.catatan);
  const hilang = new Set(catatan);
  const dipakai = idDipakai((data.catatan || []).filter((c) => !hilang.has(c.id)));
  return {
    catatan,
    pengingat: lolos(data.pengingat),
    memo: lolos(data.memo),
    barang: lolos(data.barang).filter((id) => !dipakai.barang.has(id)),
    pelanggan: lolos(data.pelanggan).filter((id) => !dipakai.pelanggan.has(id)),
  };
}

// Baris di HP yang sudah tidak ada di server dan tidak dirty berarti sudah dibersihkan di sana.
// Pengecualian: barang atau pelanggan yang masih disebut catatan yang tertinggal di HP (catatan
// yang belum terkirim). Mereka dikirim ulang, karena server menolak catatan tanpa pelanggannya.
export function pilihYangHilang(data, idServer) {
  const tidakAda = (tabel) => (data[tabel] || []).filter((b) => !b.dirty && !idServer[tabel].has(b.id)).map((b) => b.id);
  const catatan = tidakAda("catatan");
  const hilang = new Set(catatan);
  const dipakai = idDipakai((data.catatan || []).filter((c) => !hilang.has(c.id)));
  const bagi = (tabel) => {
    const semua = tidakAda(tabel);
    return { hapus: semua.filter((id) => !dipakai[tabel].has(id)), kirimUlang: semua.filter((id) => dipakai[tabel].has(id)) };
  };
  const barang = bagi("barang");
  const pelanggan = bagi("pelanggan");
  return {
    hapus: { catatan, pengingat: tidakAda("pengingat"), memo: tidakAda("memo"), barang: barang.hapus, pelanggan: pelanggan.hapus },
    kirimUlang: { barang: barang.kirimUlang, pelanggan: pelanggan.kirimUlang },
  };
}

// ---------- Penyimpanan ----------

async function bacaSemua() {
  const data = {};
  for (const t of TABEL) data[t] = await db[t].toArray();
  return data;
}

// Dipanggil saat aplikasi dibuka, paling sering sekali sehari
export async function bersihkanBilaPerlu(sekarang = Date.now()) {
  const terakhir = await ambilMeta("bersihkan_terakhir");
  if (terakhir && Math.abs(sekarang - terakhir) < SEHARI) return null;
  return db.transaction("rw", ...TABEL.map((t) => db[t]), db.meta, async () => {
    // Pemilik tetap tercatat walau sesi sedang habis atau HP offline, dan hilang saat keluar akun
    const tamu = !(await ambilMeta("pemilik"));
    const pilihan = pilihYangDibersihkan(await bacaSemua(), { sekarang, tamu });
    for (const t of TABEL) await db[t].bulkDelete(pilihan[t]);
    await aturMeta("bersihkan_terakhir", sekarang);
    return pilihan;
  });
}

// Semua id satu tabel di server, per halaman. Hanya berhenti setelah halaman benar-benar kosong:
// server bisa memberi lebih sedikit dari yang diminta, dan daftar yang terpotong akan menghapus data.
async function semuaIdServer(remote, tabel) {
  const semua = new Set();
  let setelah = null;
  for (let putaran = 0; putaran < BATAS_PUTARAN; putaran++) {
    const daftar = await remote.ambilId(namaServer(tabel), setelah, UKURAN_HALAMAN);
    if (!daftar.length) return semua;
    for (const id of daftar) semua.add(id);
    setelah = daftar[daftar.length - 1];
  }
  throw new Error("Daftar id terlalu panjang: " + tabel);
}

// Untuk HP yang lama tidak sinkron: baris yang sudah dibersihkan di server tidak pernah sampai
// sebagai perubahan, jadi harus dicocokkan dengan daftar id. Kalau ada yang gagal, tidak ada yang dihapus.
export async function sinkronPenuh(remote) {
  const idServer = {};
  for (const t of TABEL) idServer[t] = await semuaIdServer(remote, t);

  // Server yang kosong sama sekali lebih mungkin salah akun atau gangguan daripada pembersihan
  if (TABEL.every((t) => !idServer[t].size)) return null;

  return db.transaction("rw", ...TABEL.map((t) => db[t]), db.meta, async () => {
    const { hapus, kirimUlang } = pilihYangHilang(await bacaSemua(), idServer);
    // Catatan yang belum dihapus di HP ini ikut mengubah isi laci, jadi ringkasannya dihitung ulang
    for (const c of await db.catatan.bulkGet(hapus.catatan)) {
      if (!c.deleted) await tandaiBerubah(c.waktu);
    }
    for (const t of TABEL) await db[t].bulkDelete(hapus[t]);
    for (const t of ["barang", "pelanggan"]) {
      await db[t].where("id").anyOf(kirimUlang[t]).modify({ dirty: 1 });
    }
    return { hapus, kirimUlang };
  });
}
