// Barang.jsx: daftar barang dan stoknya.
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import KerangkaLayar from "../../komponen/KerangkaLayar.jsx";
import PesanSingkat, { usePesan } from "../../komponen/PesanSingkat.jsx";
import LembarBelanja from "../../komponen/lembar/LembarBelanja.jsx";
import { useBarang, useIsi } from "../../data/pakai.js";
import { ribuan } from "../../data/format.js";
import LembarBarang from "./LembarBarang.jsx";
import LembarKoreksi from "./LembarKoreksi.jsx";
import umum from "../../komponen/umum.module.css";
import gaya from "./Barang.module.css";

const BATAS_BAWAAN = 5;

export default function Barang() {
  const barang = useBarang();
  const isi = useIsi();
  const lokasi = useLocation();
  const pindah = useNavigate();
  const { pesan, tampilkanPesan } = usePesan();

  const [cari, setCari] = useState("");
  const [hanyaHampirHabis, setHanyaHampirHabis] = useState(false);
  const [lembar, setLembar] = useState(null); // { baru: true, asal } atau { barang }
  const [belanja, setBelanja] = useState(null); // { barangAwal }, lembar Belanja yang terbuka
  const [koreksi, setKoreksi] = useState(null); // id barang

  // Dibuka dari lembar Rincian lewat "Pakai Koreksi stok"
  const idKoreksiAwal = lokasi.state?.koreksi;
  useEffect(() => {
    if (!idKoreksiAwal) return;
    setKoreksi(idKoreksiAwal);
    pindah(lokasi.pathname, { replace: true, state: null });
  }, [idKoreksiAwal, lokasi.pathname, pindah]);

  const stok = (id) => isi?.stok?.[id] || 0;
  const hampirHabis = (b) => stok(b.id) <= (b.batas_hampir_habis ?? BATAS_BAWAAN);
  const jumlahHampirHabis = barang.filter(hampirHabis).length;

  const tampil = barang
    .filter((b) => !hanyaHampirHabis || hampirHabis(b))
    .filter((b) => b.nama.toLowerCase().includes(cari.trim().toLowerCase()))
    .sort((a, b) => hampirHabis(b) - hampirHabis(a) || a.nama.localeCompare(b.nama));

  const barangKoreksi = barang.find((b) => b.id === koreksi);
  const barangUbah = lembar?.barang && barang.find((b) => b.id === lembar.barang);

  function bukaBelanja(id) {
    setLembar(null);
    setBelanja({ barangAwal: id });
  }

  return (
    <KerangkaLayar
      judul="Barang"
      aksi={
        <button type="button" className={umum.tombolTambah} onClick={() => setLembar({ baru: true })}>
          + Tambah
        </button>
      }
    >
      <label className={umum.cari}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
        <input type="search" placeholder="Cari barang" aria-label="Cari barang" autoComplete="off" value={cari} onChange={(e) => setCari(e.target.value)} />
      </label>

      <div className={umum.deretFilter}>
        <button type="button" className={!hanyaHampirHabis ? `${umum.filter} ${umum.filterAktif}` : umum.filter} aria-pressed={!hanyaHampirHabis} onClick={() => setHanyaHampirHabis(false)}>
          Semua
        </button>
        <button type="button" className={hanyaHampirHabis ? `${umum.filter} ${umum.filterAktif}` : `${umum.filter} ${umum.filterPeringatan}`} aria-pressed={hanyaHampirHabis} onClick={() => setHanyaHampirHabis(true)}>
          Hampir habis · {jumlahHampirHabis}
        </button>
      </div>

      {tampil.length > 0 ? (
        <ul className={`${umum.kartu} ${umum.daftarPolos}`}>
          {tampil.map((b) => (
            <li key={b.id}>
              <button type="button" className={gaya.baris} onClick={() => setLembar({ barang: b.id })}>
                <span className={gaya.nama}>
                  <strong>{b.nama}</strong>
                  <span>{b.harga_jual ? `Rp ${ribuan(b.harga_jual)}` : "Harga jual belum diisi"}</span>
                </span>
                <span className={hampirHabis(b) ? gaya.stokHampir : gaya.stok} aria-label={`Stok ${stok(b.id)}${hampirHabis(b) ? ", hampir habis" : ""}`}>
                  {ribuan(stok(b.id))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={umum.kosong}>{barang.length ? "Tidak ada barang yang cocok." : "Belum ada barang. Tekan + Tambah untuk mulai."}</p>
      )}

      <LembarBarang
        terbuka={Boolean(lembar?.baru || barangUbah)}
        barang={barangUbah}
        stok={barangUbah ? stok(barangUbah.id) : 0}
        asalAwal={lembar?.asal}
        onTambahStok={bukaBelanja}
        onTutup={() => setLembar(null)}
        onTersimpan={tampilkanPesan}
        onKoreksi={(id) => {
          setLembar(null);
          setKoreksi(id);
        }}
      />
      <LembarBelanja
        terbuka={Boolean(belanja)}
        barangAwal={belanja?.barangAwal}
        onTutup={() => setBelanja(null)}
        onTersimpan={tampilkanPesan}
        onBarangBaru={() => {
          setBelanja(null);
          setLembar({ baru: true, asal: "dibeli" });
        }}
      />
      <LembarKoreksi barang={barangKoreksi} stok={barangKoreksi ? stok(barangKoreksi.id) : 0} onTutup={() => setKoreksi(null)} onTersimpan={tampilkanPesan} />
      <PesanSingkat pesan={pesan} />
    </KerangkaLayar>
  );
}
