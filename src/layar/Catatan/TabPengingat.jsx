// TabPengingat.jsx: daftar centang dengan tanggal dan jam yang boleh kosong.
import { useState } from "react";
import { useSekarang } from "../../data/pakai.js";
import { tambahPengingat, tandaiPengingat, hapusPengingat } from "../../data/aksi.js";
import { formatTanggal, jamDariMs, labelTanggal } from "../../data/tanggal.js";
import bersama from "../../komponen/lembar/bersama.module.css";
import umum from "../../komponen/umum.module.css";
import gaya from "./Catatan.module.css";

const labelWaktuIngat = (ms) => `${labelTanggal(formatTanggal(new Date(ms)))}, ${jamDariMs(ms)}`;

function BarisPengingat({ p, lewat }) {
  return (
    <li className={gaya.baris}>
      <label className={gaya.centang}>
        <input type="checkbox" checked={p.selesai} onChange={(e) => tandaiPengingat(p.id, e.target.checked)} />
        <span className={p.selesai ? gaya.teksSelesai : gaya.teks}>
          <span>{p.teks}</span>
          {p.waktu_ingat && <small className={lewat ? gaya.lewat : undefined}>{labelWaktuIngat(p.waktu_ingat)}</small>}
        </span>
      </label>
      <button type="button" className={gaya.hapus} aria-label={`Hapus ${p.teks}`} onClick={() => hapusPengingat(p.id)}>
        ×
      </button>
    </li>
  );
}

export default function TabPengingat({ daftar }) {
  const sekarang = useSekarang();
  const [teks, setTeks] = useState("");
  const [waktu, setWaktu] = useState("");
  const [galat, setGalat] = useState("");

  const belum = daftar.filter((p) => !p.selesai).sort((a, b) => (a.waktu_ingat || Infinity) - (b.waktu_ingat || Infinity) || b.created_at - a.created_at);
  const selesai = daftar.filter((p) => p.selesai).sort((a, b) => b.updated_at - a.updated_at);

  async function tambah(e) {
    e.preventDefault();
    const hasil = await tambahPengingat({ teks, waktu_ingat: waktu ? new Date(waktu).getTime() : null });
    if (hasil.galat) return setGalat(hasil.galat);
    setTeks("");
    setWaktu("");
    setGalat("");
  }

  return (
    <>
      <form className={gaya.formTambah} onSubmit={tambah}>
        <input className={bersama.input} aria-label="Pengingat baru" placeholder="Ingatkan aku untuk…" autoComplete="off" value={teks} onChange={(e) => setTeks(e.target.value)} />
        <button type="submit" className={gaya.tombolTambah} aria-label="Tambah pengingat">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        {teks.trim() && (
          <label className={`${umum.bidang} ${gaya.bidangWaktu}`}>
            Tanggal dan jam (boleh kosong)
            <input className={bersama.input} type="datetime-local" value={waktu} onChange={(e) => setWaktu(e.target.value)} />
          </label>
        )}
      </form>
      <p className={bersama.galat} role="alert">
        {galat}
      </p>

      {belum.length > 0 ? (
        <ul className={`${umum.kartu} ${umum.daftarPolos}`}>
          {belum.map((p) => (
            <BarisPengingat key={p.id} p={p} lewat={p.waktu_ingat && p.waktu_ingat <= sekarang} />
          ))}
        </ul>
      ) : (
        <p className={umum.kosong}>Belum ada pengingat.</p>
      )}

      {selesai.length > 0 && (
        <>
          <h2 className={umum.judulKecil}>Selesai</h2>
          <ul className={`${umum.kartu} ${umum.daftarPolos}`}>
            {selesai.map((p) => (
              <BarisPengingat key={p.id} p={p} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}
