// Lembar.jsx: lembar yang muncul dari bawah dan bisa ditarik turun untuk menutup.
//
// Pakai: <Lembar terbuka={buka} onTutup={() => setBuka(false)} judul="Jual">isi</Lembar>
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m, useDragControls } from "motion/react";
import gaya from "./Lembar.module.css";

// Ditarik sejauh ini (px) atau secepat ini (px/detik) berarti ingin menutup
const JARAK_TUTUP = 100;
const LAJU_TUTUP = 500;

function IsiLembar({ onTutup, judul, children }) {
  const kotak = useRef(null);
  const kendaliTarik = useDragControls();

  useEffect(() => {
    // Pindahkan fokus ke lembar, dan kembalikan ke tombol asalnya saat ditutup
    const fokusAsal = document.activeElement;
    kotak.current?.focus();
    // Halaman di belakang tidak ikut bergulir
    const luapanAsal = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = luapanAsal;
      fokusAsal?.focus?.();
    };
  }, []);

  function saatTombol(e) {
    if (e.key === "Escape") onTutup();
    if (e.key !== "Tab") return;
    // Tombol Tab berputar di dalam lembar saja
    const bisaFokus = kotak.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!bisaFokus.length) return e.preventDefault();
    const pertama = bisaFokus[0];
    const terakhir = bisaFokus[bisaFokus.length - 1];
    if (e.shiftKey && (document.activeElement === pertama || document.activeElement === kotak.current)) {
      e.preventDefault();
      terakhir.focus();
    } else if (!e.shiftKey && document.activeElement === terakhir) {
      e.preventDefault();
      pertama.focus();
    }
  }

  return (
    <>
      <m.div className={gaya.latar} onClick={onTutup} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
      <m.div
        ref={kotak}
        className={gaya.lembar}
        role="dialog"
        aria-modal="true"
        aria-label={judul}
        tabIndex={-1}
        onKeyDown={saatTombol}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "tween", ease: "easeOut", duration: 0.22 }}
        drag="y"
        dragListener={false}
        dragControls={kendaliTarik}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.8 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > JARAK_TUTUP || info.velocity.y > LAJU_TUTUP) onTutup();
        }}
      >
        {/* Hanya pegangan ini yang bisa ditarik, supaya isi lembar tetap bisa digulir */}
        <div className={gaya.pegangan} onPointerDown={(e) => kendaliTarik.start(e)}>
          <span />
        </div>
        {judul && <h2 className={gaya.judul}>{judul}</h2>}
        <div className={gaya.isi}>{children}</div>
      </m.div>
    </>
  );
}

export default function Lembar({ terbuka, onTutup, judul, children }) {
  return createPortal(
    <AnimatePresence>
      {terbuka && (
        <IsiLembar key="lembar" onTutup={onTutup} judul={judul}>
          {children}
        </IsiLembar>
      )}
    </AnimatePresence>,
    document.body
  );
}
