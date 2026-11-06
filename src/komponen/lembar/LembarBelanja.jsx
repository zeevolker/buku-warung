// LembarBelanja.jsx: uang keluar dari laci untuk stok, biaya, atau pinjaman pelanggan.
import { useRef, useState } from "react";
import Lembar from "../Lembar.jsx";
import Geser from "../Geser.jsx";
import Rute from "../Rute.jsx";
import InputRupiah from "../InputRupiah.jsx";
import PilihPelanggan from "./PilihPelanggan.jsx";
import KotakPribadi from "./KotakPribadi.jsx";
import { useBarang, useIsi, usePelanggan } from "../../data/pakai.js";
import { belanja, siapkanPelanggan } from "../../data/aksi.js";
import { formatRupiah, ribuan } from "../../data/format.js";
import bersama from "./bersama.module.css";

const JENIS = [
  { nilai: "stok", label: "Stok" },
  { nilai: "biaya", label: "Biaya" },
  { nilai: "pinjaman", label: "Pinjaman" },
];
const TUJUAN = { stok: "agen", biaya: "biaya", pinjaman: "bon" };

function IsiBelanja({ onTutup, onTersimpan }) {
  const barang = useBarang();
  const pelanggan = usePelanggan();
  const isi = useIsi();
  const kolomTotal = useRef(null);

  const [jenis, setJenis] = useState("stok");
  const [barangId, setBarangId] = useState("");
  const [jumlah, setJumlah] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [pelangganId, setPelangganId] = useState(null);
  const [namaBaru, setNamaBaru] = useState("");
  const [total, setTotal] = useState(null);
  const [setujuPribadi, setSetujuPribadi] = useState(false);
  const [galat, setGalat] = useState("");

  const laci = Math.max(0, isi?.laci || 0);
  const kekurangan = (total || 0) - laci;
  const melebihi = kekurangan > 0;
  const barangPilihan = barang.find((b) => b.id === barangId);
  const namaPilihan = pelanggan.find((p) => p.id === pelangganId)?.nama || namaBaru.trim();
  const urutBarang = [...barang].sort((a, b) => a.nama.localeCompare(b.nama));

  function ubahTotal(n) {
    setTotal(n);
    setSetujuPribadi(false);
  }

  async function simpan() {
    setGalat("");
    let idPelanggan = pelangganId;
    if (jenis === "pinjaman" && !idPelanggan && namaBaru.trim()) {
      const hasil = await siapkanPelanggan(namaBaru);
      if (hasil.galat) return setGalat(hasil.galat);
      idPelanggan = hasil.pelanggan.id;
    }
    const hasil = await belanja({ jenis, total: total || 0, barangId, jumlah: Number(jumlah), pelangganId: idPelanggan, keterangan, pakaiPribadi: setujuPribadi });
    if (hasil.galat) return setGalat(hasil.galat);
    if (hasil.perluPribadi) return setSetujuPribadi(false); // isi laci berubah sejak layar digambar
    onTersimpan(`Tersimpan: uang keluar ${formatRupiah(total)}`);
    onTutup();
  }

  // Tunggu isi laci dan stok dimuat, supaya tidak sempat tampil "Rp 0" atau "Stok habis" yang keliru
  if (!isi) return null;

  return (
    <div className={bersama.susun}>
      <Geser label="Jenis belanja" pilihan={JENIS} nilai={jenis} onUbah={setJenis} warna="var(--keluar-teks)" />

      {jenis === "stok" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 10 }}>
          <select className={bersama.input} aria-label="Barang" value={barangId} onChange={(e) => setBarangId(e.target.value)}>
            <option value="">Pilih barang</option>
            {urutBarang.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nama}
              </option>
            ))}
          </select>
          <input className={bersama.input} aria-label="Jumlah" placeholder="Jumlah" type="number" inputMode="numeric" min="1" step="1" value={jumlah} onChange={(e) => setJumlah(e.target.value)} />
        </div>
      )}

      {jenis === "biaya" && <input className={bersama.input} aria-label="Keterangan" placeholder="Keterangan (listrik, plastik)" autoComplete="off" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />}

      {jenis === "pinjaman" && <PilihPelanggan daftar={pelanggan} terpilih={pelangganId} onPilih={setPelangganId} namaBaru={namaBaru} onNamaBaru={setNamaBaru} />}

      <InputRupiah ref={kolomTotal} label="Total" besar nilai={total} onUbah={ubahTotal} />

      {melebihi && !setujuPribadi && <KotakPribadi laci={laci} kekurangan={kekurangan} onYa={() => setSetujuPribadi(true)} onUbah={() => kolomTotal.current?.focus()} />}

      <p className={bersama.galat} role="alert">
        {galat}
      </p>

      <div className={bersama.kartuRute}>
        {melebihi && (
          <div className={bersama.barisRute}>
            <Rute dari="pemilik" ke="laci" nominal={kekurangan} />
          </div>
        )}
        <div className={bersama.barisRute}>
          {jenis === "stok" && barangPilihan && Number(jumlah) > 0 && !melebihi ? (
            <>
              <Rute dari="laci" ke="agen" />
              <span className={bersama.keteranganRute}>
                Stok {barangPilihan.nama} +{ribuan(Number(jumlah))}
              </span>
            </>
          ) : (
            <Rute dari="laci" ke={TUJUAN[jenis]} namaPelanggan={namaPilihan} nominal={total || 0} />
          )}
        </div>
      </div>

      <button type="button" className={bersama.simpan} disabled={!(total > 0) || (melebihi && !setujuPribadi)} onClick={simpan}>
        Simpan
      </button>
    </div>
  );
}

export default function LembarBelanja({ terbuka, onTutup, onTersimpan }) {
  return (
    <Lembar terbuka={terbuka} onTutup={onTutup} judul="Belanja">
      <IsiBelanja onTutup={onTutup} onTersimpan={onTersimpan} />
    </Lembar>
  );
}
