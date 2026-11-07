// susunLaporan.jsx: isi laporan harian, mingguan, dan bulanan sebagai daftar blok,
// yang lalu dibagi ke halaman A4 oleh bagiBlok di data/laporan.js.
import { ringkasanBulan, ringkasanHari, ringkasanMinggu, selisihLaci, palingLaku, palingUntung, tanggalCatatan } from "../../data/hitung.js";
import { barangRusakHilang, bonPerPelanggan, kalenderBulan, labelHariPanjang, labelRentang, rentangLaporan, rincianArusLaci, ringkasanBarang, stokDiBawahBatas, tinggiTeks } from "../../data/laporan.js";
import { NAMA_TEMPAT } from "../../data/unduh.js";
import { uraiCatatan } from "../../data/uraian.js";
import { formatRupiah, ribuan } from "../../data/format.js";
import { geserBulan, jamDariMs, labelBulan, labelTanggal, namaBulanPendek } from "../../data/tanggal.js";
import { barisArus, bertanda, blokBilah, blokGrafik, blokKartu, blokKotak, blokTabel, Tabel, tabelBarang, tinggiTabel, TINGGI, kurang } from "./bagian.jsx";
import gaya from "./Cetak.module.css";

const JUMLAH_BARANG_HARIAN = 8;
const JUMLAH_STOK = 6;
const BON_MUAT_DI_KOLOM = 9;
const LEBAR_KATA_CATATAN = 42; // perkiraan huruf per baris di kolom Catatan

const persenDari = (bagian, total) => (total > 0 ? Math.round((bagian / total) * 100) : null);
const naikTurun = (n) => (n > 0 ? `Naik ${formatRupiah(n)}` : n < 0 ? `Turun ${formatRupiah(-n)}` : "Tidak berubah");
const lunas = (n) => (n === 0 ? "Lunas" : ribuan(n));

// ---------- Harian ----------

// Baris tabel catatan, lama ke baru
export function barisCatatanHari(catatan, namaDari) {
  return [...catatan]
    .sort((a, b) => a.waktu - b.waktu)
    .map((c) => {
      const u = uraiCatatan(c, namaDari(c.pelanggan_id));
      return {
        kunci: c.id,
        tinggi: tinggiTeks(u.judul, LEBAR_KATA_CATATAN, TINGGI.baris),
        kelas: c.dari === "bon" || c.ke === "bon" ? "barisBon" : undefined,
        sel: [jamDariMs(c.waktu), u.judul, `${NAMA_TEMPAT[c.dari] || c.dari} → ${NAMA_TEMPAT[c.ke] || c.ke}`, <span className={u.tanda === "masuk" ? gaya.masuk : u.tanda === "keluar" ? gaya.keluar : undefined}>{u.angka}</span>],
      };
    });
}

function laporanHari({ catatan, tanggal, kini, namaDari }) {
  const r = ringkasanHari(catatan, tanggal);
  const rentang = { dari: tanggal, sampai: tanggal };
  const arus = rincianArusLaci(catatan, rentang);
  const bon = bonPerPelanggan(catatan, rentang, namaDari);
  const barang = ringkasanBarang(catatan, rentang, JUMLAH_BARANG_HARIAN);
  const hariIni = tanggal === kini;
  const persen = persenDari(r.untung, r.hasil);

  const tabelArus = barisArus(arus, { awal: r.laciPagi, akhir: r.laciAkhir, labelAwal: "Isi laci pagi", labelAkhir: hariIni ? "Isi laci sekarang" : "Isi laci akhir hari" });
  const tabelJual = tabelBarang(barang, { hurufNama: 18, kolomUntung: false });
  const tinggiDuaKolom = Math.max(tinggiTabel(tabelArus.baris), tinggiTabel(tabelJual.baris));

  const blok = [
    blokKartu([
      { label: "Untung bersih", nilai: r.untung, warna: "kartuUntung", sub: persen === null ? "Belum ada jualan" : `${persen}% dari jualan` },
      { label: "Hasil jualan", nilai: r.hasil, sub: `Tunai ${ribuan(arus.jualanTunai)} · Bon ${ribuan(r.hasil - arus.jualanTunai)}` },
      { label: hariIni ? "Isi laci sekarang" : "Isi laci akhir hari", nilai: r.laciAkhir, sub: `Pagi ${ribuan(r.laciPagi)}` },
      { label: "Bon pelanggan", nilai: bon.total.sisa, warna: "kartuBon", sub: `Baru ${ribuan(bon.total.tambah)} · Dibayar ${ribuan(bon.total.bayar)}` },
    ]),
    blokBilah(r),
    {
      tinggi: tinggiDuaKolom,
      isi: (
        <div className={gaya.duaKolom}>
          <Tabel judul="Arus uang laci" {...tabelArus} />
          <Tabel judul="Barang terjual" {...tabelJual} />
        </div>
      ),
    },
    blokKotak(
      "Cek cepat",
      hariIni
        ? `Hitung uang di laci sekarang. Kalau tidak sama dengan ${formatRupiah(r.laciAkhir)}, periksa daftar catatan atau pakai Hitung ulang.`
        : `Isi laci di akhir hari itu tercatat ${formatRupiah(r.laciAkhir)}.`
    ),
  ];

  if (r.terakhir.length) {
    blok.push(
      { halamanBaru: true },
      blokTabel({
        judul: "Semua catatan",
        kolom: [{ label: "Jam", lebar: "58px" }, { label: "Catatan" }, { label: "Dari → Ke", lebar: "170px" }, { label: "Nominal", kanan: true, lebar: "100px" }],
        baris: barisCatatanHari(r.terakhir, namaDari),
        legenda: "Tanda + uang masuk laci, − uang keluar laci, tanpa tanda laci tidak berubah. Latar kuning menyangkut bon.",
      })
    );
  }
  return { blok };
}

