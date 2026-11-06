// LembarHitungUlang.jsx: mencocokkan isi laci dengan uang fisik. Selisihnya dicatat.
import { useState } from "react";
import Lembar from "../Lembar.jsx";
import Rute from "../Rute.jsx";
import InputRupiah from "../InputRupiah.jsx";
import { useIsi } from "../../data/pakai.js";
import { hitungUlangLaci } from "../../data/aksi.js";
import { formatRupiah } from "../../data/format.js";
import bersama from "./bersama.module.css";
import gaya from "./LembarHitungUlang.module.css";

function IsiHitungUlang({ onTutup, onTersimpan }) {
  const isi = useIsi();
  const [uang, setUang] = useState(null);
  const [galat, setGalat] = useState("");
  const menurutCatatan = isi?.laci || 0;
  const selisih = uang === null ? 0 : uang - menurutCatatan;

  async function cocokkan() {
    setGalat("");
    const hasil = await hitungUlangLaci(uang);
    if (hasil.galat) return setGalat(hasil.galat);
    onTersimpan(selisih === 0 ? "Isi laci sudah cocok" : `Isi laci sekarang ${formatRupiah(uang)}`);
    onTutup();
  }

  // Tunggu isi laci dan stok dimuat, supaya tidak sempat tampil "Rp 0" atau "Stok habis" yang keliru
  if (!isi) return null;

  return (
    <div className={bersama.susun}>
      <div className={`${bersama.kartu} ${gaya.baris}`}>
        <span>Menurut catatan</span>
        <strong>{formatRupiah(menurutCatatan)}</strong>
      </div>
      <label className={gaya.label}>
        Uang di laci sebenarnya
        <InputRupiah label="Uang di laci sebenarnya" besar nilai={uang} onUbah={setUang} />
      </label>
      <p className={bersama.galat} role="alert">
        {galat}
      </p>
      {uang !== null && selisih !== 0 && (
        <div className={bersama.kartuRute}>
          {selisih < 0 ? <Rute dari="laci" ke="selisih" nominal={selisih} /> : <Rute dari="selisih" ke="laci" nominal={selisih} />}
        </div>
      )}
      <button type="button" className={bersama.simpan} disabled={uang === null} onClick={cocokkan}>
        Cocokkan
      </button>
    </div>
  );
}

export default function LembarHitungUlang({ terbuka, onTutup, onTersimpan }) {
  return (
    <Lembar terbuka={terbuka} onTutup={onTutup} judul="Hitung ulang laci">
      <IsiHitungUlang onTutup={onTutup} onTersimpan={onTersimpan} />
    </Lembar>
  );
}
