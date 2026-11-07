// LembarUnduh.jsx: pilih Excel atau PDF. Semuanya dibuat di HP, tanpa server.
// PDF membuka halaman cetak, lalu disimpan lewat dialog cetak bawaan browser.
import { useState } from "react";
import { useNavigate } from "react-router";
import Lembar from "../../komponen/Lembar.jsx";
import { buatExcel, simpanFile } from "../../data/unduh.js";
import bersama from "../../komponen/lembar/bersama.module.css";
import gaya from "./Laporan.module.css";

function IsiUnduh({ judul, namaPeriode, catatan, namaDari, alamatCetak, onTutup }) {
  const pindah = useNavigate();
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState("");

  async function unduh(buat, akhiran) {
    setProses(true);
    setGalat("");
    try {
      simpanFile(await buat(), `buku-warung-${namaPeriode}.${akhiran}`);
      onTutup();
    } catch (e) {
      console.error(e);
      setGalat("File belum bisa dibuat. Periksa internet kalau baru pertama kali mengunduh, lalu coba lagi.");
    } finally {
      setProses(false);
    }
  }

  return (
    <div className={bersama.susun}>
      <span className={gaya.subjudul}>{judul}</span>
      <button type="button" className={gaya.opsi} disabled={proses} onClick={() => unduh(() => buatExcel(catatan, namaDari), "xlsx")}>
        <span className={gaya.ikonOpsi} style={{ background: "var(--laci-latar)", color: "var(--laci-teks)" }}>
          XLSX
        </span>
        <span className={gaya.teksOpsi}>
          <strong>Excel</strong>
          <span>Semua catatan dalam tabel</span>
        </span>
      </button>
      <button type="button" className={gaya.opsi} disabled={proses} onClick={() => pindah(alamatCetak)}>
        <span className={gaya.ikonOpsi} style={{ background: "var(--keluar-latar)", color: "#a14d31" }}>
          PDF
        </span>
        <span className={gaya.teksOpsi}>
          <strong>PDF</strong>
          <span>Laporan lengkap, simpan lewat dialog cetak</span>
        </span>
      </button>
      <p className={bersama.galat} role="alert">
        {galat}
      </p>
    </div>
  );
}

export default function LembarUnduh({ terbuka, onTutup, ...isi }) {
  return (
    <Lembar terbuka={terbuka} onTutup={onTutup} judul="Unduh laporan">
      <IsiUnduh {...isi} onTutup={onTutup} />
    </Lembar>
  );
}
