// Beranda.jsx: masih kerangka. Layar sebenarnya dibuat di Tahap 2.
// Tombol dan contoh di bawah hanya untuk mencoba komponen bersama, nanti dihapus.
import { useState } from "react";
import KerangkaLayar from "../../komponen/KerangkaLayar.jsx";
import Lembar from "../../komponen/Lembar.jsx";
import ChipTempat from "../../komponen/ChipTempat.jsx";
import Rute from "../../komponen/Rute.jsx";
import gaya from "./Beranda.module.css";

export default function Beranda() {
  const [buka, setBuka] = useState(false);
  return (
    <KerangkaLayar judul="Beranda">
      <div className={gaya.deret}>
        <ChipTempat tempat="laci" />
        <ChipTempat tempat="bon" namaPelanggan="Budi" />
        <ChipTempat tempat="stok" />
        <ChipTempat tempat="pembeli" />
      </div>
      <button type="button" className={gaya.tombol} onClick={() => setBuka(true)}>
        Coba lembar
      </button>
      <Lembar terbuka={buka} onTutup={() => setBuka(false)} judul="Contoh lembar">
        <p className={gaya.teks}>Tarik pegangan di atas ke bawah untuk menutup.</p>
        <Rute dari="pembeli" ke="laci" nominal={15000} />
      </Lembar>
    </KerangkaLayar>
  );
}