// ---------- Bagian mingguan dan bulanan ----------

function blokBonPenuh(bon) {
  const kolom = [{ label: "Pelanggan" }, { label: "Awal", kanan: true, lebar: "96px" }, { label: "Tambah", kanan: true, lebar: "96px" }, { label: "Bayar", kanan: true, lebar: "96px" }, { label: "Sisa", kanan: true, lebar: "96px" }];
  const baris = bon.daftar.map((b) => ({ kunci: b.pelanggan_id, tinggi: tinggiTeks(b.nama, 34, TINGGI.baris), sel: [b.nama, ribuan(b.awal), ribuan(b.tambah), ribuan(b.bayar), lunas(b.sisa)] }));
  return blokTabel({ judul: "Bon pelanggan", kolom, baris, akhir: ["Total", ribuan(bon.total.awal), ribuan(bon.total.tambah), ribuan(bon.total.bayar), ribuan(bon.total.sisa)] });
}

const blokBonKosong = () => blokKotak("Bon pelanggan", "Tidak ada bon di periode ini.", 76);

const CARA_BACA = "Untung bersih = hasil jualan − modal barang terjual − biaya warung. Isi laci bisa berbeda arah dengan untung, karena belanja stok dan bon mengubah uang tunai, bukan untung.";

const blokSusunBarang = (barang, kalimat) => {
  const tabel = tabelBarang(barang, { hurufNama: 44 });
  return {
    tinggi: tinggiTabel(tabel.baris) + 56,
    isi: (
      <>
        <Tabel judul="Barang terlaris" {...tabel} />
        <p className={gaya.catatanTabel}>{kalimat}</p>
      </>
    ),
  };
};

// ---------- Mingguan ----------

