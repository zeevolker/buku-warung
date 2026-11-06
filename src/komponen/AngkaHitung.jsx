// AngkaHitung.jsx: rupiah yang berubah dengan animasi hitung (cepat, tidak lebih dari 250 ms).
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { formatRupiah } from "../data/format.js";

const LAMA = 250;

export default function AngkaHitung({ nilai }) {
  const [tampil, setTampil] = useState(nilai);
  const sebelumnya = useRef(nilai);
  const tanpaGerak = useReducedMotion();

  useEffect(() => {
    const dari = sebelumnya.current;
    sebelumnya.current = nilai;
    if (tanpaGerak || dari === nilai) {
      setTampil(nilai);
      return;
    }
    let mulai = null;
    let bingkai;
    function langkah(kini) {
      mulai ??= kini;
      const maju = Math.min(1, (kini - mulai) / LAMA);
      const halus = 1 - (1 - maju) * (1 - maju); // melambat di akhir
      setTampil(maju === 1 ? nilai : Math.round(dari + (nilai - dari) * halus));
      if (maju < 1) bingkai = requestAnimationFrame(langkah);
    }
    bingkai = requestAnimationFrame(langkah);
    // Tab tersembunyi tidak menjalankan animasi: pastikan angka akhirnya tetap benar
    const cadangan = setTimeout(() => {
      cancelAnimationFrame(bingkai);
      setTampil(nilai);
    }, LAMA + 100);
    return () => {
      cancelAnimationFrame(bingkai);
      clearTimeout(cadangan);
    };
  }, [nilai, tanpaGerak]);

  return formatRupiah(tampil);
}
