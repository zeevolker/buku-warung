// Beranda.jsx: layar utama. Isi laci, tombol mencatat, bon, dan catatan hari ini.
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { AnimatePresence, m } from "motion/react";
import AngkaHitung from "../../komponen/AngkaHitung.jsx";
import { usePengenalSuara, useSuaraTersedia } from "../../komponen/lembar/pengenalSuara.js";
import PitaStatus from "./PitaStatus.jsx";
import { aturMeta } from "../../data/db.js";
import { useAkun } from "../../data/akun.js";
import { supabaseAktif } from "../../data/supabase.js";
import BarisCatatan from "../../komponen/BarisCatatan.jsx";
import PesanSingkat, { usePesan } from "../../komponen/PesanSingkat.jsx";
import { useBarang, useCatatanHari, useIsi, useJumlahCatatan, useMeta, useNamaWarung, usePelanggan, usePengingat, useSekarang, useTanggalHariIni } from "../../data/pakai.js";
import { arusWarung } from "../../data/hitung.js";
import { formatRupiah } from "../../data/format.js";
import gaya from "./Beranda.module.css";

// Lembar tidak ikut dimuat di layar pertama. Tiga yang paling sering dipakai disiapkan
// sesudah layar tampil, supaya tetap terasa langsung saat ditekan.
const muatJual = () => import("../../komponen/lembar/LembarJual.jsx");
const muatBelanja = () => import("../../komponen/lembar/LembarBelanja.jsx");
const muatTerimaBon = () => import("../../komponen/lembar/LembarTerimaBon.jsx");
const muatParser = () => import("../../data/suara.js");
const LembarJual = lazy(muatJual);
const LembarBelanja = lazy(muatBelanja);
const LembarTerimaBon = lazy(muatTerimaBon);
const LembarLaci = lazy(() => import("../../komponen/lembar/LembarLaci.jsx"));
const LembarHitungUlang = lazy(() => import("../../komponen/lembar/LembarHitungUlang.jsx"));
const LembarRincian = lazy(() => import("../../komponen/lembar/LembarRincian.jsx"));
const LembarBarang = lazy(() => import("../Barang/LembarBarang.jsx"));
const LembarSuara = lazy(() => import("../../komponen/lembar/LembarSuara.jsx"));
const LembarAjakan = lazy(() => import("./LembarAjakan.jsx"));
const Panduan = lazy(() => import("./Panduan.jsx"));
const JEDA_SIAPKAN = 1500;

// Dipasang saat pertama kali dibuka, lalu tetap terpasang supaya animasi tutupnya berjalan
function Malas({ aktif, children }) {
  const pernah = useRef(false);
  if (aktif) pernah.current = true;
  return pernah.current ? <Suspense fallback={null}>{children}</Suspense> : null;
}

