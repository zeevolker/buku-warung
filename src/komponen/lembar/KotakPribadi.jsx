// KotakPribadi.jsx: kotak kuning saat belanja melebihi isi laci.
import { formatRupiah } from "../../data/format.js";
import bersama from "./bersama.module.css";

export default function KotakPribadi({ laci, kekurangan, onYa, onUbah }) {
  return (
    <div className={bersama.kotakKuning}>
      <div>
        <strong>Laci cuma {formatRupiah(laci)}</strong>
        Sisanya {formatRupiah(kekurangan)} pakai uang pribadi?
      </div>
      <div className={bersama.duaTombol}>
        <button type="button" className={bersama.tombolYa} onClick={onYa}>
          Ya, pakai
        </button>
        <button type="button" className={bersama.tombolUbah} onClick={onUbah}>
          Ubah jumlah
        </button>
      </div>
    </div>
  );
}
