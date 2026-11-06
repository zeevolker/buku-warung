// LembarSuara.jsx: "Mendengarkan…" dengan lingkaran berdenyut, dan "Belum paham" kalau tidak dimengerti.
import { m } from "motion/react";
import Lembar from "../Lembar.jsx";
import bersama from "./bersama.module.css";
import gaya from "./LembarSuara.module.css";

const CONTOH = ["Budi bayar 20 ribu", "belanja gula 65 ribu", "Sari ngebon kopi"];
const CONTOH_GAGAL = ["jual 2 indomie", "Budi bayar 20 ribu"];

function Contoh({ daftar }) {
  return (
    <div className={gaya.contoh}>
      {daftar.map((c) => (
        <span key={c}>“{c}”</span>
      ))}
    </div>
  );
}

function Mendengarkan({ teks, onSelesai }) {
  return (
    <div className={gaya.susun}>
      <div className={gaya.lingkaran} aria-hidden="true">
        <m.span className={gaya.luar} animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }} />
        <m.span className={gaya.tengah} animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: 0.15 }} />
        <span className={gaya.inti}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </span>
      </div>
      <p className={gaya.teks} aria-live="polite">
        {teks ? `“${teks}”` : "Silakan bicara…"}
      </p>
      <Contoh daftar={CONTOH} />
      <button type="button" className={gaya.selesai} onClick={onSelesai}>
        Selesai
      </button>
    </div>
  );
}

function BelumPaham({ teks, onKetik, onCobaLagi }) {
  return (
    <div className={gaya.susun}>
      <span className={gaya.tanya} aria-hidden="true">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#b5583a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5M12 17h.01" />
        </svg>
      </span>
      <span className={gaya.ucapan}>“{teks}”</span>
      <span className={gaya.judulContoh}>Coba sebut seperti ini:</span>
      <Contoh daftar={CONTOH_GAGAL} />
      <div className={bersama.duaTombol} style={{ width: "100%" }}>
        <button type="button" className={gaya.selesai} onClick={onKetik}>
          Ketik manual
        </button>
        <button type="button" className={bersama.simpan} onClick={onCobaLagi}>
          Coba lagi
        </button>
      </div>
    </div>
  );
}

// belumPaham = teks yang tidak dimengerti, atau kosong kalau sedang mendengarkan
export default function LembarSuara({ terbuka, teks, belumPaham, onSelesai, onBatal, onKetik, onCobaLagi }) {
  return (
    <Lembar terbuka={terbuka} onTutup={onBatal} judul={belumPaham ? "Belum paham" : "Mendengarkan…"}>
      {belumPaham ? <BelumPaham teks={belumPaham} onKetik={onKetik} onCobaLagi={onCobaLagi} /> : <Mendengarkan teks={teks} onSelesai={onSelesai} />}
    </Lembar>
  );
}