const JUMLAH_DAFTAR = 4;
const LAMA_PESAN_SUARA = 8000; // pesannya berisi petunjuk, jadi perlu waktu untuk dibaca
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

  const [lembar, setLembar] = useState(null); // "jual" | "belanja" | "barangBaru" | "bon" | "laci" | "hitung" | "suara"
  const [barangAwal, setBarangAwal] = useState(null); // barang yang langsung terpilih di lembar Belanja
  const [isianSuara, setIsianSuara] = useState(null); // isian lembar dari hasil suara
  const [belumPaham, setBelumPaham] = useState(null); // ucapan yang tidak dimengerti
  const barang = useBarang();
  const suaraTersedia = useSuaraTersedia();
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

  useEffect(() => {
    const timer = setTimeout(() => {
      for (const muat of [muatJual, muatBelanja, muatTerimaBon]) muat().catch(() => {});
    }, JEDA_SIAPKAN);
    return () => clearTimeout(timer);
  }, []);

  // Hasil suara hanya membuka lembar yang sesuai dalam keadaan terisi. Tidak pernah menyimpan sendiri.
  async function prosesUcapan(teks) {
    const { uraikanKalimat } = await muatParser();
    const hasil = uraikanKalimat(teks, { barang, pelanggan });
    if (!hasil.jenis) return setBelumPaham(teks);
    setBarangAwal(null);
    if (hasil.jenis === "jual") {
      setIsianSuara(hasil);
      setLembar("jual");
    } else if (hasil.jenis === "terimaBon") {
      setIsianSuara(hasil);
      setLembar("bon");
    } else {
      setIsianSuara({ ...hasil, jenis: hasil.jenis === "belanja" ? "stok" : hasil.jenis });
      setLembar("belanja");
    }
    tampilkanPesan("Periksa dulu, lalu Simpan");
  }

  const pengenal = usePengenalSuara({
    onSelesai: prosesUcapan,
    onGalat: (pesanGalat) => {
      setLembar(null);
      tampilkanPesan(pesanGalat, LAMA_PESAN_SUARA);
    },
  });

  function bukaSuara() {
    setBelumPaham(null);
    pengenal.mulai(); // harus langsung dari tombol yang ditekan
    muatParser();
    setLembar("suara");
  }

  function bukaManual(nama) {
    setIsianSuara(null);
    setBarangAwal(null);
    setLembar(nama);
  }
  const arus = arusWarung(hariIni);
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
          {arus.masuk > 0 || arus.keluar > 0 ? (
            <>
              Hari ini {arus.masuk > 0 && <span className={gaya.kapsulMasuk}>+{formatRupiah(arus.masuk)}</span>}
              {arus.keluar > 0 && <span className={gaya.kapsulKeluar}>−{formatRupiah(arus.keluar)}</span>}
            </>
          ) : hariIni.length ? (
            "Belum ada uang masuk atau keluar hari ini"
          ) : (
            "Belum ada catatan hari ini"
          )}
        </span>
      </section>

      <div className={gaya.barisJual}>
        <m.button type="button" data-panduan="jual" className={gaya.tombolJual} whileTap={{ scale: 0.98 }} onClick={() => bukaManual("jual")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Jual
        </m.button>
        {suaraTersedia && (
          <button type="button" className={gaya.tombolSuara} aria-label="Catat dengan suara" onClick={bukaSuara}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </button>
        )}
      </div>

      <div className={gaya.tigaTombol}>
        <button type="button" data-panduan="belanja" className={gaya.petak} onClick={() => bukaManual("belanja")}>
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
        <button type="button" data-panduan="bon" className={gaya.petak} onClick={() => bukaManual("bon")}>
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

      <Malas aktif={lembar === "suara"}>
        <LembarSuara
          terbuka={lembar === "suara"}
          teks={pengenal.teks}
          belumPaham={belumPaham}
          onSelesai={pengenal.berhenti}
          onBatal={() => {
            pengenal.batal();
            tutup();
          }}
          onKetik={() => bukaManual("jual")}
          onCobaLagi={bukaSuara}
        />
      </Malas>
      <Malas aktif={lembar === "jual"}>
        <LembarJual terbuka={lembar === "jual"} awal={isianSuara} onTutup={tutup} onTersimpan={tampilkanPesan} />
      </Malas>
      <Malas aktif={lembar === "belanja"}>
        <LembarBelanja terbuka={lembar === "belanja"} awal={isianSuara} barangAwal={barangAwal} onTutup={tutup} onTersimpan={tampilkanPesan} onBarangBaru={() => setLembar("barangBaru")} />
      </Malas>
      <Malas aktif={lembar === "barangBaru"}>
        <LembarBarang
          terbuka={lembar === "barangBaru"}
          asalAwal="dibeli"
          onTutup={tutup}
          onTersimpan={tampilkanPesan}
          onTambahStok={(id) => {
            setIsianSuara(null);
            setBarangAwal(id);
            setLembar("belanja");
          }}
        />
      </Malas>
      <Malas aktif={lembar === "bon"}>
        <LembarTerimaBon terbuka={lembar === "bon"} pelangganAwal={isianSuara?.pelanggan_id} nominalAwal={isianSuara?.nominal} onTutup={tutup} onTersimpan={tampilkanPesan} />
      </Malas>
      <Malas aktif={lembar === "laci"}>
        <LembarLaci terbuka={lembar === "laci"} onTutup={tutup} onTersimpan={tampilkanPesan} onHitungUlang={() => setLembar("hitung")} />
      </Malas>
      <Malas aktif={lembar === "hitung"}>
        <LembarHitungUlang terbuka={lembar === "hitung"} onTutup={tutup} onTersimpan={tampilkanPesan} />
      </Malas>
      <Malas aktif={Boolean(rincian)}>
        <LembarRincian
          catatan={rincian}
          onTutup={() => setRincian(null)}
          onTersimpan={tampilkanPesan}
          onHitungUlang={() => {
            setRincian(null);
            setLembar("hitung");
          }}
        />
      </Malas>

      <Malas aktif={Boolean(tampilCocokkan)}>
        <LembarHitungUlang terbuka={tampilCocokkan} judul="Cocokkan isi laci" onTutup={() => aturMeta("cocokkan_laci", 0)} onTersimpan={tampilkanPesan} />
      </Malas>
      <Malas aktif={Boolean(tampilAjakan)}>
        <LembarAjakan terbuka={tampilAjakan} jumlah={jumlahCatatan} onNanti={() => aturMeta("ajakan_berikut", jumlahCatatan + AJAKAN_BERIKUTNYA)} />
      </Malas>
      {Boolean(tutorial) && (
        <Suspense fallback={null}>
          <Panduan onSelesai={() => aturMeta("tutorial", 0)} />
        </Suspense>
      )}
      <PesanSingkat pesan={pesan} />
    </div>
  );
}
