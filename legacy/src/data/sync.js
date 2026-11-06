// sync.js: sinkronisasi dua arah antara IndexedDB (HP) dan Supabase (server).
//
// Cara kerja ("offline-first"):
// 1. Semua perubahan disimpan dulu di HP dan ditandai dirty. Aplikasi tidak pernah menunggu internet.
// 2. DORONG: baris dirty dikirim ke server (upsert berdasarkan id).
// 3. TARIK: ambil baris yang berubah di server sejak tarikan terakhir (kolom server_updated_at,
//    diisi server sendiri), lalu gabungkan ke HP.
// 4. Kalau satu baris diubah di dua HP, yang updated_at-nya paling baru yang dipakai
//    (last-write-wins). Server menerapkan aturan yang sama lewat trigger, jadi hasilnya konsisten.
//    Stok dan sisa kasbon aman dari bentrokan ini karena keduanya dihitung dari baris-baris
//    yang hanya ditambah, bukan dari satu angka yang ditimpa.

import { TABEL, semuaMentah, gabungDariServer, tandaiTerkirim, ambilMeta, aturMeta } from "./db.js";

const BATAS_HALAMAN = 1000;
// Tarikan dimulai sedikit sebelum tarikan terakhir, untuk menangkap baris yang
// tersimpan di server hampir bersamaan dengan tarikan sebelumnya. Baris ganda tidak masalah.
const TUMPANG_MS = 10_000;

// Aturan memilih versi: pakai baris dari server kalau HP belum punya, atau kalau versi server
// lebih baru. Kalau sama-sama baru dan HP punya perubahan yang belum terkirim, pertahankan versi HP.
export function pakaiVersiServer(lokal, server) {
  if (!lokal) return true;
  if (lokal.dirty) return server.updated_at > lokal.updated_at;
  return server.updated_at >= lokal.updated_at;
}

// Hapus kolom yang hanya ada di HP sebelum dikirim
export function siapKirim(baris) {
  const { dirty, ...sisa } = baris;
  return sisa;
}

export async function dorong(remote) {
  let terkirim = 0;
  for (const tabel of TABEL) {
    const kotor = (await semuaMentah(tabel)).filter((b) => b.dirty);
    for (let i = 0; i < kotor.length; i += 500) {
      const potongan = kotor.slice(i, i + 500);
      await remote.kirim(tabel, potongan.map(siapKirim));
      await tandaiTerkirim(tabel, potongan);
      terkirim += potongan.length;
    }
  }
  return terkirim;
}

export async function tarik(remote) {
  let diterima = 0;
  for (const tabel of TABEL) {
    const kunci = "tarik:" + tabel;
    let kursor = (await ambilMeta(kunci)) || "1970-01-01T00:00:00Z";
    let dariMs = Date.parse(kursor) - TUMPANG_MS;

    for (let putaran = 0; putaran < 100; putaran++) {
      const daftar = await remote.ambilSejak(tabel, new Date(Math.max(0, dariMs)).toISOString(), BATAS_HALAMAN);
      diterima += await gabungDariServer(tabel, daftar, pakaiVersiServer);
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

// Satu putaran sinkron: kirim dulu, baru tarik.
export async function sinkronSekali(remote) {
  const terkirim = await dorong(remote);
  const diterima = await tarik(remote);
  await aturMeta("sinkron_terakhir", Date.now());
  return { terkirim, diterima };
}
