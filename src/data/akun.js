// akun.js: login, status simpan, dan penjadwalan sinkron.
// Status disimpan di luar React; layar membacanya lewat useAkun().

import { useSyncExternalStore } from "react";
import { liveQuery } from "dexie";
import { db, ambilMeta, aturMeta } from "./db.js";
import { sinkronSekali, jumlahBelumTerkirim, TABEL } from "./sync.js";
import { ambilKlien, remoteSupabase, supabaseAktif } from "./supabase.js";

// keadaan: "tamu" | "menyinkron" | "sinkron" | "offline" | "gagal"
const AWAL = { keadaan: "tamu", email: null, belum: 0, terakhir: null, pulihkanSandi: false };
let status = AWAL;
const pendengar = new Set();

function kabariStatus(ubah) {
  status = { ...status, ...ubah };
  pendengar.forEach((fungsi) => fungsi());
}

function langganan(fungsi) {
  pendengar.add(fungsi);
  return () => pendengar.delete(fungsi);
}

export const ambilStatus = () => status;
export const useAkun = () => useSyncExternalStore(langganan, ambilStatus);

// ---------- Sinkron ----------
let klien = null;
let sedangSinkron = false;
let ulangiLagi = false;
let timerJadwal = null;
let janjiSinkron = null;

async function jalankanSinkron() {
  kabariStatus({ keadaan: "menyinkron" });
  try {
    await sinkronSekali(remoteSupabase(klien));
    kabariStatus({ keadaan: "sinkron", belum: await jumlahBelumTerkirim(), terakhir: Date.now() });
  } catch (e) {
    console.warn("Sinkron gagal:", e);
    kabariStatus({ keadaan: navigator.onLine ? "gagal" : "offline", belum: await jumlahBelumTerkirim() });
  } finally {
    sedangSinkron = false;
    if (ulangiLagi) {
      ulangiLagi = false;
      jadwalkanSinkron(500);
    }
  }
}

export async function sinkronSekarang() {
  if (!klien || !status.email) return;
  if (sedangSinkron) {
    ulangiLagi = true;
    return janjiSinkron;
  }
  if (!navigator.onLine) {
    kabariStatus({ keadaan: "offline", belum: await jumlahBelumTerkirim() });
    return;
  }
  sedangSinkron = true;
  janjiSinkron = jalankanSinkron();
  return janjiSinkron;
}

function jadwalkanSinkron(tunda = 1500) {
  clearTimeout(timerJadwal);
  timerJadwal = setTimeout(sinkronSekarang, tunda);
}

// ---------- Data di HP ini milik siapa ----------

export async function kosongkanSemua() {
  await db.transaction("rw", ...TABEL.map((t) => db[t]), db.meta, async () => {
    for (const t of TABEL) await db[t].clear();
    await db.meta.clear();
  });
}

// Mencegah data dua akun tercampur di satu HP
async function siapkanPemilik(userId) {
  const pemilik = await ambilMeta("pemilik");
  if (pemilik === userId) return;
  // HP ini sebelumnya dipakai akun lain: kosongkan, lalu tarik data akun ini dari server
  if (pemilik) await kosongkanSemua();
  // Belum ada pemilik: data tamu di HP ini menjadi milik akun ini dan ikut terkirim
  await aturMeta("pemilik", userId);
}

async function masukSesi(session) {
  await siapkanPemilik(session.user.id);
  // Nama warung disimpan di akun, jadi ikut muncul di HP lain
  const namaAkun = session.user.user_metadata?.nama_warung;
  const namaHp = await ambilMeta("nama_warung");
  if (namaAkun) await aturMeta("nama_warung", namaAkun);
  else if (namaHp) klien?.auth.updateUser({ data: { nama_warung: namaHp } }).catch(() => {});
  kabariStatus({ keadaan: "menyinkron", email: session.user.email });
  await sinkronSekarang();
}

export async function aturNamaWarung(nama) {
  nama = (nama || "").trim().slice(0, 40);
  await aturMeta("nama_warung", nama);
  if (klien && status.email) await klien.auth.updateUser({ data: { nama_warung: nama } });
}

// Keluar akun: kirim yang tersisa, lalu kosongkan data di HP ini (aman untuk HP bersama).
// Ditolak kalau masih ada catatan yang belum terkirim, karena catatan itu akan hilang selamanya.
export async function keluarAkun() {
  await janjiSinkron; // tunggu sinkron yang sedang berjalan, lalu kirim yang masih tersisa
  await sinkronSekarang();
  const belum = await jumlahBelumTerkirim();
  if (belum) return { galat: `Ada ${belum} catatan yang belum terkirim, jadi belum bisa keluar supaya tidak hilang. Periksa internet lalu coba lagi.` };
  const k = await ambilKlien();
  if (k) await k.auth.signOut();
  await kosongkanSemua();
  kabariStatus({ keadaan: "tamu", email: null, belum: 0, terakhir: null });
  return {};
}

// ---------- Login ----------

