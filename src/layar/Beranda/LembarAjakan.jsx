// LembarAjakan.jsx: mode tamu, setelah beberapa catatan: ajak menyimpan ke cloud.
import { useNavigate } from "react-router";
import Lembar from "../../komponen/Lembar.jsx";
import TombolGoogle from "../../komponen/TombolGoogle.jsx";
import bersama from "../../komponen/lembar/bersama.module.css";
import gaya from "./LembarAjakan.module.css";

export default function LembarAjakan({ terbuka, jumlah, onNanti }) {
  const pindah = useNavigate();
  return (
    <Lembar terbuka={terbuka} onTutup={onNanti} judul={`Sudah ${jumlah} catatan`}>
      <div className={bersama.susun}>
        <p className={gaya.pesan}>Simpan ke cloud supaya tidak hilang kalau HP rusak atau ganti HP.</p>
        <TombolGoogle />
        <button type="button" className={bersama.simpan} onClick={() => pindah("/masuk")}>
          Masuk dengan email
        </button>
        <button type="button" className={bersama.tautan} onClick={onNanti}>
          Nanti saja
        </button>
      </div>
    </Lembar>
  );
}
