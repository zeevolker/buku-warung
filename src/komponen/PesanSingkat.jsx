// PesanSingkat.jsx: pesan kecil setelah menyimpan, hilang sendiri.
// Pakai: const { pesan, tampilkanPesan } = usePesan(); lalu <PesanSingkat pesan={pesan} />
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import gaya from "./PesanSingkat.module.css";

const LAMA_PESAN = 2500;

export function usePesan() {
  const [pesan, setPesan] = useState("");
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  function tampilkanPesan(teks) {
    setPesan(teks);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPesan(""), LAMA_PESAN);
  }
  return { pesan, tampilkanPesan };
}

export default function PesanSingkat({ pesan }) {
  return (
    <AnimatePresence>
      {pesan && (
        <m.p className={gaya.pesan} role="status" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          {pesan}
        </m.p>
      )}
    </AnimatePresence>
  );
}
