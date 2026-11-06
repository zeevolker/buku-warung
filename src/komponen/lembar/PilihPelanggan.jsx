// PilihPelanggan.jsx: deret nama pelanggan, atau "+ Baru" untuk mengetik nama baru.
// Yang punya bon paling besar tampil lebih dulu.
import { useState } from "react";
import { useIsi } from "../../data/pakai.js";
import gaya from "./bersama.module.css";

const BATAS_TAMPIL = 8;

export default function PilihPelanggan({ daftar, terpilih, onPilih, namaBaru, onNamaBaru }) {
  const isi = useIsi();
  const [baru, setBaru] = useState(false);
  const bon = isi?.bon || {};
  const urut = [...daftar].sort((a, b) => (bon[b.id] || 0) - (bon[a.id] || 0) || a.nama.localeCompare(b.nama));
  const tampil = urut.slice(0, BATAS_TAMPIL);
  // Yang terpilih selalu terlihat walau bukan termasuk yang teratas
  const pilihan = urut.find((p) => p.id === terpilih);
  if (pilihan && !tampil.includes(pilihan)) tampil.push(pilihan);

  function pilih(id) {
    setBaru(false);
    onNamaBaru("");
    onPilih(id);
  }

  return (
    <>
      <div className={gaya.deret} role="group" aria-label="Pilih pelanggan">
        {tampil.map((p) => (
          <button key={p.id} type="button" className={p.id === terpilih ? `${gaya.chip} ${gaya.chipAktif}` : gaya.chip} aria-pressed={p.id === terpilih} onClick={() => pilih(p.id)}>
            {p.nama}
          </button>
        ))}
        <button
          type="button"
          className={gaya.chipBaru}
          aria-pressed={baru}
          onClick={() => {
            setBaru(true);
            onPilih(null);
          }}
        >
          + Baru
        </button>
      </div>
      {baru && <input className={gaya.input} aria-label="Nama pelanggan baru" placeholder="Nama pelanggan" autoComplete="off" value={namaBaru} onChange={(e) => onNamaBaru(e.target.value)} />}
    </>
  );
}