function laporanMinggu({ catatan, barang, tanggal, kini, namaDari }) {
  const r = ringkasanMinggu(catatan, tanggal, kini);
  const rentang = { dari: r.dari, sampai: r.sampai };
  const arus = rincianArusLaci(catatan, rentang);
  const bon = bonPerPelanggan(catatan, rentang, namaDari);
  const daftarBarang = ringkasanBarang(catatan, rentang);
  const hariBerjalan = r.perHari.filter((h) => h.untung !== null).length;
  const persen = persenDari(r.untung, r.hasil);
  const stok = stokDiBawahBatas(barang, catatan);
  const cuan = palingUntung(catatan, rentang);
  const terbaik = r.terbaik && r.terbaik.untung > 0 ? r.terbaik : null;
  const selesai = r.sampai < kini;

  const blok = [
    blokKartu([
      { label: "Untung bersih", nilai: r.untung, warna: "kartuUntung", sub: `Rata-rata ${ribuan(Math.round(r.untung / Math.max(1, hariBerjalan)))} per hari` },
      { label: "Hasil jualan", nilai: r.hasil, sub: persen === null ? "Belum ada jualan" : `Untung ${persen}% dari jualan` },
      { label: selesai ? "Isi laci akhir minggu" : "Isi laci sekarang", nilai: r.laciAkhir, sub: naikTurun(r.laciAkhir - r.laciAwal) },
      { label: "Bon pelanggan", nilai: r.bonAkhir, warna: "kartuBon", sub: `${bon.orangBerutang} orang` },
    ]),
    blokBilah(r),
    blokGrafik({
      judul: "Untung per hari",
      keterangan: terbaik ? `Terbaik: ${labelTanggal(terbaik.tanggal)}` : null,
      data: r.perHari.map((h) => ({ kunci: h.tanggal, label: h.nama, nilai: h.untung, bawah: h.hasil === null ? "–" : ribuan(h.hasil), terbaik: h === terbaik })),
    }),
    (() => {
      const t = barisArus(arus, { awal: r.laciAwal, akhir: r.laciAkhir, labelAwal: "Isi laci Senin pagi", labelAkhir: selesai ? "Isi laci akhir minggu" : "Isi laci sekarang" });
      return { tinggi: tinggiTabel(t.baris), isi: <Tabel judul="Arus uang laci" {...t} /> };
    })(),
    { halamanBaru: true },
    blokSusunBarang(daftarBarang, `Untung per barang belum dikurangi biaya warung.${cuan ? ` Paling menguntungkan: ${cuan.nama} (${formatRupiah(cuan.untung)}).` : ""}`),
    bon.daftar.length ? blokBonPenuh(bon) : blokBonKosong(),
    {
      tinggi: 16 + Math.max(170, 54 + Math.min(stok.length, JUMLAH_STOK + 1) * 24),
      isi: (
        <div className={gaya.duaKolom}>
          <div className={gaya.kotak}>
            <strong>Stok perlu dibeli</strong>
            {stok.length ? (
              <ul className={gaya.daftarKotak}>
                {stok.slice(0, JUMLAH_STOK).map((b) => (
                  <li key={b.id}>
                    <span>{b.nama}</span>
                    <b>{ribuan(b.stok)}</b>
                  </li>
                ))}
                {stok.length > JUMLAH_STOK && <li>dan {stok.length - JUMLAH_STOK} barang lain, lihat layar Barang</li>}
              </ul>
            ) : (
              <p>Semua stok masih di atas batas.</p>
            )}
          </div>
          <div className={gaya.kotak}>
            <strong>Catatan minggu ini</strong>
            <ul className={gaya.daftarKotak}>
              <li>
                <span>Selisih laci</span>
                <b>{bertanda(selisihLaci(catatan, rentang))}</b>
              </li>
              <li>
                <span>Barang rusak atau hilang</span>
                <b>{kurang(barangRusakHilang(catatan, rentang))}</b>
              </li>
              <li>
                <span>Jualan tanpa modal</span>
                <b>{ribuan(r.jualanTanpaModal)}</b>
              </li>
            </ul>
          </div>
        </div>
      ),
    },
    blokKotak("Cara membaca", CARA_BACA, 102),
  ];
  return { blok };
}

// ---------- Bulanan ----------

const WARNA_TINGKAT = ["tingkat0", "tingkat1", "tingkat2", "tingkat3"];

function Kalender({ kalender }) {
  return (
    <section className={gaya.bagian}>
      <h2>Kalender untung</h2>
      <div className={gaya.kalender}>
        {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((h) => (
          <b key={h}>{h}</b>
        ))}
        {kalender.minggu.flat().map((h, i) => (h ? <span key={h.tanggal} className={h.tingkat === null ? gaya.selKosong : gaya[WARNA_TINGKAT[h.tingkat]]}>{h.angka}</span> : <i key={`kosong-${i}`} />))}
      </div>
      <div className={gaya.legendaKalender}>
        Sedikit
        {WARNA_TINGKAT.map((w) => (
          <i key={w} className={gaya[w]} />
        ))}
        Banyak
      </div>
      {kalender.terbaik && (
        <p className={gaya.catatanTabel}>
          Hari terbaik: {labelTanggal(kalender.terbaik.tanggal)}, untung {formatRupiah(kalender.terbaik.untung)}.
        </p>
      )}
    </section>
  );
}

