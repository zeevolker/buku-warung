// Beranda.jsx: layar utama. Isi laci, tombol mencatat, bon, dan catatan hari ini.
import { useState } from "react";
import { Link } from "react-router";
import { AnimatePresence, m } from "motion/react";
import AngkaHitung from "../../komponen/AngkaHitung.jsx";
import LembarJual from "../../komponen/lembar/LembarJual.jsx";
import LembarBelanja from "../../komponen/lembar/LembarBelanja.jsx";
import LembarTerimaBon from "../../komponen/lembar/LembarTerimaBon.jsx";
import LembarLaci from "../../komponen/lembar/LembarLaci.jsx";
import LembarHitungUlang from "../../komponen/lembar/LembarHitungUlang.jsx";
import LembarRincian from "../../komponen/lembar/LembarRincian.jsx";
import LembarBarang from "../Barang/LembarBarang.jsx";
import Panduan from "./Panduan.jsx";
import PitaStatus from "./PitaStatus.jsx";
import LembarAjakan from "./LembarAjakan.jsx";
import { aturMeta } from "../../data/db.js";
import { useAkun } from "../../data/akun.js";
import { supabaseAktif } from "../../data/supabase.js";
import BarisCatatan from "../../komponen/BarisCatatan.jsx";
import PesanSingkat, { usePesan } from "../../komponen/PesanSingkat.jsx";
import { useCatatanHari, useIsi, useJumlahCatatan, useMeta, useNamaWarung, usePelanggan, usePengingat, useSekarang, useTanggalHariIni } from "../../data/pakai.js";
import { arusLaci } from "../../data/hitung.js";
import { formatRupiah } from "../../data/format.js";
import gaya from "./Beranda.module.css";

const JUMLAH_DAFTAR = 4;
const AJAKAN_PERTAMA = 10; // ajakan simpan ke cloud muncul setelah sekian catatan
const AJAKAN_BERIKUTNYA = 20; // "Nanti saja": muncul lagi setelah sekian catatan lagi
const WARNA_TITIK = { sinkron: "#5aa77c", menyinkron: "#5aa77c", offline: "#d9a93e", gagal: "#b5583a", tamu: "#a3a59e" };
const LABEL_STATUS = { sinkron: "tersimpan di cloud", menyinkron: "sedang menyimpan", offline: "offline", gagal: "gagal menyimpan", tamu: "data tersimpan di HP ini" };

function ikonGaris(isi, warna) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={warna} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {isi}
    </svg>
  );
}