const alamatKembali = (halaman) => new URL(`${import.meta.env.BASE_URL}${halaman}`, location.origin).href;

// Di iPhone mode layar utama, login Google terbuka di Safari dan sesinya tidak sampai ke aplikasi
export const iphoneLayarUtama = () => navigator.standalone === true;

export function terjemahkanGalat(error) {
  const pesan = (error?.message || "").toLowerCase();
  if (error?.status === 429 || pesan.includes("rate limit")) return "Terlalu sering mencoba. Tunggu beberapa menit lalu coba lagi.";
  if (pesan.includes("invalid login")) return "Email atau kata sandi salah.";
  if (pesan.includes("not confirmed")) return "Email belum dikonfirmasi. Buka email dari Buku Warung, tekan tautannya, lalu masuk di sini.";
  if (pesan.includes("already registered")) return "Email ini sudah terdaftar. Tekan Lupa kata sandi kalau belum punya kata sandi.";
  if (pesan.includes("password")) return "Kata sandi terlalu lemah. Pakai minimal 8 huruf dan angka.";
  if (pesan.includes("failed to fetch") || pesan.includes("network")) return "Tidak tersambung ke internet. Periksa sinyal lalu coba lagi.";
  return "Belum berhasil: " + (error?.message || "coba lagi.");
}

export const emailValid = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export async function masukGoogle() {
  const k = await ambilKlien();
  const { error } = await k.auth.signInWithOAuth({ provider: "google", options: { redirectTo: alamatKembali("mulai") } });
  return error ? { galat: terjemahkanGalat(error) } : {};
}

export async function masukEmail(email, password) {
  const k = await ambilKlien();
  const { error } = await k.auth.signInWithPassword({ email, password });
  return error ? { galat: terjemahkanGalat(error) } : {};
}

export async function daftarEmail(email, password) {
  const k = await ambilKlien();
  const { data, error } = await k.auth.signUp({ email, password, options: { emailRedirectTo: alamatKembali("mulai") } });
  if (error) return { galat: terjemahkanGalat(error) };
  // Email sudah punya akun (misalnya dari login Google): Supabase tidak mengirim email apa pun
  // dan tidak memberi error, demi keamanan. Tandanya: daftar identitasnya kosong.
  if (data.user && data.user.identities?.length === 0) return { sudahTerdaftar: true };
  // Supabase meminta konfirmasi email dulu
  if (!data.session) return { perluKonfirmasi: true };
  return {};
}

export async function lupaSandi(email) {
  const k = await ambilKlien();
  const { error } = await k.auth.resetPasswordForEmail(email, { redirectTo: alamatKembali("masuk") });
  return error ? { galat: terjemahkanGalat(error) } : {};
}

export async function simpanSandiBaru(password) {
  const k = await ambilKlien();
  const { error } = await k.auth.updateUser({ password });
  if (error) return { galat: terjemahkanGalat(error) };
  kabariStatus({ pulihkanSandi: false });
  return {};
}

// ---------- Mulai ----------

// Cukup sekali walau dipanggil berkali-kali (React StrictMode menjalankan efek dua kali saat pengembangan)
let janjiMulai = null;
export function mulaiAkun() {
  janjiMulai ??= siapkanAkun();
  return janjiMulai;
}

async function siapkanAkun() {
  // Hitung catatan yang belum terkirim, dan jadwalkan kirim setiap ada yang baru
  liveQuery(jumlahBelumTerkirim).subscribe({
    next: (belum) => {
      const bertambah = belum > status.belum;
      kabariStatus({ belum });
      if (bertambah && status.email) jadwalkanSinkron();
    },
    error: (e) => console.warn(e),
  });
  kabariStatus({ terakhir: await ambilMeta("sinkron_terakhir") });
  if (!supabaseAktif()) return;

  klien = await ambilKlien();
  const {
    data: { session },
  } = await klien.auth.getSession();
  if (session) await masukSesi(session);

  klien.auth.onAuthStateChange((peristiwa, sesi) => {
    // Dijalankan sesudah callback selesai: Supabase menyarankan tidak memanggil
    // fungsi Supabase lain langsung di dalam callback ini (bisa saling menunggu).
    setTimeout(() => {
      if (peristiwa === "SIGNED_IN" && sesi && sesi.user.email !== status.email) masukSesi(sesi);
      if (peristiwa === "SIGNED_OUT") kabariStatus({ keadaan: "tamu", email: null });
      if (peristiwa === "PASSWORD_RECOVERY") kabariStatus({ pulihkanSandi: true });
    }, 0);
  });

  // Kapan sinkron berjalan: setelah simpan (di atas), saat sinyal kembali,
  // saat aplikasi dibuka lagi, dan tiap satu menit.
  addEventListener("online", () => jadwalkanSinkron(200));
  addEventListener("offline", () => kabariStatus({ keadaan: status.email ? "offline" : "tamu" }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") jadwalkanSinkron(200);
  });
  setInterval(() => document.visibilityState === "visible" && sinkronSekarang(), 60_000);
}
