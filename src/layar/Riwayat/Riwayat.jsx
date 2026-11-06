// Riwayat.jsx: semua catatan, bisa dicari dan disaring. Tampil bertahap supaya tetap ringan.
import { useEffect, useMemo, useRef, useState } from "react";
import KerangkaLayar from "../../komponen/KerangkaLayar.jsx";
import BarisCatatan from "../../komponen/BarisCatatan.jsx";
import PesanSingkat, { usePesan } from "../../komponen/PesanSingkat.jsx";
import LembarRincian from "../../komponen/lembar/LembarRincian.jsx";
import { usePelanggan, useSemuaCatatan } from "../../data/pakai.js";
import { saringRiwayat, kelompokPerTanggal } from "../../data/uraian.js";
import { jamDariMs } from "../../data/tanggal.js";
import umum from "../../komponen/umum.module.css";
import gaya from "./Riwayat.module.css";

const FILTER = [
  { nilai: "semua", label: "Semua" },
  { nilai: "jual", label: "Jual" },
  { nilai: "belanja", label: "Belanja" },
  { nilai: "bon", label: "Bon" },
  { nilai: "laci", label: "Laci" },
];
const JUMLAH_SEKALI = 50; // berapa catatan ditambahkan setiap kali

export default function Riwayat() {
  const catatan = useSemuaCatatan();
  const pelanggan = usePelanggan();
  const { pesan, tampilkanPesan } = usePesan();
  const [cari, setCari] = useState("");
  const [filter, setFilter] = useState("semua");
  const [batas, setBatas] = useState(JUMLAH_SEKALI);
  const [rincian, setRincian] = useState(null);
  const penanda = useRef(null);

  const nama = useMemo(() => new Map(pelanggan.map((p) => [p.id, p.nama])), [pelanggan]);
  const namaDari = (id) => nama.get(id) || "pelanggan";

  const cocok = useMemo(() => saringRiwayat(catatan, { filter, cari }, (id) => nama.get(id) || "pelanggan"), [catatan, filter, cari, nama]);
  const kelompok = useMemo(() => kelompokPerTanggal(cocok.slice(0, batas), cocok), [cocok, batas]);
  const adaLagi = cocok.length > batas;

  // Mulai dari atas lagi setiap pencarian atau saringan berubah
  useEffect(() => setBatas(JUMLAH_SEKALI), [filter, cari]);

  // Saat penanda di bawah daftar terlihat, tambah catatan yang ditampilkan
  useEffect(() => {
    if (!adaLagi || !penanda.current || !window.IntersectionObserver) return;
    const pengamat = new IntersectionObserver((isi) => {
      if (isi[0].isIntersecting) setBatas((b) => b + JUMLAH_SEKALI);
    });
    pengamat.observe(penanda.current);
    return () => pengamat.disconnect();
  }, [adaLagi, batas]);

  return (
    <KerangkaLayar judul="Semua riwayat" kembali="/">
      <label className={umum.cari}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
        <input type="search" placeholder="Cari barang atau nama" aria-label="Cari catatan" autoComplete="off" value={cari} onChange={(e) => setCari(e.target.value)} />
      </label>

      <div className={umum.deretFilter} role="group" aria-label="Saring catatan">
        {FILTER.map((f) => (
          <button key={f.nilai} type="button" className={filter === f.nilai ? `${umum.filter} ${umum.filterAktif}` : umum.filter} aria-pressed={filter === f.nilai} onClick={() => setFilter(f.nilai)}>
            {f.label}
          </button>
        ))}
      </div>

      {kelompok.map((k) => (
        <section key={k.tanggal} aria-label={k.label} className={gaya.kelompok}>
          <h2 className={umum.judulKecil}>
            {k.label} · {k.jumlah} catatan
          </h2>
          <ul className={`${umum.kartu} ${umum.daftarPolos}`}>
            {k.catatan.map((c) => (
              <li key={c.id}>
                <BarisCatatan catatan={c} nama={namaDari(c.pelanggan_id)} kiri={jamDariMs(c.waktu)} onBuka={setRincian} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {cocok.length === 0 && <p className={umum.kosong}>{catatan.length ? "Tidak ada catatan yang cocok." : "Belum ada catatan."}</p>}

      {adaLagi && (
        <button ref={penanda} type="button" className={gaya.lagi} onClick={() => setBatas((b) => b + JUMLAH_SEKALI)}>
          Tampilkan lagi
        </button>
      )}

      <LembarRincian catatan={rincian} onTutup={() => setRincian(null)} onTersimpan={tampilkanPesan} />
      <PesanSingkat pesan={pesan} />
    </KerangkaLayar>
  );
}
