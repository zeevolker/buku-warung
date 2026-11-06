// AngkaHitung.jsx: rupiah yang berubah dengan animasi hitung (cepat, tidak lebih dari 250 ms).
import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
import { formatRupiah } from "../data/format.js";

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
    const gerak = animate(dari, nilai, { duration: 0.25, ease: "easeOut", onUpdate: (n) => setTampil(Math.round(n)), onComplete: () => setTampil(nilai) });
    return () => gerak.stop();
  }, [nilai, tanpaGerak]);

  return formatRupiah(tampil);
}
