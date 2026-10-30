// akun.js: halaman Akun & Data: login, status sinkron, keluar, dan cadangan file.
import { mulaiAplikasi, ambilStatus, sinkronSekarang, keluarAkun, ambilKlienSupabase, jumlahBelumTerkirim } from "../app.js";
import { pasangKepala } from "../ui/kepala.js";
import { supabaseAktif } from "../data/supabase.js";
import { ambilMeta } from "../data/db.js";
import { buatIsiCadangan, bacaIsiCadangan, ringkasIsi, pulihkan } from "../data/cadangan.js";
import { formatWaktuLengkap, hariIni } from "../lib/tanggal.js";
import { el } from "../ui/komponen.js";

// Tunggu pemindahan data lama selesai sebelum menampilkan apa pun
await mulaiAplikasi();
pasangKepala();

const $ = (id) => document.getElementById(id);
const KEY_CADANGAN_TERAKHIR = "bw_cadangan_terakhir";

// ---------- Akun ----------

function tampilAkun(s) {
  const masuk = Boolean(s.email);
  $("bagian-masuk").hidden = masuk || !supabaseAktif();
  $("bagian-akun").hidden = !masuk;
  $("tanpa-cloud").hidden = supabaseAktif();
  if (!masuk) return;

  $("akun-email").textContent = s.email;
  const teks = {
    sinkron: "Semua data sudah tersimpan di cloud.",
    menyinkron: "Sedang menyimpan ke cloud…",
    offline: `Sedang offline. ${s.belum ? s.belum + " catatan" : "Perubahan"} akan dikirim saat ada sinyal.`,
    gagal: "Gagal tersambung ke server. Akan dicoba lagi otomatis.",
  };
  $("akun-status").textContent = teks[s.keadaan] || "";
  ambilMeta("sinkron_terakhir").then((ms) => {
    $("akun-terakhir").textContent = ms ? "Terakhir tersinkron: " + formatWaktuLengkap(ms) : "";
  });
}

async function masukGoogle() {
  const klien = await ambilKlienSupabase();
  const { error } = await klien.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: new URL("akun.html", location.href).href },
  });
  if (error) $("pesan-masuk").textContent = "Gagal membuka login Google: " + error.message;
}

let emailDikirim = "";

async function kirimKode() {
  const email = $("email").value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    $("pesan-masuk").textContent = "Tulis alamat email yang benar.";
    return $("email").focus();
  }
  $("btn-kirim-kode").disabled = true;
  const klien = await ambilKlienSupabase();
  const { error } = await klien.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: new URL("akun.html", location.href).href },
  });
  $("btn-kirim-kode").disabled = false;
  if (error) {
    $("pesan-masuk").textContent = error.status === 429 ? "Terlalu sering. Tunggu sebentar lalu coba lagi." : "Gagal mengirim email: " + error.message;
    return;
  }
  emailDikirim = email;
  $("pesan-masuk").textContent = "";
  $("langkah-kode").hidden = false;
  $("info-kode").textContent = `Kode dikirim ke ${email}. Buka emailnya, lalu ketik kodenya di sini (atau tekan tautan di email).`;
  $("kode").focus();
}

async function cekKode() {
  const token = $("kode").value.replace(/\D/g, "");
  if (token.length < 6) {
    $("pesan-masuk").textContent = "Ketik kode dari email.";
    return;
  }
  const klien = await ambilKlienSupabase();
  const { error } = await klien.auth.verifyOtp({ email: emailDikirim, token, type: "email" });
  $("pesan-masuk").textContent = error ? "Kode salah atau sudah kedaluwarsa. Minta kode baru." : "";
}

async function keluar() {
  const belum = await jumlahBelumTerkirim();
  if (belum && !navigator.onLine) {
    $("pesan-akun").textContent = `Ada ${belum} catatan yang belum terkirim karena offline. Sambungkan internet dulu supaya tidak hilang.`;
    return;
  }
  await keluarAkun();
  location.reload();
}

// ---------- Cadangan file ----------

let dataMenunggu = null;

function tampilTerakhirCadangan() {
  let ms = 0;
  try {
    ms = Number(localStorage.getItem(KEY_CADANGAN_TERAKHIR));
  } catch {
    // abaikan
  }
  $("cadangan-terakhir").textContent = ms ? "Terakhir dicadangkan: " + formatWaktuLengkap(ms) : "Belum pernah dicadangkan.";
}

async function simpanCadangan() {
  const isi = JSON.stringify(await buatIsiCadangan(), null, 2);
  const url = URL.createObjectURL(new Blob([isi], { type: "application/json" }));
  const a = el("a", { href: url, download: `buku-warung-cadangan-${hariIni()}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  try {
    localStorage.setItem(KEY_CADANGAN_TERAKHIR, String(Date.now()));
  } catch {
    // abaikan
  }
  tampilTerakhirCadangan();
  $("cadangan-pesan").textContent = "Cadangan diunduh. Simpan file-nya di tempat aman, misalnya kirim ke WhatsApp sendiri.";
}

function bacaFile(file) {
  const pembaca = new FileReader();
  pembaca.onload = () => {
    let hasil = null;
    try {
      hasil = bacaIsiCadangan(JSON.parse(pembaca.result));
    } catch {
      hasil = null;
    }
    if (!hasil) {
      $("cadangan-pesan").textContent = "File ini bukan cadangan Buku Warung yang valid.";
      return;
    }
    dataMenunggu = hasil.data;
    $("cadangan-ringkas").textContent =
      `Ditemukan ${ringkasIsi(hasil.data)}` +
      (hasil.dibuat ? ` (dicadangkan ${formatWaktuLengkap(hasil.dibuat)})` : "") +
      ". Memulihkan akan MENGGANTI semua data" +
      (ambilStatus().email ? ", termasuk di cloud dan HP lain yang memakai akun ini." : " di HP ini.");
    $("cadangan-konfirmasi").hidden = false;
    $("cadangan-pesan").textContent = "";
  };
  pembaca.readAsText(file);
}

async function pulihkanSekarang() {
  if (!dataMenunggu) return;
  try {
    await pulihkan(dataMenunggu);
  } catch {
    $("cadangan-konfirmasi").hidden = true;
    $("cadangan-pesan").textContent = "Pemulihan gagal karena data tidak bisa disimpan. Cek ruang penyimpanan HP lalu coba lagi.";
    return;
  }
  dataMenunggu = null;
  $("cadangan-konfirmasi").hidden = true;
  $("cadangan-pesan").textContent = "Data berhasil dipulihkan.";
  sinkronSekarang();
}

// ---------- Pasang ----------

$("btn-google").addEventListener("click", masukGoogle);
$("btn-kirim-kode").addEventListener("click", kirimKode);
$("btn-cek-kode").addEventListener("click", cekKode);
$("btn-sinkron").addEventListener("click", () => sinkronSekarang());
$("btn-keluar").addEventListener("click", keluar);
$("btn-cadangan").addEventListener("click", simpanCadangan);
$("file-cadangan").addEventListener("change", (e) => {
  if (e.target.files[0]) bacaFile(e.target.files[0]);
  e.target.value = "";
});
$("btn-pulihkan-ya").addEventListener("click", pulihkanSekarang);
$("btn-pulihkan-batal").addEventListener("click", () => {
  dataMenunggu = null;
  $("cadangan-konfirmasi").hidden = true;
});

tampilAkun(ambilStatus());
globalThis.addEventListener("bw:status", (e) => tampilAkun(e.detail));
tampilTerakhirCadangan();
