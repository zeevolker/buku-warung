// TabMemo.jsx: kartu catatan bebas berwarna (nomor agen, harga grosir, ide jualan).
import { useRef, useState } from "react";
import Lembar from "../../komponen/Lembar.jsx";
import { useDaftarMemo, useTanggalHariIni } from "../../data/pakai.js";
import { simpanMemo, hapusMemo } from "../../data/aksi.js";
import { formatTanggal, labelTanggalPendek } from "../../data/tanggal.js";
import bersama from "../../komponen/lembar/bersama.module.css";
import umum from "../../komponen/umum.module.css";
import gaya from "./Catatan.module.css";

const WARNA = [
  { nilai: "putih", label: "Putih", latar: "var(--kartu)" },
  { nilai: "kuning", label: "Kuning", latar: "var(--bon-latar)" },
  { nilai: "hijau", label: "Hijau", latar: "var(--laci-latar)" },
  { nilai: "biru", label: "Biru", latar: "var(--stok-latar)" },
];
const latarDari = (warna) => WARNA.find((w) => w.nilai === warna)?.latar || "var(--kartu)";

function IsiMemo({ memo, onTutup }) {
  const [judul, setJudul] = useState(memo?.judul || "");
  const [isi, setIsi] = useState(memo?.isi || "");
  const [warna, setWarna] = useState(memo?.warna || "putih");
  const [siapHapus, setSiapHapus] = useState(false);
  const [galat, setGalat] = useState("");

  async function simpan() {
    const hasil = await simpanMemo({ id: memo?.id, judul, isi, warna });
    if (hasil.galat) return setGalat(hasil.galat);
    onTutup();
  }

  async function tekanHapus() {
    if (!siapHapus) return setSiapHapus(true);
    await hapusMemo(memo.id);
    onTutup();
  }

  return (
    <div className={bersama.susun}>
      <label className={umum.bidang}>
        Judul
        <input className={bersama.input} autoComplete="off" value={judul} onChange={(e) => setJudul(e.target.value)} />
      </label>
      <label className={umum.bidang}>
        Isi
        <textarea className={gaya.kolomIsi} value={isi} onChange={(e) => setIsi(e.target.value)} />
      </label>
      <div className={bersama.deret} role="group" aria-label="Warna">
        {WARNA.map((w) => (
          <button key={w.nilai} type="button" className={warna === w.nilai ? `${gaya.warna} ${gaya.warnaAktif}` : gaya.warna} style={{ background: w.latar }} aria-label={w.label} aria-pressed={warna === w.nilai} onClick={() => setWarna(w.nilai)} />
        ))}
      </div>
      <p className={bersama.galat} role="alert">
        {galat}
      </p>
      <button type="button" className={bersama.simpan} onClick={simpan}>
        Simpan
      </button>
      {memo && (
        <button type="button" className={bersama.hapus} onClick={tekanHapus}>
          {siapHapus ? "Tekan lagi untuk menghapus" : "Hapus catatan"}
        </button>
      )}
    </div>
  );
}

export default function TabMemo() {
  const daftar = useDaftarMemo();
  const kini = useTanggalHariIni();
  const [lembar, setLembar] = useState(null); // { baru: true } atau { memo }
  const terakhir = useRef(null);
  if (lembar) terakhir.current = lembar;
  const urut = [...daftar].sort((a, b) => b.updated_at - a.updated_at);

  const labelUbah = (ms) => {
    const t = formatTanggal(new Date(ms));
    return t === kini ? "Hari ini" : labelTanggalPendek(t);
  };

  return (
    <>
      {urut.length > 0 ? (
        <div className={gaya.kisiMemo}>
          {urut.map((m) => (
            <button key={m.id} type="button" className={gaya.memo} style={{ background: latarDari(m.warna) }} onClick={() => setLembar({ memo: m })}>
              {m.judul && <strong>{m.judul}</strong>}
              {m.isi && <span>{m.isi}</span>}
              <em>{labelUbah(m.updated_at)}</em>
            </button>
          ))}
        </div>
      ) : (
        <p className={umum.kosong}>Tulis nomor agen, harga grosir, atau ide jualan di sini.</p>
      )}

      <button type="button" className={gaya.catatanBaru} onClick={() => setLembar({ baru: true })}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Catatan baru
      </button>

      <Lembar terbuka={Boolean(lembar)} onTutup={() => setLembar(null)} judul={(lembar || terakhir.current)?.memo ? "Ubah catatan" : "Catatan baru"}>
        <IsiMemo key={terakhir.current?.memo?.id || "baru"} memo={terakhir.current?.memo} onTutup={() => setLembar(null)} />
      </Lembar>
    </>
  );
}
