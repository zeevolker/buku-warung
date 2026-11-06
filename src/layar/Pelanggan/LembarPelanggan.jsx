// LembarPelanggan.jsx: tambah pelanggan baru, atau ubah nama dan nomor pelanggan.
import { useState } from "react";
import Lembar from "../../komponen/Lembar.jsx";
import Rute from "../../komponen/Rute.jsx";
import InputRupiah from "../../komponen/InputRupiah.jsx";
import { tambahPelanggan, ubahPelanggan } from "../../data/aksi.js";
import bersama from "../../komponen/lembar/bersama.module.css";
import umum from "../../komponen/umum.module.css";

function IsiPelanggan({ pelanggan, onTutup, onTersimpan }) {
  const [nama, setNama] = useState(pelanggan?.nama || "");
  const [noWa, setNoWa] = useState(pelanggan?.no_wa || "");
  const [bonLama, setBonLama] = useState(null);
  const [galat, setGalat] = useState("");

  async function simpan() {
    setGalat("");
    const hasil = pelanggan ? await ubahPelanggan(pelanggan.id, { nama, no_wa: noWa }) : await tambahPelanggan({ nama, no_wa: noWa, bonLama: bonLama || 0 });
    if (hasil.galat) return setGalat(hasil.galat);
    onTersimpan(pelanggan ? "Tersimpan" : `${nama.trim()} ditambahkan`);
    onTutup();
  }

  return (
    <div className={bersama.susun}>
      <label className={umum.bidang}>
        Nama
        <input className={bersama.input} autoComplete="off" value={nama} onChange={(e) => setNama(e.target.value)} />
      </label>
      <label className={umum.bidang}>
        Nomor WhatsApp (boleh kosong)
        <input className={bersama.input} type="tel" autoComplete="off" value={noWa} onChange={(e) => setNoWa(e.target.value)} />
      </label>
      {!pelanggan && (
        <label className={umum.bidang}>
          Bon lama yang belum dicatat
          <InputRupiah label="Bon lama yang belum dicatat" nilai={bonLama} onUbah={setBonLama} />
        </label>
      )}
      <p className={bersama.galat} role="alert">
        {galat}
      </p>
      {!pelanggan && bonLama > 0 && (
        <div className={bersama.kartuRute}>
          <Rute dari="pemilik" ke="bon" namaPelanggan={nama.trim()} nominal={bonLama} />
        </div>
      )}
      <button type="button" className={bersama.simpan} onClick={simpan}>
        Simpan
      </button>
    </div>
  );
}

export default function LembarPelanggan({ terbuka, pelanggan, onTutup, onTersimpan }) {
  return (
    <Lembar terbuka={terbuka} onTutup={onTutup} judul={pelanggan ? "Ubah pelanggan" : "Tambah pelanggan"}>
      <IsiPelanggan pelanggan={pelanggan} onTutup={onTutup} onTersimpan={onTersimpan} />
    </Lembar>
  );
}
