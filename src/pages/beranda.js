// beranda.js: halaman utama. Uang hari ini, tiga tombol (Jual, Keluar, Terima bayar),
// dan daftar catatan hari ini.
import { mulaiAplikasi, ambilStatus, ambilNamaWarung } from "../app.js";
import { supabaseAktif } from "../data/supabase.js";
import { semua, semuaMentah } from "../data/db.js";
import { daftarBarang, daftarPelanggan, catatJual, catatKeluar, catatBayar } from "../data/aksi.js";
import { hitungUang } from "../data/hitung.js";
import { uraikanKalimat } from "../data/suara.js";
import { formatRupiah } from "../lib/format.js";
import { hariIni, formatTanggalLengkap } from "../lib/tanggal.js";
import { el, ambilAngka, pasangFormatRupiah, ribuan, bukaLembar, pasangLembar, aman, kabar, saatDataBerubah, itemCatatan, kosong, inisial } from "../ui/komponen.js";
import { bukaRincian } from "../ui/rincian.js";

await mulaiAplikasi();

const $ = (id) => document.getElementById(id);
const pilihanRadio = (nama) => document.querySelector(`input[name="${nama}"]:checked`).value;

// ===================== Bagian atas: nama warung dan status =====================

function jamMenit(ms) {
  return new Date(ms).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

const IKON_STATUS = {
  sinkron: '<path d="M17.5 19H7a5 5 0 1 1 1-9.9A6 6 0 0 1 19.5 11 4 4 0 0 1 17.5 19Z"/><path d="m9.5 14 2 2 3.5-3.5"/>',
  menyinkron: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>',
  offline: '<path d="m2 2 20 20"/><path d="M17.5 19H7a5 5 0 0 1-1.6-9.7"/><path d="M10 5.3A6 6 0 0 1 19.5 11a4 4 0 0 1 1.4 7.3"/>',
  tamu: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
};
IKON_STATUS.gagal = IKON_STATUS.offline;

function teksStatus(s) {
  if (!s.email) return "Data hanya di HP ini";
  if (s.keadaan === "menyinkron") return s.belum ? `Menyimpan ${s.belum} catatan…` : "Menyimpan…";
  if (s.keadaan === "offline") return s.belum ? `Offline · ${s.belum} catatan menunggu sinyal` : "Offline";
  if (s.keadaan === "gagal") return "Belum tersambung ke server, dicoba lagi otomatis";
  return "Tersimpan di cloud" + (s.terakhir ? " · " + jamMenit(s.terakhir) : "");
}

function gambarKepala(s = ambilStatus()) {
  const nama = ambilNamaWarung();
  $("nama-warung").textContent = nama || "Buku Warung";
  const keadaan = s.email ? s.keadaan : "tamu";
  const status = $("status-simpan");
  status.dataset.keadaan = keadaan;
  status.innerHTML = `<svg class="ikon" viewBox="0 0 24 24" aria-hidden="true">${IKON_STATUS[keadaan] || IKON_STATUS.sinkron}</svg>`;
  status.append(teksStatus(s));

  const avatar = $("avatar");
  avatar.dataset.keadaan = keadaan;
  avatar.classList.toggle("tamu", !s.email);
  avatar.replaceChildren();
  if (s.email) avatar.append(inisial(nama || s.email), el("span", { className: "titik" }));
  else avatar.innerHTML = '<svg class="ikon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';
  avatar.setAttribute("aria-label", s.email ? `Akun ${s.email}: ${teksStatus(s)}` : "Akun: belum masuk");
  $("ajak-masuk").hidden = Boolean(s.email) || !supabaseAktif();
}

// ===================== Isi halaman =====================

async function tampilkan() {
  const tgl = hariIni();
  $("tanggal-hari").textContent = formatTanggalLengkap(tgl);
  const [catatan, pelanggan] = await Promise.all([semua("catatan"), daftarPelanggan()]);
  // Koreksi stok tidak menyangkut uang, jadi tidak ditampilkan di Beranda (ada di Laporan)
  const hariIniSaja = catatan.filter((c) => c.tanggal === tgl && c.jenis !== "stok").sort((a, b) => b.created_at - a.created_at);

  const uang = hitungUang(hariIniSaja);
  $("laci").textContent = formatRupiah(uang.selisih);
  $("masuk").textContent = formatRupiah(uang.masuk);
  $("keluar").textContent = formatRupiah(uang.keluar);

  const berutang = pelanggan.filter((p) => p.utang > 0);
  $("kartu-utang").hidden = !berutang.length;
  $("total-utang").textContent = formatRupiah(berutang.reduce((n, p) => n + p.utang, 0));
  $("jumlah-berutang").textContent = `· ${berutang.length} orang`;

  // Termasuk pelanggan yang sudah dihapus, supaya catatan lamanya tetap bernama
  const nama = new Map((await semuaMentah("pelanggan")).map((p) => [p.id, p.nama]));
  $("daftar-hari-ini").replaceChildren(
    ...(hariIniSaja.length
      ? hariIniSaja.map((c) => itemCatatan(c, nama.get(c.pelanggan_id) || "pelanggan", (x) => bukaRincian(x, nama.get(x.pelanggan_id) || "pelanggan", tampilkan)))
      : [kosong("Belum ada catatan hari ini. Tekan Jual saat ada pembeli.")])
  );

  $("saran-pelanggan").replaceChildren(...pelanggan.map((p) => el("option", { value: p.nama })));
}

// ===================== Lembar Jual =====================

let barangJual = [];
const jumlahDipilih = new Map(); // id barang -> jumlah

function totalJual() {
  let total = ambilAngka($("jual-lainnya"));
  for (const b of barangJual) total += (jumlahDipilih.get(b.id) || 0) * b.harga_jual;
  return total;
}

function perbaruiRingkasJual() {
  const nanti = pilihanRadio("dibayar") === "nanti";
  $("bidang-pelanggan-jual").hidden = !nanti;
  $("jual-total").textContent = formatRupiah(totalJual());
  const nama = $("jual-pelanggan").value.trim() || "pelanggan";
  const stokBerubah = barangJual.filter((b) => jumlahDipilih.get(b.id)).map((b) => `stok ${b.nama} berkurang ${jumlahDipilih.get(b.id)}`);
  $("jual-petunjuk").textContent =
    totalJual() === 0
      ? ""
      : (nanti ? `Uang belum masuk laci. Ditambahkan ke utang ${nama}` : "Uang masuk laci") + (stokBerubah.length ? ", " + stokBerubah.join(", ") : "") + ".";
}

function gambarDaftarJual() {
  const cari = $("cari-barang").value.trim().toLowerCase();
  const tampil = barangJual.filter((b) => b.nama.toLowerCase().includes(cari));
  if (!barangJual.length) {
    $("daftar-jual").replaceChildren(el("p", { className: "petunjuk", textContent: "Belum ada barang. Tambahkan di halaman Barang, atau isi nominal di bagian Lainnya." }));
    return;
  }
  $("daftar-jual").replaceChildren(
    ...tampil.map((b) => {
      const n = jumlahDipilih.get(b.id) || 0;
      const bisa = b.harga_jual > 0 && b.stok > 0;
      const ket = !b.harga_jual ? "Harga jual belum diisi" : b.stok <= 0 ? "Stok habis" : `${formatRupiah(b.harga_jual)} · stok ${b.stok}`;
      const ubahJumlah = (selisih) => {
        jumlahDipilih.set(b.id, Math.min(b.stok, Math.max(0, n + selisih)));
        gambarDaftarJual();
        perbaruiRingkasJual();
      };
      const kanan = n
        ? el(
            "span",
            { className: "stepper" },
            el("button", { type: "button", textContent: "−", "aria-label": `Kurangi ${b.nama}`, onclick: () => ubahJumlah(-1) }),
            el("output", { textContent: n, "aria-label": `Jumlah ${b.nama}` }),
            el("button", { type: "button", className: "tambah", textContent: "+", "aria-label": `Tambah ${b.nama}`, disabled: n >= b.stok, onclick: () => ubahJumlah(1) })
          )
        : el("button", { type: "button", className: "tombol-kecil", textContent: "Tambah", disabled: !bisa, "aria-label": `Tambah ${b.nama}`, onclick: () => ubahJumlah(1) });
      return el("div", { className: "baris-barang" }, el("span", { className: "teks" }, el("span", { className: "judul", textContent: b.nama }), el("span", { className: "kecil", textContent: ket })), kanan);
    }),
    ...(tampil.length ? [] : [el("p", { className: "petunjuk", textContent: "Barang tidak ditemukan." })])
  );
}

async function bukaJual() {
  barangJual = await daftarBarang();
  jumlahDipilih.clear();
  for (const id of ["cari-barang", "jual-lainnya", "jual-keterangan", "jual-pelanggan"]) $(id).value = "";
  document.querySelector('input[name="dibayar"][value="sekarang"]').checked = true;
  $("jual-galat").textContent = "";
  const pelanggan = (await daftarPelanggan()).sort((a, b) => b.utang - a.utang).slice(0, 4);
  $("chip-pelanggan-jual").replaceChildren(
    ...pelanggan.map((p) =>
      el("button", { type: "button", className: "chip", textContent: p.nama, onclick: () => (($("jual-pelanggan").value = p.nama), perbaruiRingkasJual()) })
    )
  );
  gambarDaftarJual();
  perbaruiRingkasJual();
  bukaLembar($("lembar-jual"));
}

async function simpanJual() {
  const hasil = await aman(() =>
    catatJual({
      pilihan: [...jumlahDipilih].map(([barang_id, jumlah]) => ({ barang_id, jumlah })),
      lainnya: ambilAngka($("jual-lainnya")),
      keterangan: $("jual-keterangan").value,
      dibayar: pilihanRadio("dibayar"),
      namaPelanggan: $("jual-pelanggan").value,
    })
  );
  if (hasil.galat) return ($("jual-galat").textContent = hasil.galat);
  $("lembar-jual").close();
  kabar(`Tersimpan: jual ${formatRupiah(hasil.catatan.nominal)}` + (hasil.catatan.dibayar === "nanti" ? " (bayar nanti)" : ""));
  tampilkan();
}

// ===================== Lembar Uang keluar =====================

let barangKeluar = [];

function perbaruiKeluar() {
  const untuk = pilihanRadio("untuk");
  $("keluar-belanja").hidden = untuk !== "belanja";
  $("keluar-pinjaman").hidden = untuk !== "pinjaman";
  $("keluar-biaya").hidden = untuk !== "biaya";
  const b = barangKeluar.find((x) => x.id === $("keluar-barang").value);
  const jumlah = Number($("keluar-jumlah").value) || 0;
  const nominal = ambilAngka($("keluar-nominal"));
  $("keluar-info-belanja").textContent =
    b && jumlah > 0
      ? `Stok ${b.nama}: ${b.stok} → ${b.stok + jumlah}` + (nominal ? ` · modal per barang ${formatRupiah(Math.round(nominal / jumlah))}` : "")
      : barangKeluar.length
        ? ""
        : "Belum ada barang. Tambahkan dulu di halaman Barang.";
}

async function bukaKeluar() {
  barangKeluar = await daftarBarang();
  for (const id of ["keluar-nominal", "keluar-jumlah", "keluar-pelanggan", "keluar-keterangan"]) $(id).value = "";
  document.querySelector('input[name="untuk"][value="belanja"]').checked = true;
  $("keluar-barang").replaceChildren(el("option", { value: "", textContent: "Pilih barang" }), ...barangKeluar.map((b) => el("option", { value: b.id, textContent: b.nama })));
  $("keluar-galat").textContent = "";
  perbaruiKeluar();
  bukaLembar($("lembar-keluar"));
}

async function simpanKeluar() {
  const hasil = await aman(() =>
    catatKeluar({
      nominal: ambilAngka($("keluar-nominal")),
      untuk: pilihanRadio("untuk"),
      barangId: $("keluar-barang").value,
      jumlah: Math.floor(Number($("keluar-jumlah").value)),
      namaPelanggan: $("keluar-pelanggan").value,
      keterangan: $("keluar-keterangan").value,
    })
  );
  if (hasil.galat) return ($("keluar-galat").textContent = hasil.galat);
  $("lembar-keluar").close();
  kabar(`Tersimpan: uang keluar ${formatRupiah(hasil.catatan.nominal)}`);
  tampilkan();
}

// ===================== Lembar Terima bayar =====================

let berutang = [];
let nominalSuara = null; // nominal yang diucapkan, supaya tidak tertimpa saat pelanggan dipilih

function perbaruiBayar() {
  const p = berutang.find((x) => x.id === $("bayar-pelanggan").value);
  $("bayar-info").textContent = p ? `Utang ${p.nama}: ${formatRupiah(p.utang)}` : "";
}

async function bukaBayar(idPelanggan) {
  nominalSuara = null;
  berutang = (await daftarPelanggan()).filter((p) => p.utang > 0).sort((a, b) => a.nama.localeCompare(b.nama));
  $("bayar-galat").textContent = "";
  if (!berutang.length) return kabar("Tidak ada pelanggan yang punya utang.");
  $("bayar-pelanggan").replaceChildren(...berutang.map((p) => el("option", { value: p.id, textContent: `${p.nama} · ${formatRupiah(p.utang)}` })));
  if (idPelanggan) $("bayar-pelanggan").value = idPelanggan;
  const p = berutang.find((x) => x.id === $("bayar-pelanggan").value);
  $("bayar-nominal").value = p ? ribuan(p.utang) : "";
  perbaruiBayar();
  bukaLembar($("lembar-bayar"));
}

async function simpanBayar() {
  const hasil = await aman(() => catatBayar({ pelangganId: $("bayar-pelanggan").value, nominal: ambilAngka($("bayar-nominal")) }));
  if (hasil.galat) return ($("bayar-galat").textContent = hasil.galat);
  $("lembar-bayar").close();
  kabar(`Tersimpan: terima bayar ${formatRupiah(hasil.catatan.nominal)}`);
  tampilkan();
}

// ===================== Catat dengan suara =====================
// Lembarnya hanya diisi, tidak pernah disimpan: pengguna memeriksa lalu menekan Simpan sendiri.

const ambilPengenal = () => globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;

const PESAN_GALAT_SUARA = {
  "not-allowed": "Izin mikrofon ditolak. Izinkan mikrofon untuk situs ini di pengaturan browser, atau ketik manual.",
  "service-not-allowed": "Pengenal suara belum aktif. Di iPhone, nyalakan Siri atau Dikte di Pengaturan, lalu coba lagi, atau ketik manual.",
  "no-speech": "Suara belum terdengar. Coba lagi lebih dekat ke HP.",
  network: "Pengenal suara butuh internet. Periksa sinyal lalu coba lagi, atau ketik manual.",
  "audio-capture": "Mikrofon tidak ditemukan. Coba lagi atau ketik manual.",
};

const LAMA_PESAN_SUARA = 8000; // pesannya berisi petunjuk, jadi perlu waktu untuk dibaca
// Safari di iPhone kadang diam saja tanpa hasil dan tanpa galat, jadi aplikasi yang harus berhenti menunggu
const BATAS_TANPA_RESPONS = 12000;
const BATAS_SETELAH_BERHENTI = 2000;

let pengenal = null; // sesi merekam yang sedang berjalan

function perbaruiTombolSuara() {
  $("tombol-suara").hidden = !(ambilPengenal() && navigator.onLine);
}

function mulaiSuara() {
  const Pengenal = ambilPengenal();
  const sesi = new Pengenal();
  let teks = "";
  sesi.lang = "id-ID";
  sesi.interimResults = true;
  sesi.continuous = false;
  sesi.onresult = (e) => {
    teks = Array.from(e.results, (hasil) => hasil[0].transcript).join(" ").trim();
    $("suara-teks").textContent = teks;
  };
  sesi.onerror = (e) => {
    if (pengenal !== sesi) return; // sesi lama yang sudah dibatalkan, jangan ganggu sesi baru
    pengenal = null; // onend sesudah ini tidak perlu memproses apa pun
    $("lembar-suara").close();
    // "aborted" berarti dibatalkan oleh aplikasi sendiri, jadi tidak perlu pesan
    if (e.error !== "aborted") kabar(PESAN_GALAT_SUARA[e.error] || `Pengenal suara belum bisa dipakai (${e.error}). Coba lagi atau ketik manual.`, LAMA_PESAN_SUARA);
  };
  sesi.onend = () => {
    if (pengenal !== sesi) return; // sudah dibatalkan atau gagal
    pengenal = null;
    sesi.abort(); // Safari bisa tetap memakai mikrofon setelah selesai
    $("lembar-suara").close();
    if (teks) prosesUcapan(teks);
    else kabar(PESAN_GALAT_SUARA["no-speech"], LAMA_PESAN_SUARA);
  };

  $("judul-suara").textContent = "Mendengarkan…";
  $("suara-teks").textContent = "";
  $("suara-berhenti").disabled = false;
  pengenal = sesi;
  bukaLembar($("lembar-suara"));
  try {
    sesi.start();
  } catch (e) {
    console.error(e);
    pengenal = null;
    $("lembar-suara").close();
    kabar("Pengenal suara belum bisa dipakai. Coba lagi atau ketik manual.", LAMA_PESAN_SUARA);
    return;
  }
  setTimeout(() => {
    if (pengenal !== sesi || teks) return; // sudah selesai, atau sudah ada suara yang terdengar
    pengenal = null;
    sesi.abort();
    $("lembar-suara").close();
    kabar("Pengenal suara tidak merespons. Pastikan mikrofon tidak sedang dipakai telepon, dan Siri atau Dikte menyala, atau ketik manual.", LAMA_PESAN_SUARA);
  }, BATAS_TANPA_RESPONS);
}

function berhentiSuara() {
  if (!pengenal) return;
  const sesi = pengenal;
  $("judul-suara").textContent = "Memproses…";
  $("suara-berhenti").disabled = true;
  sesi.stop(); // hasil terakhir tetap datang, lalu onend
  setTimeout(() => sesi.onend(), BATAS_SETELAH_BERHENTI); // kalau onend tidak datang, pakai teks yang sudah ada
}

// Lembar ditutup dengan tombol silang, klik di luar, atau tombol Esc: batalkan rekaman
function batalSuara() {
  if (!pengenal || $("lembar-suara").open) return; // sudah dibuka lagi untuk sesi baru
  const sesi = pengenal;
  pengenal = null;
  sesi.abort();
}

async function prosesUcapan(teks) {
  const [barang, pelanggan] = await Promise.all([daftarBarang(), daftarPelanggan()]);
  const hasil = uraikanKalimat(teks, { barang, pelanggan });
  if (!hasil.jenis) return kabar(`Belum mengerti: '${teks}'. Coba lagi atau ketik manual.`);
  const nama = pelanggan.find((p) => p.id === hasil.pelanggan_id)?.nama || "";
  if (hasil.jenis === "jual") await isiJual(hasil, nama);
  else if (hasil.jenis === "keluar") await isiKeluar(hasil, nama);
  else await isiBayar(hasil, nama);
  // Lembar Terima bayar tidak terbuka kalau tidak ada yang berutang; pesannya sudah muncul
  if (document.querySelector("dialog[open]")) kabar("Periksa dulu, lalu Simpan");
}

async function isiJual(h, namaPelanggan) {
  await bukaJual();
  const catatan = [];
  for (const item of h.item) {
    const b = barangJual.find((x) => x.id === item.barang_id);
    if (!b.harga_jual) catatan.push(`Harga jual ${b.nama} belum diisi.`);
    else if (b.stok <= 0) catatan.push(`Stok ${b.nama} habis.`);
    else {
      jumlahDipilih.set(b.id, Math.min(item.jumlah, b.stok));
      if (item.jumlah > b.stok) catatan.push(`Stok ${b.nama} tinggal ${b.stok}.`);
    }
  }
  // Kalau ada barang, totalnya mengikuti harga barang. Nominal yang disebut tidak ditambahkan,
  // karena akan terhitung dua kali.
  if (!h.item.length && h.nominal) $("jual-lainnya").value = ribuan(h.nominal);
  if (h.item.length && h.nominal && h.nominal !== totalJual()) catatan.push(`Total mengikuti harga barang, bukan ${formatRupiah(h.nominal)} yang disebut.`);
  $("jual-keterangan").value = h.keterangan;
  document.querySelector(`input[name="dibayar"][value="${h.dibayar}"]`).checked = true;
  $("jual-pelanggan").value = namaPelanggan;
  $("jual-galat").textContent = catatan.join(" ");
  gambarDaftarJual();
  perbaruiRingkasJual();
}

async function isiKeluar(h, namaPelanggan) {
  await bukaKeluar();
  document.activeElement?.blur(); // jangan munculkan keyboard, pengguna hanya perlu memeriksa
  document.querySelector(`input[name="untuk"][value="${h.untuk}"]`).checked = true;
  if (h.nominal) $("keluar-nominal").value = ribuan(h.nominal);
  const item = h.item[0];
  if (item) {
    $("keluar-barang").value = item.barang_id;
    $("keluar-jumlah").value = item.jumlah;
  }
  $("keluar-pelanggan").value = namaPelanggan;
  const catatan = [];
  // Kolom keterangan hanya tampil untuk biaya; pada lainnya, tunjukkan kata yang tidak dikenali
  if (h.untuk === "biaya") $("keluar-keterangan").value = h.keterangan;
  else if (h.keterangan) catatan.push(`Belum dikenali: "${h.keterangan}".`);
  if (h.item.length > 1) catatan.push("Satu catatan belanja hanya untuk satu barang. Catat barang lainnya terpisah.");
  $("keluar-galat").textContent = catatan.join(" ");
  perbaruiKeluar();
}

async function isiBayar(h, namaPelanggan) {
  await bukaBayar(h.pelanggan_id);
  if (!$("lembar-bayar").open) return;
  // Kalau namanya tidak dikenali, biarkan kosong supaya tidak tercatat ke orang yang salah
  const adaUtang = berutang.some((p) => p.id === h.pelanggan_id);
  $("bayar-pelanggan").value = adaUtang ? h.pelanggan_id : "";
  nominalSuara = h.nominal;
  if (h.nominal) $("bayar-nominal").value = ribuan(h.nominal);
  else if (!adaUtang) $("bayar-nominal").value = "";
  $("bayar-galat").textContent = adaUtang ? "" : namaPelanggan ? `${namaPelanggan} tidak punya utang. Pilih pelanggan.` : "Pilih pelanggan yang membayar.";
  perbaruiBayar();
}

// ===================== Pasang =====================

for (const id of ["lembar-jual", "lembar-keluar", "lembar-bayar", "lembar-suara"]) pasangLembar($(id));
for (const id of ["jual-lainnya", "keluar-nominal", "bayar-nominal"]) pasangFormatRupiah($(id));

$("tombol-jual").addEventListener("click", bukaJual);
$("tombol-keluar").addEventListener("click", bukaKeluar);
$("tombol-bayar").addEventListener("click", () => bukaBayar());
$("tombol-suara").addEventListener("click", mulaiSuara);
$("suara-berhenti").addEventListener("click", berhentiSuara);
$("lembar-suara").addEventListener("close", batalSuara);
globalThis.addEventListener("online", perbaruiTombolSuara);
globalThis.addEventListener("offline", perbaruiTombolSuara);
perbaruiTombolSuara();
$("simpan-jual").addEventListener("click", simpanJual);
$("simpan-keluar").addEventListener("click", simpanKeluar);
$("simpan-bayar").addEventListener("click", simpanBayar);

$("cari-barang").addEventListener("input", gambarDaftarJual);
for (const id of ["jual-lainnya", "jual-pelanggan"]) $(id).addEventListener("input", perbaruiRingkasJual);
document.querySelectorAll('input[name="dibayar"]').forEach((r) => r.addEventListener("change", perbaruiRingkasJual));
document.querySelectorAll('input[name="untuk"]').forEach((r) => r.addEventListener("change", perbaruiKeluar));
for (const id of ["keluar-barang", "keluar-jumlah", "keluar-nominal"]) $(id).addEventListener("input", perbaruiKeluar);
$("bayar-pelanggan").addEventListener("change", () => {
  const p = berutang.find((x) => x.id === $("bayar-pelanggan").value);
  $("bayar-nominal").value = p ? ribuan(nominalSuara ?? p.utang) : "";
  perbaruiBayar();
});

globalThis.addEventListener("bw:status", (e) => gambarKepala(e.detail));
globalThis.addEventListener("bw:nama-warung", () => gambarKepala());
saatDataBerubah(tampilkan);
gambarKepala();
await tampilkan();

// Dibuka dari halaman lain, misalnya pelanggan.html -> index.html?bayar=ID
const params = new URLSearchParams(location.search);
if (params.has("bayar")) {
  history.replaceState(null, "", location.pathname);
  bukaBayar(params.get("bayar"));
}
