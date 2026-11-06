// BarisCatatan.jsx: satu catatan di daftar. Ditekan membuka lembar Rincian.
// kiri = teks di kiri (misalnya jam). Kalau kosong, tampil ikon. sub = teks kecil di bawah judul.
import { uraiCatatan } from "../data/uraian.js";
import gaya from "./BarisCatatan.module.css";

const GAMBAR = {
  masuk: <path d="M12 19V5M6 11l6-6 6 6" />,
  keluar: <path d="M12 5v14M6 13l6 6 6-6" />,
  netral: <circle cx="12" cy="12" r="6" />,
};

export default function BarisCatatan({ catatan, nama, kiri, sub, onBuka }) {
  const u = uraiCatatan(catatan, nama);
  return (
    <button type="button" className={gaya.baris} onClick={() => onBuka(catatan)}>
      {kiri ? (
        <span className={gaya.jam}>{kiri}</span>
      ) : (
        <span className={`${gaya.ikon} ${gaya[u.tanda]}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {GAMBAR[u.tanda]}
          </svg>
        </span>
      )}
      <span className={gaya.teks}>
        <span className={gaya.judul}>{u.judul}</span>
        {sub && <small>{sub}</small>}
      </span>
      <strong className={gaya[`angka_${u.tanda}`]}>{u.angka}</strong>
    </button>
  );
}
