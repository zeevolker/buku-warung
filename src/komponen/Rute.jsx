// Rute.jsx: "dari → ke" dan nominalnya, tampil sekali di atas tombol Simpan.
import ChipTempat from "./ChipTempat.jsx";
import Ikon from "./Ikon.jsx";
import { formatRupiah } from "../data/format.js";
import gaya from "./Rute.module.css";

export default function Rute({ dari, ke, namaPelanggan, nominal }) {
  return (
    <div className={gaya.rute}>
      <span className={gaya.tempat}>
        <ChipTempat tempat={dari} namaPelanggan={namaPelanggan} />
        <span className={gaya.panah} role="img" aria-label="ke">
          <Ikon nama="panah" ukuran={16} />
        </span>
        <ChipTempat tempat={ke} namaPelanggan={namaPelanggan} />
      </span>
      {nominal !== undefined && <strong className={gaya.nominal}>{formatRupiah(nominal)}</strong>}
    </div>
  );
}
