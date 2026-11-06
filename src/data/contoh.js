// contoh.js: data untuk mencoba aplikasi saat pengembangan. Tidak tampil di versi jadi.
import { tambahBarang, tambahPelanggan, uangAwal } from "./aksi.js";

export async function isiDataContoh() {
  await uangAwal(500000);
  const barang = [
    { nama: "Indomie", harga_jual: 3500, harga_beli: 3000, stok: 40 },
    { nama: "Teh botol", harga_jual: 7500, harga_beli: 6000, stok: 24 },
    { nama: "Kopi", harga_jual: 2000, harga_beli: 1500, stok: 3 },
    { nama: "Gula", harga_jual: 17000, harga_beli: 15000, stok: 10 },
    { nama: "Rokok Surya", harga_jual: 34000, harga_beli: 31000, stok: 12 },
    { nama: "Minyak goreng", harga_jual: 18000, harga_beli: 15500, stok: 8 },
    { nama: "Beras", harga_jual: 16000, harga_beli: 14000, stok: 20 },
  ];
  for (const b of barang) await tambahBarang({ ...b, asal: "rak" });
  await tambahPelanggan({ nama: "Budi", bonLama: 45000 });
  await tambahPelanggan({ nama: "Sari", bonLama: 120000 });
  await tambahPelanggan({ nama: "Pak Dedi" });
}
