// Cetak.jsx: laporan sebagai halaman A4. PDF dibuat lewat dialog cetak bawaan browser
// ("Simpan sebagai PDF"), jadi tidak perlu library PDF.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db, ambilMeta, semuaAda } from "../../data/db.js";
import { alamatSah, bagiBlok, judulDokumen, NAMA_LAPORAN, rentangLaporan } from "../../data/laporan.js";
import { hariIni } from "../../data/tanggal.js";
import { IkonAplikasi } from "./bagian.jsx";
import { jumlahCatatanDalam, susunLaporan } from "./susunLaporan.jsx";
import gaya from "./Cetak.module.css";

// Tinggi yang tersedia untuk isi, dalam px. A4 = 1123, dikurangi margin 48 atas dan 40 bawah,
// kaki 30, kop, dan sedikit cadangan kalau font cadangan yang terpakai ternyata lebih lebar.
const CADANGAN = 8;
export const RUANG = { ruangPertama: 1123 - 48 - 40 - 30 - 100 - CADANGAN, ruang: 1123 - 48 - 40 - 30 - 38 - CADANGAN };

const JEDA_SEBELUM_CETAK = 300; // menunggu transisi layar selesai
const BATAS_TUNGGU_FONT = 3000; // saat offline font bisa tidak pernah siap

function fontSiap() {
  const fonts = document.fonts;
  const tunggu = fonts ? Promise.all(["400 13px", "600 13px", "800 18px"].map((f) => fonts.load(`${f} "Plus Jakarta Sans"`))).then(() => fonts.ready) : Promise.resolve();
  const batas = new Promise((selesai) => setTimeout(selesai, BATAS_TUNGGU_FONT));
  return Promise.race([tunggu.catch(() => {}), batas]).then(() => new Promise((selesai) => setTimeout(selesai, JEDA_SEBELUM_CETAK)));
}

function Kop({ namaWarung, periode, labelPeriode, dicetak, selesai, jumlah }) {
  const SELESAI = { hari: "Hari sudah selesai", minggu: "Minggu sudah selesai", bulan: "Bulan sudah selesai" };
  return (
    <header className={gaya.kop}>
      <IkonAplikasi />
      <div className={gaya.kopTengah}>
        <span className={gaya.labelKop}>BUKU WARUNG · LAPORAN {NAMA_LAPORAN[periode].toUpperCase()}</span>
        <h1>{namaWarung}</h1>
        <span>{labelPeriode}</span>
      </div>
      <div className={gaya.kopKanan}>
        <span>Dicetak {dicetak}</span>
        <span>{selesai ? SELESAI[periode] : "Data sampai saat dicetak"}</span>
        <span>{jumlah} catatan</span>
      </div>
    </header>
  );
}

// Semua halaman satu laporan. Dipisah dari layar supaya bisa dites tanpa dialog cetak.
export function HalamanCetak({ periode, tanggal, data, kini, dicetak }) {
  const laporan = useMemo(() => susunLaporan(periode, tanggal, data, kini), [periode, tanggal, data, kini]);
  const halaman = useMemo(() => bagiBlok(laporan.blok, RUANG), [laporan]);
  const jumlah = jumlahCatatanDalam(data.catatan, laporan.rentang);

  return (
    <div className={gaya.lembaran}>
      {halaman.map((isi, i) => (
        <section key={i} className={gaya.halaman} aria-label={`Halaman ${i + 1}`}>
          {i === 0 ? (
            <Kop namaWarung={data.namaWarung} periode={periode} labelPeriode={laporan.labelPeriode} dicetak={dicetak} selesai={laporan.selesai} jumlah={jumlah} />
          ) : (
            <header className={gaya.kopLanjut}>
              <strong>
                {data.namaWarung} · Laporan {NAMA_LAPORAN[periode]}
              </strong>
              <span>{laporan.labelPeriode}</span>
            </header>
          )}
          <div className={gaya.isi}>
            {isi.map((bagian, j) => (
              <div key={j} className={gaya.blok}>
                {bagian.blok.baris ? bagian.blok.gambar(bagian) : bagian.blok.isi}
              </div>
            ))}
          </div>
          <footer className={gaya.kaki}>
            <span>Dibuat otomatis oleh Buku Warung · zeevolker.github.io/buku-warung</span>
            <span>
              Halaman {i + 1} dari {halaman.length}
            </span>
          </footer>
        </section>
      ))}
    </div>
  );
}

async function bacaData() {
  // Termasuk barang dan pelanggan yang sudah dihapus, karena riwayat lama masih menyebut namanya
  const [catatan, barang, pelanggan, namaWarung] = await Promise.all([semuaAda(db.catatan), db.barang.toArray(), db.pelanggan.toArray(), ambilMeta("nama_warung")]);
  const nama = new Map(pelanggan.map((p) => [p.id, p.nama]));
  return { catatan, barang, namaWarung: namaWarung || "Buku Warung", namaDari: (id) => nama.get(id) || "pelanggan" };
}

const labelDicetak = () => new Date().toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function Cetak() {
  const { periode, tanggal } = useParams();
  const pindah = useNavigate();
  const sah = alamatSah(periode, tanggal);
  const [kini] = useState(hariIni);
  const [dicetak] = useState(labelDicetak);
  const [skala, setSkala] = useState(1);
  const data = useLiveQuery(bacaData);
  const siap = sah && Boolean(data);
  const sudahDicetak = useRef(false);

  const cetak = () => {
    sudahDicetak.current = true;
    window.print();
  };

  // Rentang periode untuk nama file
  const rentang = useMemo(() => (sah ? rentangLaporan(periode, tanggal) : null), [sah, periode, tanggal]);

  useEffect(() => {
    if (!rentang) return;
    const judulLama = document.title;
    document.title = judulDokumen(periode, rentang);
    document.body.classList.add("sedang-cetak");
    return () => {
      document.title = judulLama;
      document.body.classList.remove("sedang-cetak");
    };
  }, [periode, rentang]);

  // Di HP halaman A4 diperkecil supaya muat di layar. Hasil cetaknya tetap ukuran penuh.
  useEffect(() => {
    const ukur = () => setSkala(Math.min(1, (window.innerWidth - 16) / 794));
    ukur();
    window.addEventListener("resize", ukur);
    return () => window.removeEventListener("resize", ukur);
  }, []);

  // Sekali saja, setelah data dan font siap
  useEffect(() => {
    if (!siap || sudahDicetak.current) return;
    let batal = false;
    fontSiap().then(() => {
      if (!batal && !sudahDicetak.current) cetak();
    });
    return () => {
      batal = true;
    };
  }, [siap]);

  const kembali = () => pindah("/laporan", { replace: true, state: { periode, bulan: periode === "bulan" ? tanggal : undefined } });

  if (!sah) {
    return (
      <div className={gaya.salah}>
        <p>Alamat laporan ini tidak dikenali.</p>
        <button type="button" onClick={() => pindah("/laporan", { replace: true })}>
          Kembali ke Laporan
        </button>
      </div>
    );
  }

  return (
    <div className={gaya.layar} style={{ "--skala": skala }}>
      <div className={gaya.alat}>
        <button type="button" onClick={kembali}>
          Kembali
        </button>
        <button type="button" className={gaya.tombolUtama} disabled={!siap} onClick={cetak}>
          Simpan PDF
        </button>
        <p>Pilih "Simpan sebagai PDF" di dialog cetak. Kalau dialognya tidak muncul, tekan Simpan PDF.</p>
      </div>
      {siap && <HalamanCetak periode={periode} tanggal={tanggal} data={data} kini={kini} dicetak={dicetak} />}
    </div>
  );
}
