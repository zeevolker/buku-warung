// bagian.jsx: potongan yang sama di ketiga laporan cetak.
import { ribuan } from "../../data/format.js";
import { tinggiTeks } from "../../data/laporan.js";
import gaya from "./Cetak.module.css";

export const uang = (n) => `${n < 0 ? "−" : ""}Rp ${ribuan(Math.abs(n))}`;
export const bertanda = (n) => (n > 0 ? `+${ribuan(n)}` : n < 0 ? `−${ribuan(-n)}` : "0");
export const kurang = (n) => (n > 0 ? `−${ribuan(n)}` : "0");

// Tinggi perkiraan tiap bagian, cocok dengan ukuran di Cetak.module.css
export const TINGGI = { jarak: 16, judul: 28, kepala: 30, baris: 31, akhir: 34, legenda: 30, tambahBaris: 18 };
const judulDanKepala = TINGGI.jarak + TINGGI.judul + TINGGI.kepala;

export function IkonAplikasi() {
  return (
    <svg width="44" height="44" viewBox="0 0 512 512" aria-hidden="true">
      <rect width="512" height="512" rx="112" fill="#4f7d65" />
      <g transform="translate(96 96) scale(4)">
        <circle cx="40" cy="20" r="11" fill="#f2d27a" />
        <path d="M35 20h10M40 15v10" stroke="#7d5a12" strokeWidth="3" strokeLinecap="round" />
        <path d="M8 38c10-5 21-5 32 2v30c-11-7-22-7-32-2V38Z" fill="#fff" />
        <path d="M72 38c-10-5-21-5-32 2v30c11-7 22-7 32-2V38Z" fill="#e4f0e8" />
        <path d="M16 48c6-2 11-2 16 1M16 56c6-2 11-2 16 1M48 49c5-3 10-3 16-1M48 57c5-3 10-3 16-1" stroke="#7fb898" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function Kartu({ label, nilai, sub, warna }) {
  const teks = ribuan(Math.abs(nilai));
  const panjang = teks.length >= 11; // ratusan juta ke atas, supaya tetap satu baris
  return (
    <div className={`${gaya.kartu} ${warna ? gaya[warna] : ""}`}>
      <span className={gaya.labelKartu}>{label}</span>
      <strong className={`${gaya.nominal} ${panjang ? gaya.nominalPanjang : ""}`}>
        <small>{nilai < 0 ? "−Rp" : "Rp"}</small> {teks}
      </strong>
      <span className={gaya.subKartu}>{sub}</span>
    </div>
  );
}

export const blokKartu = (kartu) => ({
  tinggi: 116,
  isi: (
    <div className={gaya.kisiKartu}>
      {kartu.map((k) => (
        <Kartu key={k.label} {...k} />
      ))}
    </div>
  ),
});

// Dari mana untungnya: modal, biaya, dan untung dalam satu bilah
export function blokBilah(r) {
  const total = r.modal + r.biaya + Math.max(0, r.untung);
  const lebar = (n) => (total > 0 ? `${(n / total) * 100}%` : 0);
  return {
    tinggi: 136,
    isi: (
      <section className={gaya.bagian}>
        <h2>Dari mana untungnya</h2>
        <div className={gaya.bilah} aria-hidden="true">
          <span className={gaya.bilahModal} style={{ width: lebar(r.modal) }} />
          <span className={gaya.bilahBiaya} style={{ width: lebar(r.biaya) }} />
          <span className={gaya.bilahUntung} style={{ width: lebar(Math.max(0, r.untung)) }} />
        </div>
        <div className={gaya.angkaBilah}>
          <span>
            Hasil jualan<strong>{ribuan(r.hasil)}</strong>
          </span>
          <span>
            <i className={gaya.titikModal} />− Modal barang terjual<strong>{kurang(r.modal)}</strong>
          </span>
          <span>
            <i className={gaya.titikBiaya} />− Biaya warung<strong>{kurang(r.biaya)}</strong>
          </span>
          <span>
            <i className={gaya.titikUntung} />= Untung bersih<strong>{bertanda(r.untung).replace("+", "")}</strong>
          </span>
        </div>
      </section>
    ),
  };
}

// kolom = [{ label, kanan, lebar }]; baris = [{ kunci, sel: [...], kelas }]
export function Tabel({ kolom, baris, akhir, judul }) {
  return (
    <section className={gaya.bagian}>
      {judul && <h2>{judul}</h2>}
      <table className={gaya.tabel}>
        <colgroup>
          {kolom.map((k) => (
            <col key={k.label} style={k.lebar ? { width: k.lebar } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {kolom.map((k) => (
              <th key={k.label} className={k.kanan ? gaya.kanan : undefined}>
                {k.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {baris.map((b) => (
            <tr key={b.kunci} className={b.kelas ? gaya[b.kelas] : undefined}>
              {b.sel.map((isi, i) => (
                <td key={kolom[i].label} className={kolom[i].kanan ? gaya.kanan : undefined}>
                  {isi}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {akhir && (
          <tfoot>
            <tr>
              {akhir.map((isi, i) => (
                <td key={kolom[i].label} className={kolom[i].kanan ? gaya.kanan : undefined}>
                  {isi}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </section>
  );
}

export const tinggiTabel = (baris, adaAkhir = true) => judulDanKepala + baris.reduce((n, b) => n + (b.tinggi || TINGGI.baris), 0) + (adaAkhir ? TINGGI.akhir : 0);

// Tabel yang boleh lanjut ke halaman berikutnya
export function blokTabel({ judul, kolom, baris, akhir, legenda }) {
  return {
    baris,
    tinggiKepala: judulDanKepala + (legenda ? TINGGI.legenda : 0),
    tinggiAkhir: akhir ? TINGGI.akhir : 0,
    gambar: ({ baris: potongan, lanjutan, selesai }) => (
      <>
        <Tabel judul={lanjutan ? `${judul} (lanjutan)` : judul} kolom={kolom} baris={potongan} akhir={selesai ? akhir : null} />
        {legenda && <p className={gaya.legenda}>{legenda}</p>}
      </>
    ),
  };
}

// ---------- Arus laci ----------

const KOLOM_ARUS = [{ label: "Uang" }, { label: "Rupiah", kanan: true, lebar: "110px" }];

// Empat baris utama selalu tampil, yang lain hanya kalau ada isinya
export function barisArus(arus, { awal, akhir, labelAwal, labelAkhir }) {
  const masuk = (kunci, label, n) => ({ kunci, sel: [label, n ? <span className={gaya.masuk}>+{ribuan(n)}</span> : "0"] });
  const keluar = (kunci, label, n) => ({ kunci, sel: [label, n ? <span className={gaya.keluar}>−{ribuan(n)}</span> : "0"] });
  const selisih = arus.selisihMasuk - arus.selisihKeluar;
  const baris = [
    { kunci: "awal", sel: [labelAwal, ribuan(awal)] },
    masuk("tunai", "Jualan tunai", arus.jualanTunai),
    masuk("bon", "Bon dibayar", arus.bonDibayar),
    keluar("agen", "Belanja ke agen", arus.belanjaAgen),
    keluar("biaya", "Biaya warung", arus.biaya),
  ];
  if (arus.uangPribadi) baris.push(masuk("pribadi", "Uang awal atau uang pribadi", arus.uangPribadi));
  if (arus.pinjaman) baris.push(keluar("pinjaman", "Pinjaman pelanggan", arus.pinjaman));
  if (arus.ambilPribadi) baris.push(keluar("ambil", "Ambil pribadi", arus.ambilPribadi));
  if (selisih) baris.push(selisih > 0 ? masuk("selisih", "Selisih laci (hitung ulang)", selisih) : keluar("selisih", "Selisih laci (hitung ulang)", -selisih));
  if (arus.lainMasuk) baris.push(masuk("lainMasuk", "Masuk lainnya", arus.lainMasuk));
  if (arus.lainKeluar) baris.push(keluar("lainKeluar", "Keluar lainnya", arus.lainKeluar));
  return { kolom: KOLOM_ARUS, baris, akhir: [labelAkhir, ribuan(akhir)] };
}

// ---------- Barang terlaris ----------

export function tabelBarang(b, { hurufNama, kolomUntung = true }) {
  const kolom = [{ label: "Barang" }, { label: "Terjual", kanan: true, lebar: "64px" }, { label: "Jualan", kanan: true, lebar: "96px" }];
  if (kolomUntung) kolom.push({ label: "Untung", kanan: true, lebar: "96px" });
  const sel = (nama, terjual, jualan, untung) => (kolomUntung ? [nama, terjual, jualan, untung] : [nama, terjual, jualan]);
  const baris = b.teratas.map((x) => ({
    kunci: x.barang_id,
    tinggi: tinggiTeks(x.nama, hurufNama, TINGGI.baris),
    sel: sel(x.nama, ribuan(x.jumlah), ribuan(x.jualan), ribuan(x.untung)),
  }));
  if (b.lain.jenis) baris.push({ kunci: "lain", sel: sel(`Barang lain (${b.lain.jenis} jenis)`, ribuan(b.lain.terjual), ribuan(b.lain.jualan), ribuan(b.lain.untung)) });
  if (b.tanpaBarang.jualan) baris.push({ kunci: "tanpa", sel: sel("Jualan tanpa barang", "–", ribuan(b.tanpaBarang.jualan), ribuan(b.tanpaBarang.untung)) });
  return { kolom, baris, akhir: sel("Total", ribuan(b.total.terjual), ribuan(b.total.jualan), ribuan(b.total.untung)) };
}

// ---------- Grafik batang ----------

// data = [{ kunci, label, bawah, nilai, terbaik }], nilai null = belum terjadi
export function blokGrafik({ judul, keterangan, data }) {
  const terbesar = Math.max(1, ...data.map((d) => Math.abs(d.nilai || 0)));
  return {
    tinggi: 232,
    isi: (
      <section className={gaya.bagian}>
        <div className={gaya.judulBaris}>
          <h2>{judul}</h2>
          {keterangan && <span>{keterangan}</span>}
        </div>
        <div className={gaya.grafik}>
          {data.map((d) => (
            <div key={d.kunci} className={gaya.kolomGrafik}>
              <div className={gaya.areaBatang}>
                <span className={gaya.nilaiBatang}>{d.nilai === null ? "–" : bertanda(d.nilai).replace("+", "")}</span>
                {d.nilai === null ? (
                  <i className={gaya.batangKosong} />
                ) : (
                  <i className={`${gaya.batang} ${d.nilai < 0 ? gaya.batangRugi : d.terbaik ? gaya.batangTerbaik : ""}`} style={{ height: `${Math.max(2, (Math.abs(d.nilai) / terbesar) * 118)}px` }} />
                )}
              </div>
              <strong>{d.label}</strong>
              {d.bawah !== undefined && <span>{d.bawah}</span>}
            </div>
          ))}
        </div>
      </section>
    ),
  };
}

export const blokKotak = (judul, isi, tinggi = 84) => ({
  tinggi,
  isi: (
    <div className={gaya.kotak}>
      {judul && <strong>{judul}</strong>}
      <p>{isi}</p>
    </div>
  ),
});
