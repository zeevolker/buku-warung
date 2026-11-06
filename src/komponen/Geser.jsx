// Geser.jsx: pilihan pendek berjajar, misalnya Tunai | Bon.
// pilihan = [{ nilai, label }]
import gaya from "./Geser.module.css";

export default function Geser({ pilihan, nilai, onUbah, label, warna = "var(--laci-teks)" }) {
  return (
    <div className={gaya.geser} style={{ gridTemplateColumns: `repeat(${pilihan.length}, minmax(0, 1fr))` }} role="group" aria-label={label}>
      {pilihan.map((p) => {
        const aktif = p.nilai === nilai;
        return (
          <button key={p.nilai} type="button" className={aktif ? `${gaya.tombol} ${gaya.aktif}` : gaya.tombol} style={aktif ? { color: warna } : undefined} aria-pressed={aktif} onClick={() => onUbah(p.nilai)}>
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
