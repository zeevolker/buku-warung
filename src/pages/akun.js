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

// ---------- Masuk dengan email + kata sandi ----------
// Cara ini tidak membuka halaman lain, jadi juga jalan di aplikasi layar utama iPhone.
// (Di iPhone, Safari dan aplikasi layar utama menyimpan data terpisah. Login Google dan
// tautan email terbuka di Safari, sehingga sesinya tidak sampai ke aplikasi.)

const modeDaftar = () => document.querySelector('input[name="mode-masuk"]:checked').value === "daftar";
const emailValid = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

function perbaruiMode() {
  $("tombol-masuk").textContent = modeDaftar() ? "Daftar" : "Masuk";
  $("sandi").autocomplete = modeDaftar() ? "new-password" : "current-password";
  $("tombol-lupa").hidden = modeDaftar();
  $("pesan-masuk").textContent = "";
  $("info-masuk").textContent = "";
}

function terjemahkanGalat(error) {
  const pesan = (error?.message || "").toLowerCase();
  if (error?.status === 429 || pesan.includes("rate limit")) return "Terlalu sering mencoba. Tunggu beberapa menit lalu coba lagi.";
  if (pesan.includes("invalid login")) return "Email atau kata sandi salah.";
  if (pesan.includes("not confirmed")) return "Email belum dikonfirmasi. Buka email dari Buku Warung, tekan tautannya, lalu masuk di sini.";
  if (pesan.includes("already registered")) return "Email ini sudah terdaftar. Pilih Masuk.";
  if (pesan.includes("password")) return "Kata sandi terlalu lemah. Pakai minimal 8 huruf dan angka.";
  return "Gagal: " + (error?.message || "coba lagi.");
}

async function masukSandi() {
  const email = $("email").value.trim();
  const password = $("sandi").value;
  $("pesan-masuk").textContent = "";
  $("info-masuk").textContent = "";
  if (!emailValid(email)) return ($("pesan-masuk").textContent = "Tulis alamat email yang benar.");
  if (password.length < 8) return ($("pesan-masuk").textContent = "Kata sandi minimal 8 huruf atau angka.");

  $("tombol-masuk").disabled = true;
  const klien = await ambilKlienSupabase();
  const { data, error } = modeDaftar()
    ? await klien.auth.signUp({ email, password, options: { emailRedirectTo: alamatKembali() } })
    : await klien.auth.signInWithPassword({ email, password });
  $("tombol-masuk").disabled = false;

  if (error) return ($("pesan-masuk").textContent = terjemahkanGalat(error));
  if (modeDaftar() && !data.session) {
    // Supabase meminta konfirmasi email dulu
    $("info-masuk").textContent = `Akun dibuat. Buka email di ${email}, tekan tautan konfirmasinya, lalu kembali ke sini dan pilih Masuk.`;
    document.querySelector('input[name="mode-masuk"][value="masuk"]').checked = true;
    $("tombol-masuk").textContent = "Masuk";
    $("tombol-lupa").hidden = false;
  }
  // Kalau berhasil masuk, app.js menyinkronkan data dan halaman ini berganti tampilan sendiri
}

async function lupaSandi() {
  const email = $("email").value.trim();
  if (!emailValid(email)) {
    $("pesan-masuk").textContent = "Tulis email akunmu dulu, lalu tekan Lupa kata sandi.";
    return $("email").focus();
  }
  const klien = await ambilKlienSupabase();
  const { error } = await klien.auth.resetPasswordForEmail(email, { redirectTo: alamatKembali() });
  if (error) return ($("pesan-masuk").textContent = terjemahkanGalat(error));
  $("pesan-masuk").textContent = "";
  $("info-masuk").textContent = `Tautan untuk membuat kata sandi baru dikirim ke ${email}.`;
}

// Dibuka dari tautan "lupa kata sandi" di email
async function simpanSandiBaru() {
  const password = $("sandi-baru").value;
  if (password.length < 8) return ($("pesan-sandi-baru").textContent = "Minimal 8 huruf atau angka.");
  const klien = await ambilKlienSupabase();
  const { error } = await klien.auth.updateUser({ password });
  if (error) return ($("pesan-sandi-baru").textContent = terjemahkanGalat(error));
  $("lembar-sandi-baru").close();
  kabar("Kata sandi baru disimpan. Sekarang bisa masuk di HP mana pun dengan kata sandi ini.");
}

let sudahMintaSandi = false;
function cekPemulihan(s) {
  if (s.pulihkanSandi && !sudahMintaSandi) {
    sudahMintaSandi = true;
    bukaLembar($("lembar-sandi-baru"));
  }
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
$("tombol-masuk").addEventListener("click", masukSandi);
$("tombol-lupa").addEventListener("click", lupaSandi);
$("simpan-sandi-baru").addEventListener("click", simpanSandiBaru);
document.querySelectorAll('input[name="mode-masuk"]').forEach((r) => r.addEventListener("change", perbaruiMode));
$("sandi").addEventListener("keydown", (e) => e.key === "Enter" && masukSandi());

// Aplikasi layar utama iPhone: sembunyikan login Google, karena terbuka di Safari dan tidak tersambung
const iphoneLayarUtama = navigator.standalone === true;
$("cara-lain").hidden = iphoneLayarUtama;
$("catatan-iphone").hidden = !iphoneLayarUtama;
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
globalThis.addEventListener("bw:status", (e) => {
  gambar(e.detail);
  cekPemulihan(e.detail);
});
globalThis.addEventListener("bw:nama-warung", () => gambar());
pasangLembar($("lembar-sandi-baru"));
gambar();
cekPemulihan(ambilStatus());
tampilCadanganTerakhir();
