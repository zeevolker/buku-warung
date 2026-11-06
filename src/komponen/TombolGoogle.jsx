// TombolGoogle.jsx: masuk dengan Google. Tidak tampil di aplikasi layar utama iPhone.
import { useState } from "react";
import { masukGoogle, iphoneLayarUtama } from "../data/akun.js";
import bersama from "./lembar/bersama.module.css";
import gaya from "./TombolGoogle.module.css";

export default function TombolGoogle() {
  const [galat, setGalat] = useState("");
  if (iphoneLayarUtama()) return null;

  async function tekan() {
    setGalat("");
    const hasil = await masukGoogle();
    if (hasil.galat) setGalat(hasil.galat);
  }

  return (
    <>
      <button type="button" className={gaya.tombol} onClick={tekan}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8Z" />
          <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23Z" />
          <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 10l3.7-2.9Z" />
          <path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4Z" />
        </svg>
        Masuk dengan Google
      </button>
      <p className={bersama.galat} role="alert">
        {galat}
      </p>
    </>
  );
}
