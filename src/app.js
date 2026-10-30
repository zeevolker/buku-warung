// app.js: dijalankan di setiap halaman. Menyiapkan data, service worker, akun, dan sinkron.

import { ambilMeta, aturMeta, kosongkanSemua, jumlahBelumTerkirim } from "./data/db.js";
import { jalankanMigrasi } from "./data/migrasi.js";
import { sinkronSekali } from "./data/sync.js";
import { supabaseAktif, ambilKlien, remoteSupabase } from "./data/supabase.js";
import { hariIni } from "./lib/tanggal.js";

// ---------- Status sinkron (ditampilkan di pojok kanan atas) ----------
// keadaan: "tamu" | "sinkron" | "menyinkron" | "offline" | "gagal"
const status = { keadaan: "tamu", belum: 0, email: null, terakhir: null };

function kabariStatus(ubah) {
  Object.assign(status, ubah);
  globalThis.dispatchEvent(new CustomEvent("bw:status", { detail: { ...status } }));
}

export function ambilStatus() {
  return { ...status };
}

// ---------- Sinkron ----------
let klien = null;
let sedangSinkron = false;
let ulangiLagi = false;
let timerJadwal = null;

export async function sinkronSekarang() {
  if (!klien || !status.email) return;
  if (sedangSinkron) {
    ulangiLagi = true;
    return;
  }
  if (!navigator.onLine) {
    kabariStatus({ keadaan: "offline", belum: await jumlahBelumTerkirim() });
    return;
  }
  sedangSinkron = true;
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

function jadwalkanSinkron(tunda = 1500) {
  clearTimeout(timerJadwal);
  timerJadwal = setTimeout(sinkronSekarang, tunda);
}

// Data di HP ini milik siapa? Mencegah data dua akun tercampur di satu HP.
async function siapkanPemilik(userId) {
  const pemilik = await ambilMeta("pemilik");
  if (pemilik === userId) return;
  if (pemilik && pemilik !== userId) {
    // HP ini sebelumnya dipakai akun lain: kosongkan, lalu tarik data akun ini dari server
    await kosongkanSemua();
  }
  // Belum ada pemilik: data tamu di HP ini menjadi milik akun ini dan ikut terkirim
  await aturMeta("pemilik", userId);
}

async function masukSesi(session) {
  await siapkanPemilik(session.user.id);
  // Nama warung disimpan di akun, jadi ikut muncul di HP lain
  const nama = session.user.user_metadata?.nama_warung;
  if (nama) simpanNamaLokal(nama);
  kabariStatus({ keadaan: "menyinkron", email: session.user.email });
  await sinkronSekarang();
}

// Keluar akun: kirim yang tersisa, lalu kosongkan data di HP ini (aman untuk HP bersama).
export async function keluarAkun() {
  await sinkronSekarang();
  if (klien) await klien.auth.signOut();
  await kosongkanSemua();
  simpanNamaLokal("");
  kabariStatus({ keadaan: "tamu", email: null, belum: 0, terakhir: null });
}

export { jumlahBelumTerkirim };

// ---------- Nama warung ----------
const KEY_NAMA = "bw_nama_warung";

function simpanNamaLokal(nama) {
  try {
    localStorage.setItem(KEY_NAMA, nama);
  } catch {
    // abaikan
  }
  globalThis.dispatchEvent(new CustomEvent("bw:nama-warung", { detail: nama }));
}

export function ambilNamaWarung() {
  try {
    return localStorage.getItem(KEY_NAMA) || "";
  } catch {
    return "";
  }
}

export async function aturNamaWarung(nama) {
  nama = (nama || "").trim().slice(0, 40);
  simpanNamaLokal(nama);
  if (klien && status.email) await klien.auth.updateUser({ data: { nama_warung: nama } });
}

async function mulaiAkun() {
  const belum = await jumlahBelumTerkirim().catch(() => 0);
  kabariStatus({ keadaan: "tamu", belum, terakhir: await ambilMeta("sinkron_terakhir").catch(() => null) });
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
    }, 0);
  });

  // Kapan sinkron berjalan: setelah ada perubahan, saat sinyal kembali,
  // saat aplikasi dibuka lagi, dan tiap satu menit.
  globalThis.addEventListener("bw:data-berubah", (e) => {
    if (e.detail?.sumber === "lokal") jadwalkanSinkron();
  });
  globalThis.addEventListener("online", () => jadwalkanSinkron(200));
  globalThis.addEventListener("offline", () => kabariStatus({ keadaan: status.email ? "offline" : "tamu" }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") jadwalkanSinkron(200);
  });
  setInterval(() => document.visibilityState === "visible" && sinkronSekarang(), 60_000);
}

// Hitung ulang jumlah catatan "belum terkirim" setiap ada perubahan (untuk tamu juga)
globalThis.addEventListener("bw:data-berubah", async () => {
  if (!sedangSinkron) kabariStatus({ belum: await jumlahBelumTerkirim().catch(() => status.belum) });
});

// ---------- Lain-lain ----------

// Minta browser tidak menghapus data aplikasi ini saat penyimpanan HP hampir penuh
async function mintaPenyimpananTetap() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    // Tidak didukung: tidak apa-apa
  }
}

function daftarServiceWorker() {
  // Hanya di versi build (npm run build). Saat pengembangan, service worker justru
  // membuat perubahan kode tidak langsung terlihat.
  if (!import.meta.env?.PROD || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

// Halaman dibiarkan terbuka sampai lewat tengah malam: muat ulang supaya "hari ini" benar.
function pantauGantiHari() {
  const tanggalDimuat = hariIni();
  const cek = () => {
    if (hariIni() === tanggalDimuat) return;
    const aktif = document.activeElement;
    if (aktif && aktif.tagName === "INPUT" && aktif.value) return;
    location.reload();
  };
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && cek());
  setInterval(cek, 60_000);
}

export async function mulaiAplikasi() {
  try {
    await jalankanMigrasi();
  } catch (e) {
    console.error("Migrasi data lama gagal:", e);
  }
  mintaPenyimpananTetap();
  daftarServiceWorker();
  pantauGantiHari();
  // Akun dan sinkron berjalan di belakang; halaman tidak perlu menunggu internet.
  mulaiAkun().catch((e) => {
    console.warn("Gagal menyiapkan akun:", e);
    kabariStatus({ keadaan: status.email ? "gagal" : "tamu" });
  });
}

export function ambilKlienSupabase() {
  return ambilKlien();
}
