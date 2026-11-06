// Barang.jsx: masih kerangka. Dibuat di Tahap 3.
import KerangkaLayar from "../../komponen/KerangkaLayar.jsx";
import { isiDataContoh } from "../../data/contoh.js";

export default function Barang() {
  return (
    <KerangkaLayar judul="Barang">
      {/* Hanya saat pengembangan, sampai layar Tambah barang dibuat di Tahap 3 */}
      {import.meta.env.DEV && (
        <button type="button" style={{ minHeight: 48 }} onClick={isiDataContoh}>
          Isi data contoh
        </button>
      )}
    </KerangkaLayar>
  );
}