export default function Beranda() {
  const tanggal = useTanggalHariIni();
  const isi = useIsi();
  const pelanggan = usePelanggan();
  const hariIni = useCatatanHari(tanggal);
  const namaWarung = useNamaWarung() || "Buku Warung";
  const daftarPengingat = usePengingat();
  const sekarang = useSekarang();
  const belumSelesai = daftarPengingat.filter((p) => !p.selesai);
  const pengingat = belumSelesai.length;
  const sudahWaktunya = belumSelesai.filter((p) => p.waktu_ingat && p.waktu_ingat <= sekarang).length;

  const [lembar, setLembar] = useState(null); // "jual" | "belanja" | "barangBaru" | "bon" | "laci" | "hitung"
  const [barangAwal, setBarangAwal] = useState(null); // barang yang langsung terpilih di lembar Belanja
  const [rincian, setRincian] = useState(null);
  const { pesan, tampilkanPesan } = usePesan();
  const akun = useAkun();
  const jumlahCatatan = useJumlahCatatan();
  const tutorial = useMeta("tutorial");
  const cocokkanLaci = useMeta("cocokkan_laci");
  const ajakanBerikut = useMeta("ajakan_berikut");

  // Hanya satu lembar otomatis pada satu waktu, dan tidak menimpa lembar yang sedang dibuka
  const bebas = !lembar && !rincian && !tutorial;
  const tampilCocokkan = Boolean(cocokkanLaci) && bebas;
  const tampilAjakan = !akun.email && supabaseAktif() && bebas && !cocokkanLaci && jumlahCatatan >= (ajakanBerikut || AJAKAN_PERTAMA);

  const tutup = () => setLembar(null);
  const arus = arusLaci(hariIni);
  const totalBon = Object.values(isi?.bon || {}).reduce((n, b) => n + Math.max(0, b), 0);
  const namaDari = (id) => pelanggan.find((p) => p.id === id)?.nama;

  return (
    <div className={gaya.layar}>
      <header className={gaya.kepala}>
        <h1>{namaWarung}</h1>
        <Link to="/catatan" className={gaya.bulat} aria-label={pengingat ? `Catatan, ${pengingat} belum selesai` : "Catatan"}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="5" y="3" width="14" height="18" rx="3" />
            <path d="M9 8h6M9 12h6M9 16h3" />
          </svg>
          {pengingat > 0 && <span className={gaya.lencana}>{pengingat}</span>}
        </Link>
        <Link to="/akun" className={gaya.avatar} aria-label={`Akun, ${LABEL_STATUS[akun.keadaan]}`}>
          {namaWarung[0].toUpperCase()}
          <span className={gaya.titik} style={{ background: WARNA_TITIK[akun.keadaan] }} />
        </Link>
      </header>

      <PitaStatus akun={akun} />

      <section className={gaya.kartuLaci} aria-label="Isi laci">
        <span className={gaya.labelLaci}>Isi laci</span>
        <strong className={gaya.angkaLaci}>{isi ? <AngkaHitung nilai={isi.laci} /> : " "}</strong>
        <span className={gaya.hariIni}>
          {hariIni.length ? (
            <>
              Hari ini {arus.masuk > 0 && <span className={gaya.kapsulMasuk}>+{formatRupiah(arus.masuk)}</span>}
              {arus.keluar > 0 && <span className={gaya.kapsulKeluar}>−{formatRupiah(arus.keluar)}</span>}
            </>
          ) : (
            "Belum ada catatan hari ini"
          )}
        </span>
      </section>

      <div className={gaya.barisJual}>
        <m.button type="button" data-panduan="jual" className={gaya.tombolJual} whileTap={{ scale: 0.98 }} onClick={() => setLembar("jual")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Jual
        </m.button>
        {/* Catat dengan suara dikerjakan di Tahap 5 */}
        <button type="button" className={gaya.tombolSuara} aria-label="Catat dengan suara, belum tersedia" disabled>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </button>
      </div>

      <div className={gaya.tigaTombol}>
        <button type="button" data-panduan="belanja" className={gaya.petak} onClick={() => {
            setBarangAwal(null);
            setLembar("belanja");
          }}>
          <span className={gaya.ikonPetak} style={{ background: "var(--keluar-latar)" }}>
            {ikonGaris(
              <>
                <path d="M6 7h12l-1 13H7z" />
                <path d="M9 7a3 3 0 0 1 6 0" />
              </>,
              "#b5583a"
            )}
          </span>
          Belanja
        </button>
        <button type="button" data-panduan="bon" className={gaya.petak} onClick={() => setLembar("bon")}>
          <span className={gaya.ikonPetak} style={{ background: "var(--bon-latar)" }}>
            {ikonGaris(<path d="M5 12l5 5L19 7" />, "#7d5a12")}
          </span>
          Terima bon
        </button>
        <button type="button" className={gaya.petak} onClick={() => setLembar("laci")}>
          <span className={gaya.ikonPetak} style={{ background: "var(--laci-latar)" }}>
            {ikonGaris(
              <>
                <rect x="3" y="7" width="18" height="12" rx="3" />
                <path d="M3 11h18" />
              </>,
              "#3c6b52"
            )}
          </span>
          Laci
        </button>
      </div>

      {sudahWaktunya > 0 && (
        <Link to="/catatan" className={gaya.stripPengingat}>
          {sudahWaktunya} pengingat sudah waktunya
        </Link>
      )}

      {totalBon > 0 && (
        <Link to="/pelanggan" className={gaya.stripBon}>
          <span>Bon pelanggan</span>
          <strong>{formatRupiah(totalBon)}</strong>
        </Link>
      )}

      {hariIni.length > 0 ? (
        <section aria-labelledby="judul-hari-ini">
          <div className={gaya.judulBagian}>
            <h2 id="judul-hari-ini">Hari ini</h2>
            <Link to="/riwayat">Semua riwayat</Link>
          </div>
          <ul className={gaya.daftar}>
            <AnimatePresence initial={false}>
              {hariIni.slice(0, JUMLAH_DAFTAR).map((c) => (
                <m.li key={c.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  <BarisCatatan catatan={c} nama={namaDari(c.pelanggan_id)} onBuka={setRincian} />
                </m.li>
              ))}
            </AnimatePresence>
          </ul>
        </section>
      ) : (
        <div className={gaya.kosong}>
          <strong>Belum ada catatan</strong>
          <span>
            Ada barang laku? Tekan Jual.
            <br />
            Belum ada barang? Tambahkan dulu.
          </span>
          <Link to="/barang">+ Tambah barang</Link>
        </div>
      )}

      <LembarJual terbuka={lembar === "jual"} onTutup={tutup} onTersimpan={tampilkanPesan} />
      <LembarBelanja terbuka={lembar === "belanja"} barangAwal={barangAwal} onTutup={tutup} onTersimpan={tampilkanPesan} onBarangBaru={() => setLembar("barangBaru")} />
      <LembarBarang
        terbuka={lembar === "barangBaru"}
        asalAwal="dibeli"
        onTutup={tutup}
        onTersimpan={tampilkanPesan}
        onTambahStok={(id) => {
          setBarangAwal(id);
          setLembar("belanja");
        }}
      />
      <LembarTerimaBon terbuka={lembar === "bon"} onTutup={tutup} onTersimpan={tampilkanPesan} />
      <LembarLaci terbuka={lembar === "laci"} onTutup={tutup} onTersimpan={tampilkanPesan} onHitungUlang={() => setLembar("hitung")} />
      <LembarHitungUlang terbuka={lembar === "hitung"} onTutup={tutup} onTersimpan={tampilkanPesan} />
      <LembarRincian
        catatan={rincian}
        onTutup={() => setRincian(null)}
        onTersimpan={tampilkanPesan}
        onHitungUlang={() => {
          setRincian(null);
          setLembar("hitung");
        }}
      />

      <LembarHitungUlang terbuka={tampilCocokkan} judul="Cocokkan isi laci" onTutup={() => aturMeta("cocokkan_laci", 0)} onTersimpan={tampilkanPesan} />
      <LembarAjakan terbuka={tampilAjakan} jumlah={jumlahCatatan} onNanti={() => aturMeta("ajakan_berikut", jumlahCatatan + AJAKAN_BERIKUTNYA)} />
      {Boolean(tutorial) && <Panduan onSelesai={() => aturMeta("tutorial", 0)} />}
      <PesanSingkat pesan={pesan} />
    </div>
  );
}
