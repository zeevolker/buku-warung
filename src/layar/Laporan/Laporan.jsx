// Laporan.jsx: rumus yang sama, beda rentang dan pertanyaan: Hari, Minggu, Bulan.
import { useMemo, useState } from "react";
import { Link } from "react-router";
import KerangkaLayar from "../../komponen/KerangkaLayar.jsx";
import Geser from "../../komponen/Geser.jsx";
import GrafikBatang from "../../komponen/GrafikBatang.jsx";
import BarisCatatan from "../../komponen/BarisCatatan.jsx";
import PesanSingkat, { usePesan } from "../../komponen/PesanSingkat.jsx";
import LembarRincian from "../../komponen/lembar/LembarRincian.jsx";
import LembarUnduh from "./LembarUnduh.jsx";
import { useNamaWarung, usePelanggan, useSemuaCatatan, useTanggalHariIni } from "../../data/pakai.js";
import { ringkasanHari, ringkasanMinggu, ringkasanBulan, tanggalCatatan } from "../../data/hitung.js";
import { awalBulan, geserBulan, jamDariMs, labelBulan, labelTanggalPendek, namaBulanPendek } from "../../data/tanggal.js";
import { formatRupiah, ribuan } from "../../data/format.js";
import umum from "../../komponen/umum.module.css";
import gaya from "./Laporan.module.css";

const PERIODE = [
  { nilai: "hari", label: "Hari" },
  { nilai: "minggu", label: "Minggu" },
  { nilai: "bulan", label: "Bulan" },
];
const JUMLAH_TERAKHIR = 6;
const kurang = (n) => (n > 0 ? `−${ribuan(n)}` : "0");

function RincianUntung({ r }) {
  return (
    <>
      <div className={gaya.baris}>
        <span>Hasil jualan</span>
        <span>{ribuan(r.hasil)}</span>
      </div>
      <div className={gaya.baris}>
        <span>Modal barang yang terjual</span>
        <span>{kurang(r.modal)}</span>
      </div>
      <div className={gaya.baris}>
        <span>Biaya warung</span>
        <span>{kurang(r.biaya)}</span>
      </div>
      {r.jualanTanpaModal > 0 && <p className={gaya.catatanKecil}>termasuk {formatRupiah(r.jualanTanpaModal)} jualan tanpa modal</p>}
    </>
  );
}

function KartuBon({ awal, akhir }) {
  return (
    <Link to="/pelanggan" className={gaya.kartuBon}>
      <strong>Bon pelanggan</strong>
      <span>
        {ribuan(awal)} → <strong>{ribuan(akhir)}</strong>
      </span>
    </Link>
  );
}

function LayarHari({ r, namaDari, onBuka }) {
  return (
    <>
      <section className={`${umum.kartu} ${gaya.kartuUntung}`} aria-label="Untung hari ini">
        <div className={gaya.barisUntung}>
          <span>Untung hari ini</span>
          <strong className={r.untung < 0 ? gaya.angkaRugi : gaya.angkaUntung}>{formatRupiah(r.untung)}</strong>
        </div>
        <RincianUntung r={r} />
      </section>
      <section className={gaya.kartuLaci} aria-label="Isi laci">
        <strong>Isi laci</strong>
        <span>
          Pagi {ribuan(r.laciPagi)} → <strong>{ribuan(r.laciAkhir)}</strong>
        </span>
      </section>
      <div className={gaya.judulBagian}>
        <h2>Catatan terakhir</h2>
        <Link to="/riwayat">Semua riwayat</Link>
      </div>
      {r.terakhir.length > 0 ? (
        <ul className={`${umum.kartu} ${umum.daftarPolos}`}>
          {r.terakhir.slice(0, JUMLAH_TERAKHIR).map((c) => (
            <li key={c.id}>
              <BarisCatatan catatan={c} nama={namaDari(c.pelanggan_id)} kiri={jamDariMs(c.waktu)} onBuka={onBuka} />
            </li>
          ))}
        </ul>
      ) : (
        <p className={umum.kosong}>Belum ada catatan hari ini.</p>
      )}
    </>
  );
}

function BatangUntung({ r }) {
  const total = r.modal + r.biaya + Math.max(0, r.untung);
  if (total <= 0) return null;
  const persen = (n) => `${(n / total) * 100}%`;
  return (
    <div className={gaya.batangSusun} aria-hidden="true">
      <span style={{ width: persen(r.modal), background: "#dcdbd5" }} />
      <span style={{ width: persen(r.biaya), background: "#eab49e" }} />
      <span style={{ width: persen(Math.max(0, r.untung)), background: "#7fb898" }} />
    </div>
  );
}

