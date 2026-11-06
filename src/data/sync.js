// sync.js: sinkron dua arah antara Dexie (HP) dan Supabase (server).
//
// 1. Semua perubahan disimpan dulu di HP dan ditandai dirty. Aplikasi tidak pernah menunggu internet.
// 2. DORONG: baris dirty dikirim ke server (upsert berdasarkan id).
// 3. TARIK: ambil baris yang berubah di server sejak tarikan terakhir (kolom server_updated_at,
//    diisi server sendiri), lalu gabungkan ke HP.
// 4. Kalau satu baris diubah di dua HP, yang updated_at-nya paling baru yang dipakai.
//    Server menerapkan aturan yang sama lewat trigger, jadi hasilnya konsisten.
//    Stok, bon, dan laci aman dari bentrokan ini karena dihitung dari catatan yang hanya ditambah.

import { db, ambilMeta, aturMeta } from "./db.js";
import { tandaiBerubah } from "./ringkasan.js";

// Urutan kirim: induk dulu, karena catatan menunjuk ke pelanggan
export const TABEL = ["barang", "pelanggan", "catatan", "pengingat", "memo"];

// Catatan v4 disimpan di tabel catatan2, karena tabel catatan dibiarkan sebagai arsip v3
const NAMA_SERVER = { catatan: "catatan2" };
export const namaServer = (tabel) => NAMA_SERVER[tabel] || tabel;

const BATAS_HALAMAN = 1000;
const UKURAN_KIRIM = 500;
// Tarikan dimulai sedikit sebelum tarikan terakhir, untuk menangkap baris yang tersimpan
// di server hampir bersamaan dengan tarikan sebelumnya. Baris ganda tidak masalah.
const TUMPANG_MS = 10_000;

// Kolom yang dikirim ke server dan nilai bawaannya. Semua baris harus punya kolom yang sama,
// karena kolom yang hilang akan dianggap kosong oleh server.
const UMUM = { id: undefined, created_at: 0, updated_at: 0, deleted: false };
const KOLOM = {
  barang: { ...UMUM, nama: "", harga_jual: 0, harga_beli: 0, batas_hampir_habis: 5 },
  pelanggan: { ...UMUM, nama: "", no_wa: "" },
  catatan: { ...UMUM, waktu: 0, dari: "", ke: "", pelanggan_id: null, nominal: 0, item: [], keterangan: "" },
  pengingat: { ...UMUM, teks: "", keterangan: "", waktu_ingat: null, selesai: false },
  memo: { ...UMUM, judul: "", isi: "", warna: "putih" },
};

export function siapKirim(tabel, baris) {
  const hasil = {};
  for (const [kolom, bawaan] of Object.entries(KOLOM[tabel])) hasil[kolom] = baris[kolom] ?? bawaan;
  return hasil;
}

// Pakai baris dari server kalau HP belum punya, atau kalau versi server lebih baru.
// Kalau sama-sama baru dan HP punya perubahan yang belum terkirim, pertahankan versi HP.
export function pakaiVersiServer(lokal, server) {
  if (!lokal) return true;
  if (lokal.dirty) return server.updated_at > lokal.updated_at;
  return server.updated_at >= lokal.updated_at;
}

export async function jumlahBelumTerkirim() {
  let n = 0;
  for (const t of TABEL) n += await db[t].where("dirty").equals(1).count();
  return n;
}

export async function dorong(remote) {
  let terkirim = 0;
  for (const tabel of TABEL) {
    const kotor = await db[tabel].where("dirty").equals(1).toArray();
    for (let i = 0; i < kotor.length; i += UKURAN_KIRIM) {
      const potongan = kotor.slice(i, i + UKURAN_KIRIM);
      await remote.kirim(namaServer(tabel), potongan.map((b) => siapKirim(tabel, b)));
      // Tandai terkirim, kecuali baris sudah diubah lagi selama dikirim
      await db.transaction("rw", db[tabel], async () => {
        for (const kirim of potongan) {
          const kini = await db[tabel].get(kirim.id);
          if (kini && kini.updated_at === kirim.updated_at) await db[tabel].put({ ...kini, dirty: 0 });
        }
      });
      terkirim += potongan.length;
    }
  }
  return terkirim;
}

async function gabungDariServer(tabel, daftar) {
  if (!daftar.length) return 0;
  return db.transaction("rw", db[tabel], db.meta, async () => {
    let dipakai = 0;
    for (const server of daftar) {
      const lokal = await db[tabel].get(server.id);
      if (!pakaiVersiServer(lokal, server)) continue;
      const { user_id, server_updated_at, ...baris } = server;
      await db[tabel].put({ ...baris, dirty: 0 });
      // Catatan bisa datang dari tanggal lama, jadi ringkasan harian perlu dihitung ulang
      if (tabel === "catatan") await tandaiBerubah(baris.waktu);
      dipakai++;
    }
    return dipakai;
  });
}

export async function tarik(remote) {
  let diterima = 0;
  for (const tabel of TABEL) {
    const kunci = "tarik:" + tabel;
    let kursor = (await ambilMeta(kunci)) || "1970-01-01T00:00:00Z";
    let dariMs = Date.parse(kursor) - TUMPANG_MS;

    for (let putaran = 0; putaran < 100; putaran++) {
      const daftar = await remote.ambilSejak(namaServer(tabel), new Date(Math.max(0, dariMs)).toISOString(), BATAS_HALAMAN);
      diterima += await gabungDariServer(tabel, daftar);
      if (daftar.length) kursor = daftar[daftar.length - 1].server_updated_at;
      if (daftar.length < BATAS_HALAMAN) break;
      const berikut = Date.parse(kursor);
      if (berikut <= dariMs) break; // pengaman: jangan berputar di tempat
      dariMs = berikut;
    }
    await aturMeta(kunci, kursor);
  }
  return diterima;
}

// Satu putaran: kirim dulu, baru tarik. Saat pertama kali, catatan v3 di cloud ikut dipindahkan.
export async function sinkronSekali(remote) {
  const terkirim = await dorong(remote);
  const diterima = await tarik(remote);
  if (!(await ambilMeta("migrasi_cloud"))) {
    const { pindahkanCatatanCloud } = await import("./migrasi.js");
    const jumlah = await pindahkanCatatanCloud(remote);
    if (jumlah) await dorong(remote);
    await aturMeta("migrasi_cloud", 1);
  }
  await aturMeta("sinkron_terakhir", Date.now());
  return { terkirim, diterima };
}
