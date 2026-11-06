// PitaStatus.jsx: pita di Beranda saat data belum tersimpan di cloud.
import { sinkronSekarang } from "../../data/akun.js";
import gaya from "./PitaStatus.module.css";

export default function PitaStatus({ akun }) {
  if (!akun.email) return null;
  if (akun.keadaan === "offline" && akun.belum > 0) {
    return (
      <div className={gaya.kuning} role="status">
        {akun.belum} catatan tersimpan di HP. Terkirim saat ada sinyal.
      </div>
    );
  }
  if (akun.keadaan === "gagal") {
    return (
      <div className={gaya.merah} role="status">
        <span>Gagal kirim ke cloud. Data tetap aman di HP.</span>
        <button type="button" onClick={() => sinkronSekarang()}>
          Coba lagi
        </button>
      </div>
    );
  }
  return null;
}
