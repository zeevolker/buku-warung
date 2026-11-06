// LembarRincian.jsx: isi satu catatan, akibatnya, dan tombol hapus yang perlu ditekan dua kali.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import Lembar from "../Lembar.jsx";
import ChipTempat from "../ChipTempat.jsx";
import Ikon from "../Ikon.jsx";
import { usePelanggan, useSemuaCatatan } from "../../data/pakai.js";
import { bolehDihapus } from "../../data/hitung.js";
import { uraiCatatan, akibatCatatan, labelWaktu } from "../../data/uraian.js";
import { hapusCatatan } from "../../data/aksi.js";
import { formatRupiah } from "../../data/format.js";
import bersama from "./bersama.module.css";
import gaya from "./LembarRincian.module.css";

const LAMA_KONFIRMASI = 4000; // tekan kedua harus dalam 4 detik

function IsiRincian({ catatan, onTutup, onTersimpan, onHitungUlang }) {
  const pelanggan = usePelanggan();
  const semua = useSemuaCatatan();
  const buka = useNavigate();
  const [siapHapus, setSiapHapus] = useState(false);
  const [galat, setGalat] = useState("");
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const namaDari = (id) => pelanggan.find((p) => p.id === id)?.nama || "pelanggan";
  const nama = namaDari(catatan.pelanggan_id);
  const akibat = akibatCatatan(catatan, nama);
  // Daftar catatan sudah dimuat kalau catatan ini ada di dalamnya
  const sudahDimuat = semua.some((c) => c.id === catatan.id);
  const izin = sudahDimuat ? bolehDihapus(catatan, semua, namaDari) : { boleh: false };

  async function tekanHapus() {
    if (!siapHapus) {
      setSiapHapus(true);
      timer.current = setTimeout(() => setSiapHapus(false), LAMA_KONFIRMASI);
      return;
    }
    clearTimeout(timer.current);
    const hasil = await hapusCatatan(catatan.id);
    if (hasil.galat) {
      setSiapHapus(false);
      return setGalat(hasil.galat);
    }
    onTersimpan("Catatan dihapus");
    onTutup();
  }

  return (
    <div className={bersama.susun}>
      <span className={gaya.waktu}>{labelWaktu(catatan)}</span>

      <div className={`${bersama.kartu} ${gaya.blok}`}>
        <strong className={gaya.nominal}>{formatRupiah(catatan.nominal)}</strong>
        <div className={gaya.rute}>
          <ChipTempat tempat={catatan.dari} namaPelanggan={nama} />
          <span className={gaya.panah} role="img" aria-label="ke">
            <Ikon nama="panah" ukuran={18} />
          </span>
          <ChipTempat tempat={catatan.ke} namaPelanggan={nama} />
        </div>
      </div>

      {akibat.length > 0 && (
        <div className={bersama.kartu}>
          {akibat.map((a) => (
            <div className={gaya.akibat} key={a.label}>
              <span>{a.label}</span>
              <strong>{a.nilai}</strong>
            </div>
          ))}
        </div>
      )}

      {sudahDimuat && !izin.boleh && (
        <div className={bersama.kotakTolak} role="alert">
          <strong>Tidak bisa dihapus</strong>
          <span>{izin.alasan}</span>
          {izin.jenis === "stok" && (
            <button
              type="button"
              className={bersama.tautanTolak}
              onClick={() => {
                onTutup();
                buka("/barang");
              }}
            >
              Pakai Koreksi stok
            </button>
          )}
          {izin.jenis === "laci" && onHitungUlang && (
            <button type="button" className={bersama.tautanTolak} onClick={onHitungUlang}>
              Hitung ulang
            </button>
          )}
        </div>
      )}

      <p className={bersama.galat} role="alert">
        {galat}
      </p>

      <button type="button" className={bersama.hapus} disabled={!izin.boleh} onClick={tekanHapus}>
        {siapHapus ? "Tekan lagi untuk menghapus" : "Hapus catatan"}
      </button>
    </div>
  );
}

// catatan = catatan yang sedang dibuka, atau null kalau lembar tertutup
export default function LembarRincian({ catatan, onTutup, onTersimpan, onHitungUlang }) {
  const pelanggan = usePelanggan();
  // Disimpan supaya judul tidak hilang selama animasi menutup
  const terakhir = useRef(catatan);
  if (catatan) terakhir.current = catatan;
  const nama = pelanggan.find((p) => p.id === terakhir.current?.pelanggan_id)?.nama;
  return (
    <Lembar terbuka={Boolean(catatan)} onTutup={onTutup} judul={terakhir.current ? uraiCatatan(terakhir.current, nama).judul : "Rincian"}>
      {terakhir.current && <IsiRincian key={terakhir.current.id} catatan={terakhir.current} onTutup={onTutup} onTersimpan={onTersimpan} onHitungUlang={onHitungUlang} />}
    </Lembar>
  );
}
