// InputRupiah.jsx: kolom uang. Saat diketik otomatis jadi "Rp 15.000".
// nilai berupa angka, atau null kalau kosong (supaya kosong beda dengan Rp 0).
import { ribuan } from "../data/format.js";
import gaya from "./InputRupiah.module.css";

export default function InputRupiah({ nilai, onUbah, label, besar = false, ref }) {
  function saatKetik(e) {
    const angka = e.target.value.replace(/\D/g, "").slice(0, 13);
    onUbah(angka === "" ? null : Number(angka));
  }
  return (
    <input
      ref={ref}
      className={besar ? `${gaya.input} ${gaya.besar}` : gaya.input}
      inputMode="numeric"
      autoComplete="off"
      aria-label={label}
      placeholder="Rp 0"
      value={nilai === null || nilai === undefined ? "" : `Rp ${ribuan(nilai)}`}
      onChange={saatKetik}
    />
  );
}
