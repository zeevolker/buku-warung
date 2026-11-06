// pelanggan.js: daftar pelanggan dan utangnya, plus detail satu pelanggan (?id=...).
import { mulaiAplikasi, ambilNamaWarung } from "../app.js";
import { semua } from "../data/db.js";
import { daftarPelanggan, tambahPelanggan, ubahPelanggan, hapusPelanggan } from "../data/aksi.js";
import { formatRupiah, nomorWhatsApp } from "../lib/format.js";
import { formatTanggalPendek } from "../lib/tanggal.js";
import { el, bukaLembar, pasangLembar, pasangHapusDuaKali, aman, kabar, saatDataBerubah, itemCatatan, kosong, inisial } from "../ui/komponen.js";
import { bukaRincian } from "../ui/rincian.js";

await mulaiAplikasi();

const $ = (id) => document.getElementById(id);
const idDetail = new URLSearchParams(location.search).get("id");
let semuaPelanggan = [];
let terakhir = new Map(); // id pelanggan -> tanggal catatan terakhir

// ===================== Daftar =====================

function baris(p) {
  const lunas = p.utang <= 0;
  const tgl = terakhir.get(p.id);
  return el(
    "li",
    {},
    el(
      "a",
      { className: "baris" + (lunas ? " redup" : ""), href: `pelanggan.html?id=${p.id}` },
      el("span", { className: "inisial", textContent: inisial(p.nama) }),
      el("span", { className: "teks" }, el("span", { className: "judul", textContent: p.nama }), el("span", { className: "ket", textContent: tgl ? `Terakhir ${formatTanggalPendek(tgl)}` : "Belum ada catatan" })),
      lunas ? el("span", { className: "lencana-lunas", textContent: "Lunas" }) : el("span", { className: "angka", textContent: formatRupiah(p.utang) })
    )
  );
}

function gambarDaftar() {
  const cari = $("cari").value.trim().toLowerCase();
  const berutang = semuaPelanggan.filter((p) => p.utang > 0);
  $("total-utang").textContent = formatRupiah(berutang.reduce((n, p) => n + p.utang, 0));
  $("jumlah-berutang").textContent = berutang.length ? `dari ${berutang.length} orang` : "Tidak ada yang berutang";
  // Yang berutang paling atas (terbesar dulu), yang lunas di bawah
  const tampil = semuaPelanggan.filter((p) => p.nama.toLowerCase().includes(cari)).sort((a, b) => b.utang - a.utang || a.nama.localeCompare(b.nama));
  $("daftar-pelanggan").replaceChildren(...(tampil.length ? tampil.map(baris) : [kosong(semuaPelanggan.length ? "Tidak ada nama yang cocok." : "Belum ada pelanggan.")]));
}

// ===================== Detail =====================

async function gambarDetail(catatan) {
  const p = semuaPelanggan.find((x) => x.id === idDetail);
  if (!p) {
    $("nama-pelanggan").textContent = "Pelanggan tidak ditemukan";
    $("riwayat").replaceChildren(kosong("Pelanggan ini mungkin sudah dihapus."));
    return;
  }
  document.title = `Buku Warung: ${p.nama}`;
  $("nama-pelanggan").textContent = p.nama;
  $("sisa-utang").textContent = p.utang > 0 ? formatRupiah(p.utang) : "Lunas";
  $("tombol-bayar").href = `index.html?bayar=${p.id}`;
  $("tombol-bayar").hidden = p.utang <= 0;
  $("tombol-ingatkan").hidden = p.utang <= 0;
  const riwayat = catatan.filter((c) => c.pelanggan_id === p.id).sort((a, b) => b.created_at - a.created_at);
  $("riwayat").replaceChildren(...(riwayat.length ? riwayat.map((c) => itemCatatan(c, p.nama, (x) => bukaRincian(x, p.nama, tampilkan), true)) : [kosong("Belum ada catatan.")]));
}

function ingatkan() {
  const p = semuaPelanggan.find((x) => x.id === idDetail);
  const warung = ambilNamaWarung() || "warung";
  const teks = `Halo ${p.nama}, mengingatkan utang di ${warung} sebesar ${formatRupiah(p.utang)}. Terima kasih.`;
  window.open(`https://wa.me/${nomorWhatsApp(p.telepon)}?text=${encodeURIComponent(teks)}`, "_blank", "noopener");
}

// ===================== Lembar tambah / ubah =====================

function bukaLembarPelanggan(p) {
  $("judul-lembar-pelanggan").textContent = p ? "Ubah pelanggan" : "Pelanggan baru";
  $("p-nama").value = p ? p.nama : "";
  $("p-telepon").value = p ? p.telepon || "" : "";
  $("p-hapus").hidden = !p;
  $("p-galat").textContent = "";
  bukaLembar($("lembar-pelanggan"));
}

async function simpanPelanggan() {
  const hasil = await aman(() =>
    idDetail ? ubahPelanggan(idDetail, { nama: $("p-nama").value, telepon: $("p-telepon").value }) : tambahPelanggan($("p-nama").value, $("p-telepon").value)
  );
  if (hasil.galat) return ($("p-galat").textContent = hasil.galat);
  $("lembar-pelanggan").close();
  kabar("Tersimpan.");
  tampilkan();
}

// ===================== Pasang =====================

async function tampilkan() {
  const [pelanggan, catatan] = await Promise.all([daftarPelanggan(), semua("catatan")]);
  semuaPelanggan = pelanggan;
  terakhir = new Map();
  for (const c of catatan) if (c.pelanggan_id && (terakhir.get(c.pelanggan_id) || "") < c.tanggal) terakhir.set(c.pelanggan_id, c.tanggal);
  if (idDetail) gambarDetail(catatan);
  else gambarDaftar();
}

$("tampilan-daftar").hidden = Boolean(idDetail);
$("tampilan-detail").hidden = !idDetail;
pasangLembar($("lembar-pelanggan"));
$("tombol-tambah").addEventListener("click", () => bukaLembarPelanggan(null));
$("tombol-ubah").addEventListener("click", () => bukaLembarPelanggan(semuaPelanggan.find((x) => x.id === idDetail)));
$("tombol-ingatkan").addEventListener("click", ingatkan);
$("p-simpan").addEventListener("click", simpanPelanggan);
pasangHapusDuaKali($("p-hapus"), async () => {
  const h = await aman(() => hapusPelanggan(idDetail));
  if (h.galat) return ($("p-galat").textContent = h.galat);
  location.href = "pelanggan.html";
});
$("cari").addEventListener("input", gambarDaftar);
saatDataBerubah(tampilkan);
tampilkan();
