// akun.js: masuk/keluar akun, status penyimpanan, nama warung, dan cadangan file.
import { mulaiAplikasi, ambilStatus, sinkronSekarang, keluarAkun, ambilKlienSupabase, jumlahBelumTerkirim, ambilNamaWarung, aturNamaWarung } from "../app.js";
import { supabaseAktif } from "../data/supabase.js";
import { buatIsiCadangan, bacaIsiCadangan, ringkasIsi, pulihkan } from "../data/cadangan.js";
import { formatWaktuLengkap, hariIni } from "../lib/tanggal.js";
import { el, bukaLembar, pasangLembar, kabar, inisial } from "../ui/komponen.js";

await mulaiAplikasi();

const $ = (id) => document.getElementById(id);
const alamatKembali = () => new URL("akun.html", location.href).href;

// ---------- Tampilan sesuai status ----------

const STATUS = {
  sinkron: ["Semua data aman di cloud", "masuk"],
  menyinkron: ["Sedang menyimpan…", ""],
  offline: ["Sedang offline", "keluar"],
  gagal: ["Belum tersambung ke server", "keluar"],
};

function gambar(s = ambilStatus()) {
  const masuk = Boolean(s.email);
  const nama = ambilNamaWarung();
  $("bagian-akun").hidden = !masuk;
  $("kartu-status").hidden = !masuk;
  $("bagian-keluar").hidden = !masuk;
  $("bagian-masuk").hidden = masuk || !supabaseAktif();
  $("tanpa-cloud").hidden = supabaseAktif();
  $("nama-warung").textContent = nama || "Belum diisi";

  if (!masuk) return;
  $("avatar-besar").textContent = inisial(nama || s.email);
  $("profil-nama").textContent = nama || "Buku Warung";
  $("profil-email").textContent = s.email;
  const [judul, gaya] = STATUS[s.keadaan] || STATUS.sinkron;
  $("status-judul").textContent = judul;
  $("status-ikon").className = "ikon-bulat " + gaya;
  $("status-waktu").textContent =
    s.keadaan === "offline" && s.belum
      ? `${s.belum} catatan akan dikirim saat ada sinyal`
      : s.terakhir
        ? "Terakhir tersimpan " + formatWaktuLengkap(s.terakhir)
        : "";
}

// ---------- Masuk ----------

async function masukGoogle() {
  const klien = await ambilKlienSupabase();
  const { error } = await klien.auth.signInWithOAuth({ provider: "google", options: { redirectTo: alamatKembali() } });
  if (error) $("pesan-masuk").textContent = "Gagal membuka login Google: " + error.message;
}

let emailTerkirim = "";

async function kirimTautan() {
  const email = $("email").value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    $("pesan-masuk").textContent = "Tulis alamat email yang benar.";
    return $("email").focus();
  }
  $("tombol-kirim").disabled = true;
  const klien = await ambilKlienSupabase();
  const { error } = await klien.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: alamatKembali() } });
  $("tombol-kirim").disabled = false;
  if (error) {
    $("pesan-masuk").textContent = error.status === 429 ? "Terlalu sering. Tunggu sebentar lalu coba lagi." : "Gagal mengirim email: " + error.message;
    return;
  }
  emailTerkirim = email;
  $("pesan-masuk").textContent = "";
  $("langkah-kode").hidden = false;
  $("info-kode").textContent = `Email dikirim ke ${email}. Buka emailnya lalu tekan tautan di dalamnya. Kalau email berisi kode angka, ketik di sini.`;
}

async function masukKode() {
  const token = $("kode").value.replace(/\D/g, "");
  if (token.length < 6) return ($("pesan-masuk").textContent = "Ketik kode dari email.");
  const klien = await ambilKlienSupabase();
  const { error } = await klien.auth.verifyOtp({ email: emailTerkirim, token, type: "email" });
  $("pesan-masuk").textContent = error ? "Kode salah atau sudah kedaluwarsa. Kirim ulang." : "";
}

async function keluar() {
  const belum = await jumlahBelumTerkirim();
  if (belum && !navigator.onLine) {
    $("pesan-keluar").textContent = `Ada ${belum} catatan yang belum terkirim. Sambungkan internet dulu supaya tidak hilang.`;
    return;
  }
  await keluarAkun();
  location.href = "index.html";
}

// ---------- Nama warung ----------

function bukaNama() {
  $("input-nama").value = ambilNamaWarung();
  bukaLembar($("lembar-nama"));
}

async function simpanNama() {
  await aturNamaWarung($("input-nama").value);
  $("lembar-nama").close();
  gambar();
  kabar("Nama warung disimpan.");
}

// ---------- Cadangan file ----------
const KEY_CADANGAN = "bw_cadangan_terakhir";
let dataMenunggu = null;

function tampilCadanganTerakhir() {
  const ms = Number(localStorage.getItem(KEY_CADANGAN)) || 0;
  $("cadangan-terakhir").textContent = ms ? "Terakhir: " + formatWaktuLengkap(ms) : "Belum pernah";
}

async function simpanCadangan() {
  const isi = JSON.stringify(await buatIsiCadangan(), null, 2);
  const url = URL.createObjectURL(new Blob([isi], { type: "application/json" }));
  const a = el("a", { href: url, download: `buku-warung-${hariIni()}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  localStorage.setItem(KEY_CADANGAN, String(Date.now()));
  tampilCadanganTerakhir();
  $("pesan-cadangan").textContent = "File cadangan diunduh. Simpan di tempat aman, misalnya kirim ke WhatsApp sendiri.";
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
    if (!hasil) return ($("pesan-cadangan").textContent = "File ini bukan cadangan Buku Warung.");
    dataMenunggu = hasil.data;
    $("ringkas-pulihkan").textContent =
      `File berisi ${ringkasIsi(hasil.data)}` +
      (hasil.dibuat ? `, dibuat ${formatWaktuLengkap(hasil.dibuat)}` : "") +
      ". Semua data sekarang akan DIGANTI dengan isi file ini" +
      (ambilStatus().email ? ", termasuk di cloud dan HP lain yang memakai akun ini." : ".");
    bukaLembar($("lembar-pulihkan"));
  };
  pembaca.readAsText(file);
}

async function pulihkanSekarang() {
  try {
    await pulihkan(dataMenunggu);
  } catch {
    $("pesan-cadangan").textContent = "Pemulihan gagal. Cek ruang penyimpanan HP lalu coba lagi.";
    return;
  }
  $("lembar-pulihkan").close();
  dataMenunggu = null;
  kabar("Data berhasil dipulihkan.");
  sinkronSekarang();
}

// ---------- Pasang ----------
pasangLembar($("lembar-nama"));
pasangLembar($("lembar-pulihkan"));
$("tombol-google").addEventListener("click", masukGoogle);
$("tombol-kirim").addEventListener("click", kirimTautan);
$("tombol-kode").addEventListener("click", masukKode);
$("tombol-sinkron").addEventListener("click", () => sinkronSekarang());
$("tombol-keluar").addEventListener("click", keluar);
$("tombol-nama").addEventListener("click", bukaNama);
$("simpan-nama").addEventListener("click", simpanNama);
$("tombol-cadangan").addEventListener("click", simpanCadangan);
$("file-cadangan").addEventListener("change", (e) => {
  if (e.target.files[0]) bacaFile(e.target.files[0]);
  e.target.value = "";
});
$("ya-pulihkan").addEventListener("click", pulihkanSekarang);
globalThis.addEventListener("bw:status", (e) => gambar(e.detail));
globalThis.addEventListener("bw:nama-warung", () => gambar());
gambar();
tampilCadanganTerakhir();
