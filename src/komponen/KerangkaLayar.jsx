// KerangkaLayar.jsx: bungkus layar. Judul dan jarak tepi yang sama di semua layar.
// kembali = alamat tombol kembali (boleh kosong); aksi = tombol di kanan judul (boleh kosong).
import { Link } from "react-router";
import gaya from "./KerangkaLayar.module.css";

export default function KerangkaLayar({ judul, kembali, aksi, children }) {
  return (
    <div className={gaya.layar}>
      <header className={gaya.kepala}>
        {kembali && (
          <Link to={kembali} className={gaya.kembali} aria-label="Kembali">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
        )}
        <h1 className={gaya.judul}>{judul}</h1>
        {aksi}
      </header>
      {children}
    </div>
  );
}
