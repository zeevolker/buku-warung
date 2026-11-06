// LembarBarang.jsx: tambah barang baru, atau ubah barang yang sudah ada.
import { useRef, useState } from "react";
import Lembar from "../../komponen/Lembar.jsx";
import Geser from "../../komponen/Geser.jsx";
import Rute from "../../komponen/Rute.jsx";
import InputRupiah from "../../komponen/InputRupiah.jsx";
import KotakPribadi from "../../komponen/lembar/KotakPribadi.jsx";
import { useIsi } from "../../data/pakai.js";
import { tambahBarang, ubahBarang, hapusBarang } from "../../data/aksi.js";
import bersama from "../../komponen/lembar/bersama.module.css";
import umum from "../../komponen/umum.module.css";
import gaya from "./Barang.module.css";

const BATAS_BAWAAN = 5;

function IsiBarang({ barang, stok, onTutup, onTersimpan, onKoreksi }) {
  const isi = useIsi();
  const kolomStok = useRef(null);
  const [nama, setNama] = useState(barang?.nama || "");
  const [hargaJual, setHargaJual] = useState(barang?.harga_jual || null);
  const [hargaBeli, setHargaBeli] = useState(barang?.harga_beli || null);
  const [stokAwal, setStokAwal] = useState("");
  const [batas, setBatas] = useState(String(barang?.batas_hampir_habis ?? BATAS_BAWAAN));
  const [asal, setAsal] = useState("rak");
  const [setujuPribadi, setSetujuPribadi] = useState(false);
  const [siapHapus, setSiapHapus] = useState(false);
  const [galat, setGalat] = useState("");

  const jumlah = Math.floor(Number(stokAwal)) || 0;
  const nominal = jumlah * (hargaBeli || 0);
  const laci = Math.max(0, isi?.laci || 0);
  const kekurangan = asal === "dibeli" ? nominal - laci : 0;
  const melebihi = !barang && kekurangan > 0;

  async function simpan() {
    setGalat("");
    const isian = { nama, harga_jual: hargaJual || 0, harga_beli: hargaBeli || 0, batas_hampir_habis: Math.max(0, Math.floor(Number(batas)) || 0) };
    const hasil = barang ? await ubahBarang(barang.id, isian) : await tambahBarang({ ...isian, stok: jumlah, asal, pakaiPribadi: setujuPribadi });
    if (hasil.galat) return setGalat(hasil.galat);
    if (hasil.perluPribadi) return setSetujuPribadi(false);
    onTersimpan(barang ? "Barang diperbarui" : `${nama.trim()} ditambahkan`);
    onTutup();
  }

  async function tekanHapus() {
    if (!siapHapus) return setSiapHapus(true);
    await hapusBarang(barang.id);
    onTersimpan("Barang dihapus. Catatan lamanya tetap ada.");
    onTutup();
  }

  if (!isi) return null;

  return (
    <div className={bersama.susun}>
      <label className={umum.bidang}>
        Nama
        <input className={bersama.input} autoComplete="off" value={nama} onChange={(e) => setNama(e.target.value)} />
      </label>
      <div className={umum.duaKolom}>
        <label className={umum.bidang}>
          Harga jual
          <InputRupiah label="Harga jual" nilai={hargaJual} onUbah={setHargaJual} />
        </label>
        <label className={umum.bidang}>
          Harga beli
          <InputRupiah label="Harga beli" nilai={hargaBeli} onUbah={(n) => { setHargaBeli(n); setSetujuPribadi(false); }} />
        </label>
      </div>
      <div className={umum.duaKolom}>
        {barang ? (
          <div className={`${bersama.kartu} ${gaya.barisStok}`}>
            <span>Stok</span>
            <strong>{stok}</strong>
          </div>
        ) : (
          <label className={umum.bidang}>
            Stok sekarang
            <input ref={kolomStok} className={bersama.input} type="number" inputMode="numeric" min="0" step="1" value={stokAwal} onChange={(e) => { setStokAwal(e.target.value); setSetujuPribadi(false); }} />
          </label>
        )}
        <label className={umum.bidang}>
          Hampir habis di
          <input className={bersama.input} type="number" inputMode="numeric" min="0" step="1" value={batas} onChange={(e) => setBatas(e.target.value)} />
        </label>
      </div>

      {barang ? (
        <button type="button" className={bersama.tautan} onClick={() => onKoreksi(barang.id)}>
          Jumlah di rak beda? Koreksi stok
        </button>
      ) : (
        <div className={umum.bidang}>
          <span>Barangnya dari mana?</span>
          <Geser
            label="Barangnya dari mana?"
            pilihan={[
              { nilai: "rak", label: "Sudah ada di rak" },
              { nilai: "dibeli", label: "Baru dibeli" },
            ]}
            nilai={asal}
            onUbah={(a) => { setAsal(a); setSetujuPribadi(false); }}
            warna="var(--stok-teks)"
          />
        </div>
      )}

      {melebihi && !setujuPribadi && <KotakPribadi laci={laci} kekurangan={kekurangan} onYa={() => setSetujuPribadi(true)} onUbah={() => kolomStok.current?.focus()} />}

      <p className={bersama.galat} role="alert">
        {galat}
      </p>

      {!barang && jumlah > 0 && (
        <div className={bersama.kartuRute}>
          {melebihi && <Rute dari="pemilik" ke="laci" nominal={kekurangan} />}
          {asal === "rak" ? <Rute dari="pemilik" ke="stok" nominal={nominal} /> : <Rute dari="laci" ke="agen" nominal={nominal} />}
        </div>
      )}

      <button type="button" className={bersama.simpan} disabled={melebihi && !setujuPribadi} onClick={simpan}>
        Simpan
      </button>
      {barang && (
        <button type="button" className={bersama.hapus} onClick={tekanHapus}>
          {siapHapus ? "Tekan lagi untuk menghapus" : "Hapus barang"}
        </button>
      )}
    </div>
  );
}

export default function LembarBarang({ terbuka, barang, stok, onTutup, onTersimpan, onKoreksi }) {
  return (
    <Lembar terbuka={terbuka} onTutup={onTutup} judul={barang ? "Ubah barang" : "Tambah barang"}>
      <IsiBarang key={barang?.id || "baru"} barang={barang} stok={stok} onTutup={onTutup} onTersimpan={onTersimpan} onKoreksi={onKoreksi} />
    </Lembar>
  );
}
