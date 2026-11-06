// KerangkaLayar.jsx: bungkus layar. Judul dan jarak tepi yang sama di semua layar.
import gaya from "./KerangkaLayar.module.css";

export default function KerangkaLayar({ judul, children }) {
  return (
    <div className={gaya.layar}>
      <h1 className={gaya.judul}>{judul}</h1>
      {children}
    </div>
  );
}