function laporanBulan({ catatan, tanggal, kini, namaDari }) {
  const r = ringkasanBulan(catatan, tanggal, kini);
  const rentang = { dari: r.dari, sampai: r.sampai };
  const arus = rincianArusLaci(catatan, rentang);
  const bon = bonPerPelanggan(catatan, rentang, namaDari);
  const daftarBarang = ringkasanBarang(catatan, rentang);
  const kalender = kalenderBulan(catatan, r.dari, kini);
  const persen = persenDari(r.untung, r.hasil);
  const selesai = r.sampai < kini;
  const lalu = namaBulanPendek(geserBulan(r.dari, -1));
  const laku = palingLaku(catatan, rentang);
  const cuan = palingUntung(catatan, rentang);
  const terbaik = r.terbaik && r.terbaik.untung > 0 ? r.terbaik : null;
  const labelAkhir = selesai ? "Isi laci akhir bulan" : "Isi laci sekarang";

  const kalimat = [laku && `Paling laku: ${laku.nama} (${ribuan(laku.jumlah)} terjual).`, cuan && `Paling menguntungkan: ${cuan.nama} (${formatRupiah(cuan.untung)}).`, "Untung per barang belum dikurangi biaya warung."].filter(Boolean).join(" ");

  const kolomBon = [{ label: "Pelanggan" }, { label: "Tambah", kanan: true, lebar: "70px" }, { label: "Bayar", kanan: true, lebar: "70px" }, { label: "Sisa", kanan: true, lebar: "70px" }];
  const barisBon = bon.daftar.map((b) => ({ kunci: b.pelanggan_id, tinggi: tinggiTeks(b.nama, 14, TINGGI.baris), sel: [b.nama, ribuan(b.tambah), ribuan(b.bayar), lunas(b.sisa)] }));
  const tinggiKalender = 16 + 28 + 30 + kalender.minggu.length * 36 + 26 + 44;
  const bonDiKolom = bon.daftar.length && bon.daftar.length <= BON_MUAT_DI_KOLOM;

  const blok = [
    blokKartu([
      { label: "Untung bersih", nilai: r.untung, warna: "kartuUntung", sub: r.persenDariBulanLalu === null ? `Belum bisa dibanding ${lalu}` : `${r.persenDariBulanLalu >= 0 ? "↑" : "↓"} ${Math.abs(r.persenDariBulanLalu)}% dari bulan lalu` },
      { label: "Hasil jualan", nilai: r.hasil, sub: persen === null ? "Belum ada jualan" : `Untung ${persen}% dari jualan` },
      { label: labelAkhir, nilai: r.laciAkhir, sub: naikTurun(r.laciAkhir - r.laciAwal) },
      { label: "Bon pelanggan", nilai: r.bonAkhir, warna: "kartuBon", sub: naikTurun(r.bonAkhir - r.bonAwal) },
    ]),
    blokBilah(r),
    blokGrafik({
      judul: "Untung per minggu",
      keterangan: terbaik ? `Terbaik: tanggal ${terbaik.label}` : null,
      data: r.perMinggu.map((m) => ({ kunci: m.label, label: m.label, nilai: m.untung, terbaik: m === terbaik })),
    }),
    (() => {
      const t = barisArus(arus, { awal: r.laciAwal, akhir: r.laciAkhir, labelAwal: "Isi laci awal bulan", labelAkhir });
      return { tinggi: tinggiTabel(t.baris), isi: <Tabel judul="Arus uang laci" {...t} /> };
    })(),
    { halamanBaru: true },
    blokSusunBarang(daftarBarang, kalimat),
    bonDiKolom
      ? {
          tinggi: Math.max(tinggiKalender, tinggiTabel(barisBon)),
          isi: (
            <div className={gaya.duaKolom}>
              <Kalender kalender={kalender} />
              <Tabel judul="Bon pelanggan" kolom={kolomBon} baris={barisBon} akhir={["Total", ribuan(bon.total.tambah), ribuan(bon.total.bayar), ribuan(bon.total.sisa)]} />
            </div>
          ),
        }
      : { tinggi: tinggiKalender, isi: <div className={gaya.setengah}><Kalender kalender={kalender} /></div> },
    ...(bonDiKolom ? [] : [bon.daftar.length ? blokBonPenuh(bon) : blokBonKosong()]),
    {
      tinggi: 108,
      isi: (
        <div className={gaya.kotak}>
          <strong>Perlu diperhatikan</strong>
          <div className={gaya.tigaAngka}>
            <span>
              Selisih laci<b>{bertanda(r.selisihLaci)}</b>
            </span>
            <span>
              Barang rusak atau hilang<b>{kurang(barangRusakHilang(catatan, rentang))}</b>
            </span>
            <span>
              Jualan tanpa modal<b>{ribuan(r.jualanTanpaModal)}</b>
            </span>
          </div>
        </div>
      ),
    },
    blokKotak("Cara membaca", CARA_BACA, 102),
  ];
  return { blok };
}

// ---------- Pintu masuk ----------

// data = { catatan, barang, namaDari }
export function susunLaporan(periode, tanggal, data, kini) {
  const rentang = rentangLaporan(periode, tanggal);
  const selesai = rentang.sampai < kini;
  const isi = { ...data, tanggal: rentang.dari, kini };
  if (periode === "hari") return { ...laporanHari(isi), rentang, selesai, labelPeriode: labelHariPanjang(tanggal) };
  if (periode === "minggu") return { ...laporanMinggu(isi), rentang, selesai, labelPeriode: labelRentang(rentang.dari, rentang.sampai) };
  return { ...laporanBulan(isi), rentang, selesai, labelPeriode: labelBulan(rentang.dari) };
}

export const jumlahCatatanDalam = (catatan, { dari, sampai }) => catatan.filter((c) => !c.deleted && tanggalCatatan(c) >= dari && tanggalCatatan(c) <= sampai).length;
