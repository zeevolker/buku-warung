// barang.js: daftar barang, tambah barang, ubah harga, dan koreksi stok.
import { mulaiAplikasi } from "../app.js";
import { daftarBarang, simpanBarang, koreksiStok, hapusBarang } from "../data/aksi.js";
import { el, ambilAngka, pasangFormatRupiah, ribuan, bukaLembar, pasangLembar, pasangHapusDuaKali, aman, kabar, saatDataBerubah, kosong } from "../ui/komponen.js";

await mulaiAplikasi();

const $ = (id) => document.getElementById(id);
const BATAS_MENIPIS = 5; // stok segini atau kurang ditandai "Hampir habis"

let semuaBarang = [];
let hanyaMenipis = false;
let sedangDiubah = null; // barang yang dibuka di lembar, atau null untuk barang baru

function baris(b) {
  const menipis = b.stok <= BATAS_MENIPIS;
  const harga = b.harga_jual ? `Jual ${ribuan(b.harga_jual)}` + (b.harga_beli ? ` · Modal ${ribuan(b.harga_beli)}` : "") : "Harga jual belum diisi";
  return el(
    "li",
    {},
    el(
      "button",
      { type: "button", className: "baris", onclick: () => bukaUbah(b) },
      el("span", { className: "teks" }, el("span", { className: "judul", textContent: b.nama }), el("span", { className: "ket", textContent: harga })),
      el("span", { className: "angka" + (menipis ? " menipis" : ""), textContent: b.stok }, menipis ? el("small", { textContent: b.stok <= 0 ? "Habis" : "Hampir habis" }) : null)
    )
  );
}

function gambar() {
  const cari = $("cari").value.trim().toLowerCase();
  const menipis = semuaBarang.filter((b) => b.stok <= BATAS_MENIPIS);
  $("saring-semua").textContent = `Semua · ${semuaBarang.length}`;
  $("saring-habis").textContent = `Hampir habis · ${menipis.length}`;
  $("saring-semua").setAttribute("aria-pressed", String(!hanyaMenipis));
  $("saring-habis").setAttribute("aria-pressed", String(hanyaMenipis));

  // Yang hampir habis paling atas, lalu urut nama
  const urutan = (b) => (b.stok <= BATAS_MENIPIS ? 0 : 1);
  const tampil = (hanyaMenipis ? menipis : semuaBarang)
    .filter((b) => b.nama.toLowerCase().includes(cari))
    .sort((a, b) => urutan(a) - urutan(b) || a.nama.localeCompare(b.nama));
  $("daftar-barang").replaceChildren(
    ...(tampil.length ? tampil.map(baris) : [kosong(semuaBarang.length ? "Tidak ada barang yang cocok." : "Belum ada barang. Tekan Barang baru untuk mulai.")])
  );
}

async function tampilkan() {
  semuaBarang = await daftarBarang();
  gambar();
}

// ---------- Lembar barang ----------

function isiLembar(b) {
  sedangDiubah = b;
  $("judul-lembar-barang").textContent = b ? "Ubah barang" : "Barang baru";
  $("b-nama").value = b ? b.nama : "";
  $("b-jual").value = b && b.harga_jual ? ribuan(b.harga_jual) : "";
  $("b-beli").value = b && b.harga_beli ? ribuan(b.harga_beli) : "";
  $("b-stok").value = b ? b.stok : "";
  $("label-stok").textContent = b ? "Stok sekarang" : "Stok awal";
  $("info-stok").textContent = b ? "Ubah kalau jumlah di rak berbeda (barang rusak, salah hitung). Selisihnya dicatat sebagai koreksi stok." : "";
  $("b-hapus").hidden = !b;
  $("b-galat").textContent = "";
  bukaLembar($("lembar-barang"));
}

const bukaBaru = () => isiLembar(null);
const bukaUbah = (b) => isiLembar(b);

async function simpan() {
  const stok = $("b-stok").value === "" ? 0 : Math.floor(Number($("b-stok").value));
  if (stok < 0) return ($("b-galat").textContent = "Stok tidak boleh minus.");
  const isi = { nama: $("b-nama").value, harga_jual: ambilAngka($("b-jual")), harga_beli: ambilAngka($("b-beli")) };

  const hasil = await aman(async () => {
    if (!sedangDiubah) return simpanBarang({ ...isi, stokAwal: stok });
    const h = await simpanBarang({ ...isi, id: sedangDiubah.id });
    if (h.galat) return h;
    return koreksiStok(sedangDiubah.id, stok);
  });
  if (hasil.galat) return ($("b-galat").textContent = hasil.galat);
  $("lembar-barang").close();
  kabar(sedangDiubah ? "Barang diperbarui." : `${isi.nama.trim()} ditambahkan.`);
  tampilkan();
}

pasangLembar($("lembar-barang"));
pasangFormatRupiah($("b-jual"));
pasangFormatRupiah($("b-beli"));
pasangHapusDuaKali($("b-hapus"), async () => {
  await aman(() => hapusBarang(sedangDiubah.id));
  $("lembar-barang").close();
  kabar("Barang dihapus. Catatan penjualannya tetap ada.");
  tampilkan();
});
$("tombol-baru").addEventListener("click", bukaBaru);
$("b-simpan").addEventListener("click", simpan);
$("cari").addEventListener("input", gambar);
$("saring-semua").addEventListener("click", () => ((hanyaMenipis = false), gambar()));
$("saring-habis").addEventListener("click", () => ((hanyaMenipis = true), gambar()));
saatDataBerubah(tampilkan);
tampilkan();

