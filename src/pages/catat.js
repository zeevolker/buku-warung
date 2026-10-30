// catat.js: halaman Catat Cepat.
import { mulaiAplikasi } from "../app.js";
import { pasangKepala, pasangPengingat } from "../ui/kepala.js";
import { semua, ambil } from "../data/db.js";
import { catatTransaksi, ubahTransaksi, hapusTransaksi } from "../data/repo.js";
import { hitungKas } from "../data/hitung.js";
import { formatRupiah } from "../lib/format.js";
import { hariIni, formatTanggalLengkap, formatTanggalPanjang } from "../lib/tanggal.js";
import { ambilAngka, pasangFormatRupiah, buatItemTransaksi, buatItemKasbon, buatKosong, aman, saatDataBerubah } from "../ui/komponen.js";

// Tunggu pemindahan data lama selesai sebelum menampilkan apa pun
await mulaiAplikasi();
pasangKepala();
pasangPengingat();

const $ = (id) => document.getElementById(id);
const formEl = $("form-catat");
const nominalEl = $("nominal");
const catatanEl = $("catatan");
const pesanEl = $("pesan");
const infoEl = $("info");
const bannerEl = $("banner-ubah");

let idDiubah = null; // null = catat baru, berisi id = sedang mengubah catatan itu
let tujuanKembali = null; // diisi kalau mengubah catatan dari halaman Riwayat
let timerInfo;

$("tanggal-hari-ini").textContent = formatTanggalLengkap(hariIni());

function tampilInfo(teks) {
  infoEl.textContent = teks;
  clearTimeout(timerInfo);
  timerInfo = setTimeout(() => (infoEl.textContent = ""), 3000);
}

function selesaiUbah() {
  idDiubah = null;
  bannerEl.hidden = true;
}

function mulaiUbah(t) {
  idDiubah = t.id;
  nominalEl.value = t.nominal.toLocaleString("id-ID");
  catatanEl.value = t.catatan;
  pesanEl.textContent = "";
  $("banner-teks").textContent =
    t.tanggal === hariIni()
      ? "Sedang mengubah catatan. Pilih Uang Masuk atau Uang Keluar untuk menyimpan."
      : `Mengubah catatan tanggal ${formatTanggalPanjang(t.tanggal)}. Pilih Uang Masuk atau Uang Keluar untuk menyimpan.`;
  bannerEl.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
  nominalEl.focus();
}

function batalUbah() {
  if (tujuanKembali) return (location.href = tujuanKembali);
  selesaiUbah();
  formEl.reset();
}

async function simpan(tipe) {
  const nominal = ambilAngka(nominalEl);
  if (nominal <= 0) {
    pesanEl.textContent = "Isi nominal dulu, harus lebih dari 0.";
    nominalEl.focus();
    return;
  }
  const sedangUbah = idDiubah !== null;
  const hasil = await aman(() =>
    sedangUbah ? ubahTransaksi(idDiubah, { tipe, nominal, catatan: catatanEl.value }) : catatTransaksi({ tipe, nominal, catatan: catatanEl.value })
  );
  // Gagal: biarkan isi form supaya tidak perlu mengetik ulang
  if (hasil.galat) {
    pesanEl.textContent = hasil.galat;
    return;
  }
  if (sedangUbah && tujuanKembali) return (location.href = tujuanKembali);

  tampilInfo(`${sedangUbah ? "Diubah" : "Tersimpan"}: ${tipe === "masuk" ? "Uang masuk" : "Uang keluar"} ${formatRupiah(nominal)}`);
  pesanEl.textContent = "";
  selesaiUbah();
  formEl.reset();
  tampilkan();
}

async function hapus(t) {
  await aman(() => hapusTransaksi(t.id));
  if (idDiubah === t.id) {
    selesaiUbah();
    formEl.reset();
  }
  tampilkan();
}

async function tampilkan() {
  const tgl = hariIni();
  const [transaksi, kasbon, pelanggan] = await Promise.all([semua("transaksi"), semua("kasbon"), semua("pelanggan")]);
  const hariIniData = transaksi.filter((t) => t.tanggal === tgl);
  const kasbonHariIni = kasbon.filter((k) => k.tanggal === tgl && k.tipe === "utang");
  const nama = new Map(pelanggan.map((p) => [p.id, p.nama]));

  const kas = hitungKas(hariIniData);
  $("total-masuk").textContent = formatRupiah(kas.masuk);
  $("total-keluar").textContent = formatRupiah(kas.keluar);
  $("total").textContent = formatRupiah(kas.total);

  const daftar = [
    ...hariIniData.map((t) => ({ waktu: t.created_at, li: buatItemTransaksi(t, { onUbah: mulaiUbah, onHapus: hapus }) })),
    ...kasbonHariIni.map((k) => ({ waktu: k.created_at, li: buatItemKasbon(k, nama.get(k.pelanggan_id) || "pelanggan") })),
  ].sort((a, b) => b.waktu - a.waktu);

  $("daftar").replaceChildren(
    ...(daftar.length
      ? daftar.map((d) => d.li)
      : [buatKosong("Belum ada catatan hari ini. Isi nominal di atas lalu pilih Uang Masuk atau Uang Keluar.")])
  );
}

pasangFormatRupiah(nominalEl);
// Tombol nominal cepat menambah ke nominal yang ada (tap 2x +5.000 = 10.000)
document.querySelectorAll("[data-tambah]").forEach((tombol) =>
  tombol.addEventListener("click", () => {
    nominalEl.value = (ambilAngka(nominalEl) + Number(tombol.dataset.tambah)).toLocaleString("id-ID");
  })
);
$("btn-masuk").addEventListener("click", () => simpan("masuk"));
$("btn-keluar").addEventListener("click", () => simpan("keluar"));
$("batal-ubah").addEventListener("click", batalUbah);
saatDataBerubah(tampilkan);

await tampilkan();

// Dibuka dari Riwayat: index.html?ubah=ID&kembali=riwayat
const params = new URLSearchParams(location.search);
const idDariAlamat = params.get("ubah");
if (idDariAlamat) {
  const t = await ambil("transaksi", idDariAlamat);
  if (t && !t.deleted && t.sumber === "manual") {
    if (params.get("kembali") === "riwayat") tujuanKembali = "riwayat.html?tanggal=" + t.tanggal;
    mulaiUbah(t);
  }
  history.replaceState(null, "", location.pathname);
}
