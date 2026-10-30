// beranda.js: halaman utama. Uang hari ini, tiga tombol (Jual, Keluar, Terima bayar),
// dan daftar catatan hari ini.
import { mulaiAplikasi, ambilStatus, ambilNamaWarung } from "../app.js";
import { supabaseAktif } from "../data/supabase.js";
import { semua, semuaMentah } from "../data/db.js";
import { daftarBarang, daftarPelanggan, catatJual, catatKeluar, catatBayar } from "../data/aksi.js";
import { hitungUang } from "../data/hitung.js";
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

function perbaruiBayar() {
  const p = berutang.find((x) => x.id === $("bayar-pelanggan").value);
  $("bayar-info").textContent = p ? `Utang ${p.nama}: ${formatRupiah(p.utang)}` : "";
}

async function bukaBayar(idPelanggan) {
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

// ===================== Pasang =====================

for (const id of ["lembar-jual", "lembar-keluar", "lembar-bayar"]) pasangLembar($(id));
for (const id of ["jual-lainnya", "keluar-nominal", "bayar-nominal"]) pasangFormatRupiah($(id));

$("tombol-jual").addEventListener("click", bukaJual);
$("tombol-keluar").addEventListener("click", bukaKeluar);
$("tombol-bayar").addEventListener("click", () => bukaBayar());
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
  $("bayar-nominal").value = p ? ribuan(p.utang) : "";
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
