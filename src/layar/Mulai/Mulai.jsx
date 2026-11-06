// Mulai.jsx: pertama kali membuka aplikasi. Selamat datang + login, nama warung, uang di laci.
// Sesudah itu Beranda menampilkan panduan 3 tombol.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import InputRupiah from "../../komponen/InputRupiah.jsx";
import TombolGoogle from "../../komponen/TombolGoogle.jsx";
import { aturMeta, ambilMeta, db } from "../../data/db.js";
import { aturNamaWarung, useAkun } from "../../data/akun.js";
import { supabaseAktif } from "../../data/supabase.js";
import { uangAwal } from "../../data/aksi.js";
import { ribuan } from "../../data/format.js";
import bersama from "../../komponen/lembar/bersama.module.css";
import gaya from "./Mulai.module.css";

const PILIHAN_UANG = [0, 200000, 1000000];

function Sambutan({ onTamu }) {
  const pindah = useNavigate();
  return (
    <div className={gaya.layar}>
      <div className={gaya.tengah}>
        <div className={gaya.logo}>
          <svg width="78" height="78" viewBox="0 0 80 80" fill="none" aria-hidden="true">
            <circle cx="40" cy="20" r="11" fill="#f2d27a" />
            <path d="M35 20h10M40 15v10" stroke="#7d5a12" strokeWidth="3" strokeLinecap="round" />
            <path d="M8 38c10-5 21-5 32 2v30c-11-7-22-7-32-2V38Z" fill="#fff" />
            <path d="M72 38c-10-5-21-5-32 2v30c11-7 22-7 32-2V38Z" fill="#e4f0e8" />
            <path d="M16 48c6-2 11-2 16 1M16 56c6-2 11-2 16 1M48 49c5-3 10-3 16-1M48 57c5-3 10-3 16-1" stroke="#7fb898" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className={gaya.judulBesar}>Buku Warung</h1>
        <p className={gaya.slogan}>
          Sekali tekan,
          <br />
          <strong>untung langsung kelihatan.</strong>
        </p>
      </div>
      <div className={gaya.bawah}>
        {supabaseAktif() && (
          <>
            <TombolGoogle />
            <button type="button" className={bersama.simpan} onClick={() => pindah("/masuk")}>
              Masuk dengan email
            </button>
            <span className={gaya.kecil}>Data tersimpan aman di cloud dan bisa dibuka di HP lain.</span>
          </>
        )}
        {supabaseAktif() ? (
          <button type="button" className={bersama.tautan} onClick={onTamu}>
            Coba dulu tanpa akun
          </button>
        ) : (
          <button type="button" className={bersama.simpan} onClick={onTamu}>
            Mulai
          </button>
        )}
      </div>
    </div>
  );
}

function Langkah({ nomor, judul, isi, keterangan, bisaLanjut, onLanjut }) {
  return (
    <div className={gaya.layarLangkah}>
      <div className={gaya.isiLangkah}>
        <span className={gaya.nomor}>Langkah {nomor} dari 2</span>
        <h1 className={gaya.judulBesar}>{judul}</h1>
        {keterangan && <p className={gaya.keterangan}>{keterangan}</p>}
        {isi}
      </div>
      <button type="button" className={bersama.simpan} disabled={!bisaLanjut} onClick={onLanjut}>
        Lanjut
      </button>
    </div>
  );
}

export default function Mulai() {
  const akun = useAkun();
  const pindah = useNavigate();
  const [langkah, setLangkah] = useState("sambutan");
  const [nama, setNama] = useState("");
  const [uang, setUang] = useState(null);

  // Sudah punya akun dan data di cloud: tidak perlu mengisi apa pun lagi
  useEffect(() => {
    if (!akun.email || akun.keadaan === "menyinkron") return;
    let batal = false;
    (async () => {
      const namaAda = await ambilMeta("nama_warung");
      if (batal) return;
      if (await db.catatan.count()) {
        await aturMeta("mulai_selesai", 1);
        pindah("/", { replace: true });
        return;
      }
      if (namaAda) setNama(namaAda);
      setLangkah((l) => (l === "sambutan" ? "nama" : l));
    })();
    return () => {
      batal = true;
    };
  }, [akun.email, akun.keadaan, pindah]);

  async function selesai() {
    if (uang > 0) await uangAwal(uang);
    await aturMeta("mulai_selesai", 1);
    await aturMeta("tutorial", 1);
    pindah("/", { replace: true });
  }

  if (langkah === "sambutan") {
    if (akun.email) return <p className={gaya.memuat}>Menyiapkan datamu…</p>;
    return <Sambutan onTamu={() => setLangkah("nama")} />;
  }

  if (langkah === "nama") {
    return (
      <Langkah
        nomor={1}
        judul="Apa nama warungmu?"
        bisaLanjut={nama.trim().length > 0}
        onLanjut={async () => {
          await aturNamaWarung(nama);
          setLangkah("uang");
        }}
        isi={<input className={gaya.kolomNama} aria-label="Nama warung" autoComplete="off" value={nama} onChange={(e) => setNama(e.target.value)} />}
      />
    );
  }

  return (
    <Langkah
      nomor={2}
      judul="Berapa uang di laci sekarang?"
      keterangan="Hitung uang tunainya. Boleh Rp 0."
      bisaLanjut={uang !== null}
      onLanjut={selesai}
      isi={
        <>
          <InputRupiah label="Uang di laci" besar nilai={uang} onUbah={setUang} />
          <div className={gaya.pilihanUang}>
            {PILIHAN_UANG.map((n) => (
              <button key={n} type="button" className={bersama.chip} onClick={() => setUang(n)}>
                {n === 0 ? "Rp 0" : ribuan(n)}
              </button>
            ))}
          </div>
        </>
      }
    />
  );
}
