// Masuk.jsx: masuk dan daftar dengan email, lupa kata sandi, dan membuat kata sandi baru.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import KerangkaLayar from "../../komponen/KerangkaLayar.jsx";
import Geser from "../../komponen/Geser.jsx";
import { ambilMeta } from "../../data/db.js";
import { useAkun, masukEmail, daftarEmail, lupaSandi, simpanSandiBaru, emailValid, iphoneLayarUtama } from "../../data/akun.js";
import bersama from "../../komponen/lembar/bersama.module.css";
import umum from "../../komponen/umum.module.css";
import gaya from "./Masuk.module.css";

const PANJANG_SANDI = 8;

function SandiBaru({ onSelesai }) {
  const [sandi, setSandi] = useState("");
  const [galat, setGalat] = useState("");

  async function simpan() {
    if (sandi.length < PANJANG_SANDI) return setGalat(`Kata sandi minimal ${PANJANG_SANDI} huruf atau angka.`);
    const hasil = await simpanSandiBaru(sandi);
    if (hasil.galat) return setGalat(hasil.galat);
    onSelesai();
  }

  return (
    <KerangkaLayar judul="Buat kata sandi baru">
      <label className={umum.bidang}>
        Kata sandi baru
        <input className={bersama.input} type="password" autoComplete="new-password" value={sandi} onChange={(e) => setSandi(e.target.value)} />
      </label>
      <p className={bersama.galat} role="alert">
        {galat}
      </p>
      <button type="button" className={bersama.simpan} onClick={simpan}>
        Simpan
      </button>
    </KerangkaLayar>
  );
}

export default function Masuk() {
  const akun = useAkun();
  const pindah = useNavigate();
  const mulaiSelesai = useLiveQuery(() => ambilMeta("mulai_selesai"));

  const [mode, setMode] = useState("masuk");
  const [email, setEmail] = useState("");
  const [sandi, setSandi] = useState("");
  const [lihatSandi, setLihatSandi] = useState(false);
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState("");
  const [info, setInfo] = useState("");

  // Selesai membuat kata sandi baru langsung ke Beranda, bukan ke Akun
  const dariPulihkan = useRef(false);
  if (akun.pulihkanSandi) dariPulihkan.current = true;
  const tujuan = dariPulihkan.current ? "/" : mulaiSelesai ? "/akun" : "/mulai";

  // Sudah berhasil masuk: lanjut
  useEffect(() => {
    if (akun.email && !akun.pulihkanSandi && mulaiSelesai !== undefined) pindah(tujuan, { replace: true });
  }, [akun.email, akun.pulihkanSandi, mulaiSelesai, tujuan, pindah]);

  if (akun.pulihkanSandi) return <SandiBaru onSelesai={() => pindah("/", { replace: true })} />;

  function ubahMode(baru) {
    setMode(baru);
    setGalat("");
    setInfo("");
  }

  async function kirim(e) {
    e.preventDefault();
    setGalat("");
    setInfo("");
    const alamat = email.trim();
    if (!emailValid(alamat)) return setGalat("Tulis alamat email yang benar.");
    if (sandi.length < PANJANG_SANDI) return setGalat(`Kata sandi minimal ${PANJANG_SANDI} huruf atau angka.`);

    setProses(true);
    const hasil = mode === "daftar" ? await daftarEmail(alamat, sandi) : await masukEmail(alamat, sandi);
    setProses(false);

    if (hasil.galat) return setGalat(hasil.galat);
    if (hasil.sudahTerdaftar) {
      setMode("masuk");
      return setGalat("Email ini sudah punya akun, misalnya dari login Google. Tekan Lupa kata sandi untuk membuat kata sandi, lalu masuk.");
    }
    if (hasil.perluKonfirmasi) {
      setMode("masuk");
      setInfo(`Akun dibuat. Buka email di ${alamat}, tekan tautan konfirmasinya, lalu kembali ke sini dan masuk.`);
    }
    // Kalau berhasil masuk, useEffect di atas yang memindahkan layar
  }

  async function tekanLupa() {
    setInfo("");
    const alamat = email.trim();
    if (!emailValid(alamat)) return setGalat("Tulis email akunmu dulu, lalu tekan Lupa kata sandi.");
    const hasil = await lupaSandi(alamat);
    if (hasil.galat) return setGalat(hasil.galat);
    setGalat("");
    setInfo(`Tautan untuk membuat kata sandi baru dikirim ke ${alamat}.`);
  }

  return (
    <KerangkaLayar judul="Masuk dengan email" kembali={tujuan}>
      <Geser
        label="Masuk atau daftar"
        pilihan={[
          { nilai: "masuk", label: "Masuk" },
          { nilai: "daftar", label: "Daftar baru" },
        ]}
        nilai={mode}
        onUbah={ubahMode}
        warna="var(--teks)"
      />
      <form className={gaya.form} onSubmit={kirim} noValidate>
        <label className={umum.bidang}>
          Email
          <input className={bersama.input} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className={umum.bidang}>
          Kata sandi
          <span className={gaya.kolomSandi}>
            <input className={bersama.input} type={lihatSandi ? "text" : "password"} autoComplete={mode === "daftar" ? "new-password" : "current-password"} value={sandi} onChange={(e) => setSandi(e.target.value)} />
            <button type="button" className={gaya.lihat} aria-label={lihatSandi ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} aria-pressed={lihatSandi} onClick={() => setLihatSandi(!lihatSandi)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </span>
        </label>
        <p className={bersama.galat} role="alert">
          {galat}
        </p>
        {info && (
          <p className={gaya.info} role="status">
            {info}
          </p>
        )}
        <button type="submit" className={bersama.simpan} disabled={proses}>
          {mode === "daftar" ? "Daftar" : "Masuk"}
        </button>
      </form>
      {mode === "masuk" && (
        <button type="button" className={bersama.tautan} onClick={tekanLupa}>
          Lupa kata sandi?
        </button>
      )}
      {iphoneLayarUtama() && <p className={gaya.catatan}>Di aplikasi layar utama iPhone, masuk dengan email dan kata sandi. Login Google hanya bisa lewat Safari.</p>}
    </KerangkaLayar>
  );
}
