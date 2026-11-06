// uraian.js: mengubah catatan menjadi kalimat untuk layar (fungsi murni).

import { arahStok, rincianUntung, tanggalCatatan } from "./hitung.js";
import { ribuan } from "./format.js";
import { hariIni, jamDariMs, labelTanggal, labelTanggalPendek } from "./tanggal.js";

// "Minyak goreng ×2", atau "Indomie, Teh botol" kalau lebih dari satu barang
function namaBarang(c) {
  const item = c.item || [];
  if (item.length === 1) return item[0].jumlah > 1 ? `${item[0].nama} ×${item[0].jumlah}` : item[0].nama;
  return item.map((b) => b.nama).join(", ");
}

function judulCatatan(c, nama) {
  const barang = namaBarang(c);
  if (c.dari === "pembeli") {
    const isi = barang || c.keterangan || "Penjualan lain";
    return c.ke === "bon" ? `${isi} · bon ${nama}` : isi;
  }
  if (c.dari === "bon") return `${nama} bayar bon`;
  if (c.dari === "selisih" || c.ke === "selisih") return "Hitung ulang laci";
  if (c.dari === "stok") return `Koreksi stok ${barang}`;
  if (c.ke === "stok") return `Tambah stok ${barang}`;
  if (c.ke === "agen") return barang ? `Belanja ${barang}` : "Belanja";
  if (c.ke === "biaya") return c.keterangan || "Biaya warung";
  if (c.ke === "bon") return c.dari === "pemilik" ? `Bon lama ${nama}` : `${nama} pinjam uang`;
  if (c.ke === "pemilik") return "Ambil pribadi";
  return c.keterangan || "Uang awal";
}

const beriTanda = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + ribuan(Math.abs(n));

// tanda: "masuk" (laci bertambah), "keluar" (laci berkurang), "netral" (laci tetap)
export function uraiCatatan(c, namaPelanggan = "pelanggan") {
  const tanda = c.ke === "laci" ? "masuk" : c.dari === "laci" ? "keluar" : "netral";
  const angka = tanda === "masuk" ? beriTanda(c.nominal) : tanda === "keluar" ? beriTanda(-c.nominal) : ribuan(c.nominal);
  return { judul: judulCatatan(c, namaPelanggan), tanda, angka };
}

// Daftar akibat di lembar Rincian: [{ label, nilai }]
export function akibatCatatan(c, namaPelanggan = "pelanggan") {
  const hasil = [];
  if (c.ke === "laci") hasil.push({ label: "Laci", nilai: beriTanda(c.nominal) });
  if (c.dari === "laci") hasil.push({ label: "Laci", nilai: beriTanda(-c.nominal) });
  if (c.ke === "bon") hasil.push({ label: `Bon ${namaPelanggan}`, nilai: beriTanda(c.nominal) });
  if (c.dari === "bon") hasil.push({ label: `Bon ${namaPelanggan}`, nilai: beriTanda(-c.nominal) });
  const arah = arahStok(c);
  for (const b of c.item || []) {
    if (b.barang_id && arah) hasil.push({ label: `Stok ${b.nama}`, nilai: beriTanda(arah * b.jumlah) });
  }
  if (c.dari === "pembeli" || c.ke === "biaya") hasil.push({ label: "Untung", nilai: beriTanda(rincianUntung([c]).untung) });
  return hasil;
}

// "Hari ini, 09.30" atau "Rabu, 4 Nov, 10.05"
export function labelWaktu(c, kini = hariIni()) {
  const waktu = new Date(c.waktu);
  const jam = waktu.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  if (tanggalCatatan(c) === kini) return `Hari ini, ${jam}`;
  return `${waktu.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short" })}, ${jam}`;
}

// ---------- Semua riwayat ----------

// filter = "semua" | "jual" | "belanja" | "bon" | "laci"
const COCOK_FILTER = {
  semua: () => true,
  jual: (c) => c.dari === "pembeli",
  belanja: (c) => c.ke === "agen" || c.ke === "biaya",
  bon: (c) => c.dari === "bon" || c.ke === "bon",
  laci: (c) => (c.dari === "pemilik" && c.ke === "laci") || c.ke === "pemilik" || c.dari === "selisih" || c.ke === "selisih",
};

// Catatan yang cocok, terbaru di atas. namaPelanggan = fungsi id -> nama.
export function saringRiwayat(catatan, { filter = "semua", cari = "" }, namaPelanggan = () => "pelanggan") {
  const kata = cari.trim().toLowerCase();
  return catatan
    .filter((c) => !c.deleted && COCOK_FILTER[filter](c))
    .filter((c) => {
      if (!kata) return true;
      const nama = c.pelanggan_id ? namaPelanggan(c.pelanggan_id) : "";
      return `${uraiCatatan(c, nama).judul} ${nama} ${c.keterangan || ""}`.toLowerCase().includes(kata);
    })
    .sort((a, b) => b.waktu - a.waktu);
}

// Dikelompokkan per tanggal: [{ tanggal, label, jumlah, catatan }]
// catatanSemua dipisah supaya jumlahnya tetap benar walau yang tampil baru sebagian.
export function kelompokPerTanggal(catatanTampil, catatanSemua = catatanTampil) {
  const jumlah = new Map();
  for (const c of catatanSemua) jumlah.set(tanggalCatatan(c), (jumlah.get(tanggalCatatan(c)) || 0) + 1);
  const kelompok = new Map();
  for (const c of catatanTampil) {
    const t = tanggalCatatan(c);
    if (!kelompok.has(t)) kelompok.set(t, { tanggal: t, label: labelTanggal(t), jumlah: jumlah.get(t), catatan: [] });
    kelompok.get(t).catatan.push(c);
  }
  return [...kelompok.values()];
}

// ---------- Pengingat bon lewat WhatsApp ----------

// Hanya catatan sejak bon terakhir kali lunas, supaya rinciannya menjumlah tepat ke sisa bon
export function rincianBon(catatan, pelangganId) {
  const urut = catatan.filter((c) => !c.deleted && c.pelanggan_id === pelangganId && (c.ke === "bon" || c.dari === "bon")).sort((a, b) => a.waktu - b.waktu);
  let sisa = 0;
  let mulai = 0;
  urut.forEach((c, i) => {
    sisa += c.ke === "bon" ? c.nominal : -c.nominal;
    if (sisa === 0) mulai = i + 1;
  });
  return urut.slice(mulai);
}

function namaBarisBon(c) {
  if (c.dari === "bon") return "Bayar";
  if (c.dari === "pemilik") return "Bon lama";
  if (c.dari === "laci") return "Pinjam uang";
  return (c.item || []).map((b) => b.nama).join(", ") || c.keterangan || "Belanja";
}

export function pesanBon({ namaWarung, nama, bon, rincian }) {
  const baris = rincian.map((c) => {
    const nominal = c.dari === "bon" ? `−Rp ${ribuan(c.nominal)}` : `Rp ${ribuan(c.nominal)}`;
    return `${labelTanggalPendek(tanggalCatatan(c))}  ${namaBarisBon(c)}  ${nominal}`;
  });
  return [`Halo ${nama}, ini dari ${namaWarung}.`, `Bon kamu sekarang *Rp ${ribuan(bon)}*:`, "", ...baris, "", "Terima kasih."].join("\n");
}

// Sub-judul baris: "09.30" untuk hari ini, atau "2 Nov"
export function labelTanggalAtauJam(c, kini = hariIni()) {
  return tanggalCatatan(c) === kini ? jamDariMs(c.waktu) : labelTanggalPendek(tanggalCatatan(c));
}