const NAMA_PANJANG = { Sen: "Senin", Sel: "Selasa", Rab: "Rabu", Kam: "Kamis", Jum: "Jumat", Sab: "Sabtu", Min: "Minggu" };

function LayarMinggu({ r, kini }) {
  const berubah = r.laciAkhir - r.laciAwal;
  const data = r.perHari.map((h) => ({ label: h.nama, nilai: h.untung, sorot: h === r.terbaik && h.untung > 0, kini: h.tanggal === kini }));
  return (
    <>
      <section className={`${umum.kartu} ${gaya.kartuUntung}`} aria-label="Untung minggu ini">
        <span className={gaya.labelUntung}>Untung</span>
        <strong className={`${r.untung < 0 ? gaya.angkaRugi : gaya.angkaUntung} ${gaya.angkaBesar}`}>{formatRupiah(r.untung)}</strong>
        <BatangUntung r={r} />
        <RincianUntung r={r} />
      </section>
      <section className={`${umum.kartu} ${gaya.kartuGrafik}`} aria-label="Untung per hari">
        <div className={gaya.barisJudul}>
          <strong>Untung per hari</strong>
          {r.terbaik && r.terbaik.untung > 0 && <span>Terbaik: {NAMA_PANJANG[r.terbaik.nama]}</span>}
        </div>
        <GrafikBatang data={data} label="Untung per hari" />
      </section>
      <section className={`${umum.kartu} ${gaya.kartuGrafik}`} aria-label="Isi laci">
        <div className={gaya.barisJudul}>
          <strong>Isi laci</strong>
          {berubah !== 0 && <span className={gaya.kapsul}>{berubah > 0 ? `Naik ${formatRupiah(berubah)}` : `Turun ${formatRupiah(-berubah)}`}</span>}
        </div>
        <div className={gaya.awalAkhir}>
          <span>
            <small>Senin pagi</small>
            <strong>{formatRupiah(r.laciAwal)}</strong>
          </span>
          <span className={gaya.kanan}>
            <small>Sekarang</small>
            <strong>{formatRupiah(r.laciAkhir)}</strong>
          </span>
        </div>
        <div className={umum.duaKolom}>
          <div className={gaya.kotakMasuk}>
            <span>Masuk</span>
            <strong>+{ribuan(r.masuk)}</strong>
          </div>
          <div className={gaya.kotakKeluar}>
            <span>Keluar</span>
            <strong>{kurang(r.keluar)}</strong>
          </div>
        </div>
      </section>
      <KartuBon awal={r.bonAwal} akhir={r.bonAkhir} />
    </>
  );
}

function LayarBulan({ r, kini, bulan, onGeser }) {
  const data = r.perMinggu.map((m) => ({ label: m.label, nilai: m.untung, sorot: m === r.terbaik && m.untung > 0, kini: m.dari <= kini && kini <= m.sampai }));
  const lalu = namaBulanPendek(geserBulan(bulan, -1));
  return (
    <>
      <div className={gaya.pindahBulan}>
        <button type="button" aria-label="Bulan sebelumnya" onClick={() => onGeser(-1)}>
          ‹
        </button>
        <strong>{labelBulan(bulan)}</strong>
        <button type="button" aria-label="Bulan berikutnya" disabled={bulan >= awalBulan(kini)} onClick={() => onGeser(1)}>
          ›
        </button>
      </div>
      <section className={`${umum.kartu} ${gaya.kartuGrafik}`} aria-label="Untung bulan ini">
        <div className={gaya.barisJudul}>
          <span className={gaya.kolom}>
            <span className={gaya.labelUntung}>Untung</span>
            <strong className={`${r.untung < 0 ? gaya.angkaRugi : gaya.angkaUntung} ${gaya.angkaBesar}`}>{formatRupiah(r.untung)}</strong>
          </span>
          {r.persenDariBulanLalu !== null && (
            <span className={gaya.kapsul}>
              {r.persenDariBulanLalu >= 0 ? "↑" : "↓"} {Math.abs(r.persenDariBulanLalu)}% dari {lalu}
            </span>
          )}
        </div>
        {r.jualanTanpaModal > 0 && <p className={gaya.catatanKecil}>termasuk {formatRupiah(r.jualanTanpaModal)} jualan tanpa modal</p>}
        <GrafikBatang data={data} label="Untung per minggu" />
      </section>
      {(r.palingLaku || r.palingUntung) && (
        <section className={`${umum.kartu} ${gaya.kartuGrafik}`} aria-label="Barang terbaik">
          {r.palingLaku && (
            <div className={gaya.baris}>
              <span>Paling laku</span>
              <span>
                <strong>{r.palingLaku.nama}</strong> {ribuan(r.palingLaku.jumlah)}
              </span>
            </div>
          )}
          {r.palingUntung && (
            <div className={gaya.baris}>
              <span>Paling untung</span>
              <span>
                <strong>{r.palingUntung.nama}</strong> <span className={gaya.teksUntung}>+{ribuan(r.palingUntung.untung)}</span>
              </span>
            </div>
          )}
        </section>
      )}
      <section className={`${umum.kartu} ${gaya.kartuGrafik}`} aria-label="Uang bulan ini">
        <div className={gaya.baris}>
          <span>Biaya warung</span>
          <strong className={gaya.teksKeluar}>{kurang(r.biaya)}</strong>
        </div>
        <div className={gaya.baris}>
          <span>Diambil pribadi</span>
          <strong className={gaya.teksKeluar}>{kurang(r.diambilPribadi)}</strong>
        </div>
        <div className={gaya.baris}>
          <span>Selisih laci (hitung ulang)</span>
          <strong className={r.selisihLaci < 0 ? gaya.teksKeluar : undefined}>{r.selisihLaci > 0 ? `+${ribuan(r.selisihLaci)}` : r.selisihLaci < 0 ? `−${ribuan(-r.selisihLaci)}` : "0"}</strong>
        </div>
        <div className={gaya.baris}>
          <span>Bon pelanggan</span>
          <span>
            {ribuan(r.bonAwal)} → <strong className={gaya.teksBon}>{ribuan(r.bonAkhir)}</strong>
          </span>
        </div>
      </section>
    </>
  );
}

