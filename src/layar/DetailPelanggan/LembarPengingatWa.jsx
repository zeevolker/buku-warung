// LembarPengingatWa.jsx: pratinjau pesan dengan rincian bon, lalu kirim lewat WhatsApp.
import { useState } from "react";
import Lembar from "../../komponen/Lembar.jsx";
import { pesanBon, rincianBon } from "../../data/uraian.js";
import { nomorWhatsApp } from "../../data/format.js";
import bersama from "../../komponen/lembar/bersama.module.css";
import gaya from "./DetailPelanggan.module.css";

function IsiPengingat({ pelanggan, bon, catatan, namaWarung, onTutup }) {
  const [teks, setTeks] = useState(() => pesanBon({ namaWarung, nama: pelanggan.nama, bon, rincian: rincianBon(catatan, pelanggan.id) }));
  const [ubah, setUbah] = useState(false);
  const alamat = `https://wa.me/${nomorWhatsApp(pelanggan.no_wa)}?text=${encodeURIComponent(teks)}`;

  return (
    <div className={bersama.susun}>
      <span className={gaya.keterangan}>Lewat WhatsApp{pelanggan.no_wa ? ` · ${pelanggan.no_wa}` : ", nomornya dipilih di WhatsApp"}</span>
      {ubah ? <textarea className={gaya.kolomPesan} aria-label="Isi pesan" value={teks} onChange={(e) => setTeks(e.target.value)} /> : <div className={gaya.gelembung}>{teks}</div>}
      <button type="button" className={bersama.tautan} onClick={() => setUbah(!ubah)}>
        {ubah ? "Selesai mengubah" : "Ubah pesan"}
      </button>
      <a className={gaya.kirim} href={alamat} target="_blank" rel="noopener noreferrer" onClick={onTutup}>
        Kirim lewat WhatsApp
      </a>
    </div>
  );
}

export default function LembarPengingatWa({ terbuka, onTutup, pelanggan, bon, catatan, namaWarung }) {
  return (
    <Lembar terbuka={terbuka} onTutup={onTutup} judul={`Ingatkan ${pelanggan.nama}`}>
      <IsiPengingat pelanggan={pelanggan} bon={bon} catatan={catatan} namaWarung={namaWarung} onTutup={onTutup} />
    </Lembar>
  );
}
