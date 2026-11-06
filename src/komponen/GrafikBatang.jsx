// GrafikBatang.jsx: grafik batang SVG buatan sendiri. Batang tumbuh saat muncul.
// data = [{ label, nilai, sorot, kini }]. nilai null berarti belum terjadi (kosong).
import { m } from "motion/react";
import { formatRupiah } from "../data/format.js";
import gaya from "./GrafikBatang.module.css";

const LEBAR = 300;
const TINGGI = 80;
const SELA = 8;
const STUB = 6; // batang pendek untuk hari yang belum terjadi

export default function GrafikBatang({ data, label }) {
  const terbesar = Math.max(1, ...data.map((d) => Math.abs(d.nilai ?? 0)));
  const lebarBatang = (LEBAR - SELA * (data.length - 1)) / data.length;
  const ringkas = data.map((d) => `${d.label}: ${d.nilai === null ? "belum ada" : formatRupiah(d.nilai)}`).join(", ");

  return (
    <div className={gaya.grafik}>
      <svg viewBox={`0 0 ${LEBAR} ${TINGGI}`} className={gaya.svg} role="img" aria-label={`${label}. ${ringkas}`}>
        {data.map((d, i) => {
          const tinggi = d.nilai === null ? STUB : Math.max(STUB, (Math.abs(d.nilai) / terbesar) * TINGGI);
          const warna = d.nilai === null ? "#ecebe6" : d.nilai < 0 ? "#eab49e" : d.sorot ? "#4f7d65" : "#cfe3d6";
          return (
            <m.rect
              key={d.label}
              x={i * (lebarBatang + SELA)}
              y={TINGGI - tinggi}
              width={lebarBatang}
              height={tinggi}
              rx="7"
              fill={warna}
              stroke={d.kini ? "#7fb898" : "none"}
              strokeWidth={d.kini ? 2 : 0}
              style={{ transformBox: "fill-box", transformOrigin: "bottom" }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.25, delay: i * 0.02, ease: "easeOut" }}
            />
          );
        })}
      </svg>
      <div className={gaya.label} style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
        {data.map((d) => (
          <span key={d.label} className={d.sorot ? gaya.labelSorot : undefined}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
