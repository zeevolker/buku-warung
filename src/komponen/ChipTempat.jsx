// ChipTempat.jsx: label tempat berwarna. Laci hijau, Bon kuning, Stok biru, luar warung abu-abu.
import gaya from "./ChipTempat.module.css";

const NAMA = {
  laci: "Laci",
  bon: "Bon",
  stok: "Stok",
  pembeli: "Pembeli",
  agen: "Agen",
  biaya: "Biaya",
  pemilik: "Pemilik",
  selisih: "Selisih",
};

// Tempat lain (pembeli, agen, biaya, pemilik, selisih) ada di luar warung: abu-abu
const WARNA = { laci: gaya.laci, bon: gaya.bon, stok: gaya.stok };

// namaPelanggan hanya untuk bon: tampil sebagai "Bon: Budi"
export default function ChipTempat({ tempat, namaPelanggan }) {
  const warna = WARNA[tempat] || gaya.luar;
  const teks = tempat === "bon" && namaPelanggan ? `Bon: ${namaPelanggan}` : NAMA[tempat] || tempat;
  return <span className={`${gaya.chip} ${warna}`}>{teks}</span>;
}
