// DetailPelanggan.jsx: bon satu pelanggan, tombol Terima bon dan Ingatkan via WA, dan riwayat.
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import KerangkaLayar from "../../komponen/KerangkaLayar.jsx";
import BarisCatatan from "../../komponen/BarisCatatan.jsx";
import PesanSingkat, { usePesan } from "../../komponen/PesanSingkat.jsx";
import LembarTerimaBon from "../../komponen/lembar/LembarTerimaBon.jsx";
import LembarRincian from "../../komponen/lembar/LembarRincian.jsx";
import LembarPelanggan from "../Pelanggan/LembarPelanggan.jsx";
import LembarPengingatWa from "./LembarPengingatWa.jsx";
import { useIsi, useNamaWarung, usePelanggan, useSemuaCatatan } from "../../data/pakai.js";
import { hapusPelanggan } from "../../data/aksi.js";
import { labelTanggalAtauJam } from "../../data/uraian.js";
import { formatRupiah } from "../../data/format.js";
import umum from "../../komponen/umum.module.css";
import bersama from "../../komponen/lembar/bersama.module.css";
import gaya from "./DetailPelanggan.module.css";

export default function DetailPelanggan() {
  const { id } = useParams();
  const pindah = useNavigate();
  const daftar = usePelanggan();
  const isi = useIsi();
  const catatan = useSemuaCatatan();
  const namaWarung = useNamaWarung() || "Buku Warung";
  const { pesan, tampilkanPesan } = usePesan();

  const [lembar, setLembar] = useState(null); // "bon" | "wa" | "ubah"
  const [rincian, setRincian] = useState(null);
  const [siapHapus, setSiapHapus] = useState(false);
  const [galat, setGalat] = useState("");

  const p = daftar.find((x) => x.id === id);
  if (!p) return <KerangkaLayar judul="Pelanggan" kembali="/pelanggan" />;

  const bon = isi?.bon?.[id] || 0;
  const riwayat = catatan.filter((c) => c.pelanggan_id === id).sort((a, b) => b.waktu - a.waktu);
  const tutup = () => setLembar(null);

  async function tekanHapus() {
    if (!siapHapus) return setSiapHapus(true);
    const hasil = await hapusPelanggan(id);
    if (hasil.galat) {
      setSiapHapus(false);
      return setGalat(hasil.galat);
    }
    pindah("/pelanggan");
  }

  return (
    <KerangkaLayar
      judul={p.nama}
      kembali="/pelanggan"
      aksi={
        <button type="button" className={gaya.ubah} onClick={() => setLembar("ubah")}>
          Ubah
        </button>
      }
    >
      <section className={gaya.kartuBon} aria-label={`Bon ${p.nama}`}>
        <span className={gaya.label}>Bon {p.nama}</span>
        <strong className={gaya.angka}>{bon > 0 ? formatRupiah(bon) : "Lunas"}</strong>
        {p.no_wa && <span>{p.no_wa}</span>}
      </section>

      {bon > 0 && (
        <div className={umum.duaKolom}>
          <button type="button" className={gaya.tombolUtama} onClick={() => setLembar("bon")}>
            Terima bon
          </button>
          <button type="button" className={gaya.tombolKedua} onClick={() => setLembar("wa")}>
            Ingatkan via WA
          </button>
        </div>
      )}

      <h2 className={gaya.judulRiwayat}>Riwayat</h2>
      {riwayat.length > 0 ? (
        <ul className={`${umum.kartu} ${umum.daftarPolos}`}>
          {riwayat.map((c) => (
            <li key={c.id}>
              <BarisCatatan catatan={c} nama={p.nama} sub={labelTanggalAtauJam(c)} onBuka={setRincian} />
            </li>
          ))}
        </ul>
      ) : (
        <p className={umum.kosong}>Belum ada catatan.</p>
      )}

      {bon <= 0 && (
        <button type="button" className={bersama.hapus} onClick={tekanHapus}>
          {siapHapus ? "Tekan lagi untuk menghapus" : "Hapus pelanggan"}
        </button>
      )}
      <p className={bersama.galat} role="alert">
        {galat}
      </p>

      <LembarTerimaBon terbuka={lembar === "bon"} onTutup={tutup} onTersimpan={tampilkanPesan} pelangganAwal={id} />
      <LembarPengingatWa terbuka={lembar === "wa"} onTutup={tutup} pelanggan={p} bon={bon} catatan={catatan} namaWarung={namaWarung} />
      <LembarPelanggan terbuka={lembar === "ubah"} pelanggan={p} onTutup={tutup} onTersimpan={tampilkanPesan} />
      <LembarRincian catatan={rincian} onTutup={() => setRincian(null)} onTersimpan={tampilkanPesan} />
      <PesanSingkat pesan={pesan} />
    </KerangkaLayar>
  );
}
