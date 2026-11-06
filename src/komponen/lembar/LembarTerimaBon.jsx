// LembarTerimaBon.jsx: pelanggan membayar bonnya.
import { useState } from "react";
import Lembar from "../Lembar.jsx";
import Rute from "../Rute.jsx";
import InputRupiah from "../InputRupiah.jsx";
import { useIsi, usePelanggan } from "../../data/pakai.js";
import { terimaBon } from "../../data/aksi.js";
import { formatRupiah, ribuan } from "../../data/format.js";
import bersama from "./bersama.module.css";
import gaya from "./LembarTerimaBon.module.css";

function IsiTerimaBon({ onTutup, onTersimpan, pelangganAwal }) {
  const pelanggan = usePelanggan();
  const isi = useIsi();
  const [pelangganId, setPelangganId] = useState(pelangganAwal || null);
  const [nominal, setNominal] = useState(null);
  const [galat, setGalat] = useState("");

  const bon = (id) => isi?.bon?.[id] || 0;
  const berutang = pelanggan.filter((p) => bon(p.id) > 0).sort((a, b) => bon(b.id) - bon(a.id));
  const terpilih = pelanggan.find((p) => p.id === pelangganId);
  const sisa = terpilih ? bon(terpilih.id) - (nominal || 0) : 0;

  async function simpan() {
    setGalat("");
    const hasil = await terimaBon({ pelangganId, nominal: nominal || 0 });
    if (hasil.galat) return setGalat(hasil.galat);
    onTersimpan(`Tersimpan: terima bon ${formatRupiah(nominal)}`);
    onTutup();
  }

  // Tunggu isi laci dan stok dimuat, supaya tidak sempat tampil "Rp 0" atau "Stok habis" yang keliru
  if (!isi) return null;

  if (!berutang.length) {
    return <p className={gaya.kosong}>Tidak ada pelanggan yang punya bon.</p>;
  }

  return (
    <div className={bersama.susun}>
      <div className={gaya.kisi} role="group" aria-label="Pilih pelanggan">
        {berutang.map((p) => (
          <button key={p.id} type="button" className={p.id === pelangganId ? `${gaya.orang} ${gaya.aktif}` : gaya.orang} aria-pressed={p.id === pelangganId} onClick={() => setPelangganId(p.id)}>
            <strong>{p.nama}</strong>
            <span>{ribuan(bon(p.id))}</span>
          </button>
        ))}
      </div>

      <div className={gaya.kotakNominal}>
        <InputRupiah label="Dibayar" besar nilai={nominal} onUbah={setNominal} />
        <button type="button" className={gaya.lunas} disabled={!terpilih} onClick={() => setNominal(bon(terpilih.id))}>
          Lunas
        </button>
      </div>

      <p className={bersama.galat} role="alert">
        {galat}
      </p>

      <div className={bersama.kartuRute}>
        <div className={bersama.barisRute}>
          <Rute dari="bon" ke="laci" namaPelanggan={terpilih?.nama} />
          {terpilih && <span className={bersama.keteranganRute}>{sisa > 0 ? `Sisa ${ribuan(sisa)}` : sisa === 0 ? "Lunas" : ""}</span>}
        </div>
      </div>

      <button type="button" className={bersama.simpan} disabled={!terpilih || !(nominal > 0)} onClick={simpan}>
        Simpan
      </button>
    </div>
  );
}

export default function LembarTerimaBon({ terbuka, onTutup, onTersimpan, pelangganAwal }) {
  return (
    <Lembar terbuka={terbuka} onTutup={onTutup} judul="Terima bon">
      <IsiTerimaBon onTutup={onTutup} onTersimpan={onTersimpan} pelangganAwal={pelangganAwal} />
    </Lembar>
  );
}