export default function Laporan() {
  const kini = useTanggalHariIni();
  const catatan = useSemuaCatatan();
  const pelanggan = usePelanggan();
  const namaWarung = useNamaWarung() || "Buku Warung";
  const { pesan, tampilkanPesan } = usePesan();

  const [periode, setPeriode] = useState("hari");
  const [bulan, setBulan] = useState(() => awalBulan(kini));
  const [rincian, setRincian] = useState(null);
  const [unduh, setUnduh] = useState(false);

  const namaDari = (id) => pelanggan.find((p) => p.id === id)?.nama || "pelanggan";

  const r = useMemo(() => {
    if (periode === "hari") return ringkasanHari(catatan, kini);
    if (periode === "minggu") return ringkasanMinggu(catatan, kini, kini);
    return ringkasanBulan(catatan, bulan, kini);
  }, [periode, catatan, kini, bulan]);

  // Yang masuk file unduhan: catatan dalam rentang periode ini
  const dari = periode === "hari" ? kini : r.dari;
  const sampai = periode === "hari" ? kini : r.sampai;
  const catatanPeriode = useMemo(() => catatan.filter((c) => tanggalCatatan(c) >= dari && tanggalCatatan(c) <= sampai), [catatan, dari, sampai]);
  const judulPeriode =
    periode === "hari" ? `Hari ini · ${labelTanggalPendek(kini)}` : periode === "minggu" ? `Minggu ini · ${labelTanggalPendek(dari)} – ${labelTanggalPendek(sampai)}` : labelBulan(bulan);
  const namaPeriode = periode === "bulan" ? bulan.slice(0, 7) : periode === "minggu" ? `${dari}-sampai-${sampai}` : kini;

  return (
    <KerangkaLayar
      judul="Laporan"
      aksi={
        <button type="button" className={gaya.unduh} onClick={() => setUnduh(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
          </svg>
          Unduh
        </button>
      }
    >
      <Geser label="Periode laporan" pilihan={PERIODE} nilai={periode} onUbah={setPeriode} warna="var(--teks)" />

      {periode === "hari" && <LayarHari r={r} namaDari={namaDari} onBuka={setRincian} />}
      {periode === "minggu" && <LayarMinggu r={r} kini={kini} />}
      {periode === "bulan" && <LayarBulan r={r} kini={kini} bulan={bulan} onGeser={(arah) => setBulan(geserBulan(bulan, arah))} />}

      <LembarRincian catatan={rincian} onTutup={() => setRincian(null)} onTersimpan={tampilkanPesan} />
      <LembarUnduh terbuka={unduh} onTutup={() => setUnduh(false)} judul={judulPeriode} namaPeriode={namaPeriode} namaWarung={namaWarung} catatan={catatanPeriode} ringkasan={r} namaDari={namaDari} />
      <PesanSingkat pesan={pesan} />
    </KerangkaLayar>
  );
}
