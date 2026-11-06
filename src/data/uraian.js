// uraian.js: mengubah catatan menjadi kalimat untuk layar (fungsi murni).

import { arahStok, rincianUntung, tanggalCatatan } from "./hitung.js";
import { ribuan } from "./format.js";
import { hariIni } from "./tanggal.js";

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
