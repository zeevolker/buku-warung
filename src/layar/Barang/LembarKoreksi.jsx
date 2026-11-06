// LembarKoreksi.jsx: mencocokkan stok dengan jumlah di rak.
import { useRef, useState } from "react";
import Lembar from "../../komponen/Lembar.jsx";
import Geser from "../../komponen/Geser.jsx";
import Rute from "../../komponen/Rute.jsx";
import { koreksiStok } from "../../data/aksi.js";
import { formatRupiah } from "../../data/format.js";
import bersama from "../../komponen/lembar/bersama.module.css";
import gaya from "./Barang.module.css";

const ALASAN = [
  { nilai: "Rusak", label: "Rusak" },
  { nilai: "Hilang", label: "Hilang" },
  { nilai: "Dipakai", label: "Dipakai" },
];

function IsiKoreksi({ barang, stok, onTutup, onTersimpan }) {
  const [jumlah, setJumlah] = useState("");
  const [alasan, setAlasan] = useState("Rusak");
  const [galat, setGalat] = useState("");

  const sebenarnya = jumlah === "" ? null : Number(jumlah);
  const selisih = sebenarnya === null ? 0 : sebenarnya - stok;
  const harga = barang.harga_beli || 0;
  const nilai = Math.abs(selisih) * harga;

  async function simpan() {
    setGalat("");
    const hasil = await koreksiStok(barang.id, sebenarnya, selisih < 0 ? alasan : "");
    if (hasil.galat) return setGalat(hasil.galat);
    onTersimpan(`Stok ${barang.nama} sekarang ${sebenarnya}`);
    onTutup();
  }

  return (
    <div className={bersama.susun}>
      <span className={gaya.nama}>
        <span>{barang.nama}</span>
      </span>
      <div className={`${bersama.kartu} ${gaya.barisStok}`}>
        <span>Menurut catatan</span>
        <strong>{stok}</strong>
      </div>
      <label className={gaya.labelTengah}>
        Jumlah di rak sebenarnya
        <input className={gaya.jumlahBesar} type="number" inputMode="numeric" min="0" step="1" value={jumlah} onChange={(e) => setJumlah(e.target.value)} />
      </label>

      {selisih < 0 && <Geser label="Alasan" pilihan={ALASAN} nilai={alasan} onUbah={setAlasan} warna="var(--teks)" />}

      <p className={bersama.galat} role="alert">
        {galat}
      </p>

      {selisih !== 0 && (
        <div className={bersama.kartuRute}>
          <div className={bersama.barisRute}>
            {selisih < 0 ? <Rute dari="stok" ke="biaya" /> : <Rute dari="pemilik" ke="stok" />}
            <span className={gaya.nilaiKoreksi}>
              <strong>{formatRupiah(selisih < 0 ? -nilai : nilai)}</strong>
              <span>
                {Math.abs(selisih)} × {formatRupiah(harga)}
              </span>
            </span>
          </div>
        </div>
      )}

      <button type="button" className={bersama.simpan} disabled={selisih === 0} onClick={simpan}>
        Simpan
      </button>
    </div>
  );
}

// barang = barang yang dikoreksi, atau kosong kalau lembar tertutup
export default function LembarKoreksi({ barang, stok, onTutup, onTersimpan }) {
  // Disimpan supaya isi lembar tidak hilang selama animasi menutup
  const terakhir = useRef(barang);
  if (barang) terakhir.current = barang;
  return (
    <Lembar terbuka={Boolean(barang)} onTutup={onTutup} judul="Koreksi stok">
      {terakhir.current && <IsiKoreksi key={terakhir.current.id} barang={terakhir.current} stok={stok} onTutup={onTutup} onTersimpan={onTersimpan} />}
    </Lembar>
  );
}
