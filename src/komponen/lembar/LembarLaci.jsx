// LembarLaci.jsx: uang awal (pemilik → laci) atau ambil pribadi (laci → pemilik).
import { useState } from "react";
import Lembar from "../Lembar.jsx";
import Geser from "../Geser.jsx";
import Rute from "../Rute.jsx";
import InputRupiah from "../InputRupiah.jsx";
import { uangAwal, ambilPribadi } from "../../data/aksi.js";
import { formatRupiah } from "../../data/format.js";
import bersama from "./bersama.module.css";

function IsiLaci({ onTutup, onTersimpan, onHitungUlang }) {
  const [jenis, setJenis] = useState("awal");
  const [nominal, setNominal] = useState(null);
  const [galat, setGalat] = useState("");

  async function simpan() {
    setGalat("");
    const hasil = await (jenis === "awal" ? uangAwal(nominal) : ambilPribadi(nominal));
    if (hasil.galat) return setGalat(hasil.galat);
    onTersimpan(`Tersimpan: ${jenis === "awal" ? "uang masuk" : "ambil pribadi"} ${formatRupiah(nominal)}`);
    onTutup();
  }

  return (
    <div className={bersama.susun}>
      <Geser
        label="Jenis"
        pilihan={[
          { nilai: "awal", label: "Uang awal" },
          { nilai: "ambil", label: "Ambil pribadi" },
        ]}
        nilai={jenis}
        onUbah={setJenis}
      />
      <InputRupiah label="Jumlah" besar nilai={nominal} onUbah={setNominal} />
      <p className={bersama.galat} role="alert">
        {galat}
      </p>
      <div className={bersama.kartuRute}>{jenis === "awal" ? <Rute dari="pemilik" ke="laci" /> : <Rute dari="laci" ke="pemilik" />}</div>
      <button type="button" className={bersama.simpan} disabled={!(nominal > 0)} onClick={simpan}>
        Simpan
      </button>
      <button type="button" className={bersama.tautan} onClick={onHitungUlang}>
        Isi laci tidak cocok? Hitung ulang
      </button>
    </div>
  );
}

export default function LembarLaci({ terbuka, onTutup, onTersimpan, onHitungUlang }) {
  return (
    <Lembar terbuka={terbuka} onTutup={onTutup} judul="Laci">
      <IsiLaci onTutup={onTutup} onTersimpan={onTersimpan} onHitungUlang={onHitungUlang} />
    </Lembar>
  );
}
