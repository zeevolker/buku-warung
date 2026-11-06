// Akun.jsx: profil, status simpan, nama warung, cadangan file, tutorial, privasi, dan keluar.
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import KerangkaLayar from "../../komponen/KerangkaLayar.jsx";
import Lembar from "../../komponen/Lembar.jsx";
import TombolGoogle from "../../komponen/TombolGoogle.jsx";
import PesanSingkat, { usePesan } from "../../komponen/PesanSingkat.jsx";
import { useNamaWarung } from "../../data/pakai.js";
import { aturMeta } from "../../data/db.js";
import { useAkun, sinkronSekarang, keluarAkun, aturNamaWarung } from "../../data/akun.js";
import { supabaseAktif } from "../../data/supabase.js";
import { buatIsiCadangan, bacaIsiCadangan, pulihkan, ringkasIsi } from "../../data/cadangan.js";
import { simpanFile } from "../../data/unduh.js";
import { hariIni, jamDariMs } from "../../data/tanggal.js";
import bersama from "../../komponen/lembar/bersama.module.css";
import umum from "../../komponen/umum.module.css";
import gaya from "./Akun.module.css";

const TEKS_STATUS = {
  sinkron: "Tersimpan di cloud",
  menyinkron: "Sedang menyimpan…",
  offline: "Sedang offline",
  gagal: "Gagal kirim ke cloud",
};

function KartuStatus({ akun }) {
  const keterangan =
    akun.keadaan === "offline" && akun.belum
      ? `${akun.belum} catatan terkirim saat ada sinyal`
      : akun.keadaan === "gagal"
        ? "Data tetap aman di HP"
        : akun.terakhir
          ? `Terakhir ${jamDariMs(akun.terakhir)}`
          : "";
  return (
    <div className={`${gaya.status} ${gaya[`status_${akun.keadaan}`] || ""}`}>
      <span className={gaya.titik} />
      <span className={gaya.teksStatus}>
        <strong>{TEKS_STATUS[akun.keadaan] || TEKS_STATUS.sinkron}</strong>
        {keterangan && <span>{keterangan}</span>}
      </span>
      <button type="button" disabled={akun.keadaan === "menyinkron"} onClick={() => sinkronSekarang()}>
        Simpan sekarang
      </button>
    </div>
  );
}

function IsiNama({ awal, onTutup }) {
  const [nama, setNama] = useState(awal);
  async function simpan() {
    await aturNamaWarung(nama);
    onTutup();
  }
  return (
    <div className={bersama.susun}>
      <input className={bersama.input} aria-label="Nama warung" autoComplete="off" value={nama} onChange={(e) => setNama(e.target.value)} />
      <button type="button" className={bersama.simpan} onClick={simpan}>
        Simpan
      </button>
    </div>
  );
}

export default function Akun() {
  const akun = useAkun();
  const pindah = useNavigate();
  const namaWarung = useNamaWarung() || "";
  const { pesan, tampilkanPesan } = usePesan();
  const kolomFile = useRef(null);

  const [lembarNama, setLembarNama] = useState(false);
  const [menunggu, setMenunggu] = useState(null); // isi file yang menunggu persetujuan
  const [galat, setGalat] = useState("");
  const masuk = Boolean(akun.email);

  async function simpanCadangan() {
    const isi = JSON.stringify(await buatIsiCadangan(), null, 2);
    simpanFile(new Blob([isi], { type: "application/json" }), `buku-warung-${hariIni()}.json`);
    tampilkanPesan("File cadangan diunduh. Simpan di tempat aman.");
  }

  async function bacaFile(file) {
    setGalat("");
    let hasil = null;
    try {
      hasil = bacaIsiCadangan(JSON.parse(await file.text()));
    } catch {
      hasil = null;
    }
    if (!hasil) return setGalat("File ini bukan cadangan Buku Warung.");
    setMenunggu(hasil);
  }

  async function pulihkanSekarang() {
    try {
      await pulihkan(menunggu);
    } catch (e) {
      console.error(e);
      setMenunggu(null);
      return setGalat("Pemulihan gagal. Cek ruang penyimpanan HP lalu coba lagi.");
    }
    setMenunggu(null);
    tampilkanPesan("Data berhasil dipulihkan");
    sinkronSekarang();
  }

  async function lihatTutorial() {
    await aturMeta("tutorial", 1);
    pindah("/");
  }

  async function keluar() {
    setGalat("");
    const hasil = await keluarAkun();
    if (hasil.galat) return setGalat(hasil.galat);
    pindah("/mulai", { replace: true });
  }

  return (
    <KerangkaLayar judul="Akun" kembali="/">
      <div className={gaya.profil}>
        <span className={gaya.avatar}>{(namaWarung || "B")[0].toUpperCase()}</span>
        <strong>{namaWarung || "Buku Warung"}</strong>
        {masuk ? <span>{akun.email}</span> : <span>Data hanya tersimpan di HP ini</span>}
      </div>

      {masuk && <KartuStatus akun={akun} />}

      {!masuk && supabaseAktif() && (
        <div className={bersama.susun}>
          <TombolGoogle />
          <button type="button" className={bersama.simpan} onClick={() => pindah("/masuk")}>
            Masuk dengan email
          </button>
        </div>
      )}

      <div className={umum.kartu}>
        <button type="button" className={gaya.baris} onClick={() => setLembarNama(true)}>
          Nama warung
          <span>{namaWarung || "Belum diisi"}</span>
        </button>
        <button type="button" className={gaya.baris} onClick={simpanCadangan}>
          Simpan cadangan ke file
        </button>
        <button type="button" className={gaya.baris} onClick={() => kolomFile.current?.click()}>
          Pulihkan dari file
        </button>
        <button type="button" className={gaya.baris} onClick={lihatTutorial}>
          Lihat tutorial lagi
        </button>
        <Link to="/privasi" className={gaya.baris}>
          Kebijakan privasi
        </Link>
      </div>
      <input
        ref={kolomFile}
        type="file"
        accept="application/json,.json"
        hidden
        aria-label="File cadangan"
        onChange={(e) => {
          if (e.target.files[0]) bacaFile(e.target.files[0]);
          e.target.value = "";
        }}
      />

      <p className={bersama.galat} role="alert">
        {galat}
      </p>

      {masuk && (
        <button type="button" className={bersama.hapus} onClick={keluar}>
          Keluar dari akun
        </button>
      )}

      <Lembar terbuka={lembarNama} onTutup={() => setLembarNama(false)} judul="Nama warung">
        <IsiNama awal={namaWarung} onTutup={() => setLembarNama(false)} />
      </Lembar>

      <Lembar terbuka={Boolean(menunggu)} onTutup={() => setMenunggu(null)} judul="Pulihkan dari file?">
        {menunggu && (
          <div className={bersama.susun}>
            <p className={gaya.peringatan}>
              File berisi {ringkasIsi(menunggu.data)}. Semua data sekarang akan DIGANTI dengan isi file ini{masuk ? ", termasuk di cloud dan HP lain yang memakai akun ini" : ""}.
            </p>
            <button type="button" className={bersama.hapus} onClick={pulihkanSekarang}>
              Ya, ganti data
            </button>
            <button type="button" className={bersama.tautan} onClick={() => setMenunggu(null)}>
              Batal
            </button>
          </div>
        )}
      </Lembar>
      <PesanSingkat pesan={pesan} />
    </KerangkaLayar>
  );
}
