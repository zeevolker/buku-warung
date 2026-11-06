// Pelanggan.jsx: total bon dan daftar pelanggan. Yang lunas di bawah, abu-abu.
import { useState } from "react";
import { Link } from "react-router";
import KerangkaLayar from "../../komponen/KerangkaLayar.jsx";
import PesanSingkat, { usePesan } from "../../komponen/PesanSingkat.jsx";
import { useIsi, usePelanggan } from "../../data/pakai.js";
import { formatRupiah, ribuan } from "../../data/format.js";
import LembarPelanggan from "./LembarPelanggan.jsx";
import umum from "../../komponen/umum.module.css";
import gaya from "./Pelanggan.module.css";

export default function Pelanggan() {
  const pelanggan = usePelanggan();
  const isi = useIsi();
  const { pesan, tampilkanPesan } = usePesan();
  const [tambah, setTambah] = useState(false);

  const bon = (id) => isi?.bon?.[id] || 0;
  const berutang = pelanggan.filter((p) => bon(p.id) > 0);
  const total = berutang.reduce((n, p) => n + bon(p.id), 0);
  const urut = [...pelanggan].sort((a, b) => bon(b.id) - bon(a.id) || a.nama.localeCompare(b.nama));

  return (
    <KerangkaLayar
      judul="Pelanggan"
      aksi={
        <button type="button" className={umum.tombolTambah} onClick={() => setTambah(true)}>
          + Tambah
        </button>
      }
    >
      <section className={gaya.kartuBon} aria-label="Total bon">
        <span className={gaya.labelBon}>Total bon</span>
        <strong className={gaya.angkaBon}>{formatRupiah(total)}</strong>
        <span>{berutang.length ? `${berutang.length} orang belum lunas` : "Semua sudah lunas"}</span>
      </section>

      {urut.length > 0 ? (
        <ul className={`${umum.kartu} ${umum.daftarPolos}`}>
          {urut.map((p) => {
            const lunas = bon(p.id) <= 0;
            return (
              <li key={p.id}>
                <Link to={`/pelanggan/${p.id}`} className={gaya.baris}>
                  <span className={lunas ? `${gaya.inisial} ${gaya.inisialLunas}` : gaya.inisial}>{p.nama[0].toUpperCase()}</span>
                  <span className={lunas ? gaya.namaLunas : gaya.nama}>{p.nama}</span>
                  {lunas ? <span className={gaya.lunas}>Lunas</span> : <strong className={gaya.nominal}>{ribuan(bon(p.id))}</strong>}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={umum.kosong}>Belum ada pelanggan. Tekan + Tambah untuk mulai.</p>
      )}

      <LembarPelanggan terbuka={tambah} onTutup={() => setTambah(false)} onTersimpan={tampilkanPesan} />
      <PesanSingkat pesan={pesan} />
    </KerangkaLayar>
  );
}
