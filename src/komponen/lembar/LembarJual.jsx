// LembarJual.jsx: pilih barang, tunai atau bon, lalu Simpan.
import { useState } from "react";
import Lembar from "../Lembar.jsx";
import Geser from "../Geser.jsx";
import Rute from "../Rute.jsx";
import InputRupiah from "../InputRupiah.jsx";
import PilihPelanggan from "./PilihPelanggan.jsx";
import { useBarang, useIsi, useKeseringanJual, usePelanggan, useTanggalHariIni } from "../../data/pakai.js";
import { jual, siapkanPelanggan } from "../../data/aksi.js";
import { formatRupiah, ribuan } from "../../data/format.js";
import bersama from "./bersama.module.css";
import gaya from "./LembarJual.module.css";

const JUMLAH_DAFTAR = 5;

function IsiJual({ onTutup, onTersimpan }) {
  const tanggal = useTanggalHariIni();
  const barang = useBarang();
  const pelanggan = usePelanggan();
  const isi = useIsi();
  const keseringan = useKeseringanJual(tanggal);

  const [jumlah, setJumlah] = useState({}); // id barang -> jumlah
  const [tambahan, setTambahan] = useState([]); // barang yang dipilih lewat "+ Barang lain"
  const [cari, setCari] = useState(null); // null berarti kotak cari tertutup
  const [lainnyaBuka, setLainnyaBuka] = useState(false);
  const [lainnya, setLainnya] = useState(null);
  const [modalLainnya, setModalLainnya] = useState(null);
  const [keterangan, setKeterangan] = useState("");
  const [bayar, setBayar] = useState("tunai");
  const [pelangganId, setPelangganId] = useState(null);
  const [namaBaru, setNamaBaru] = useState("");
  const [galat, setGalat] = useState("");

  const stok = (id) => isi?.stok?.[id] || 0;
  const bisaDijual = (b) => b.harga_jual > 0 && stok(b.id) > 0;
  const ubah = (id, selisih) => setJumlah((j) => ({ ...j, [id]: Math.max(0, (j[id] || 0) + selisih) }));

  // Daftar utama: yang paling sering laku, ditambah yang dipilih lewat pencarian
  const urut = [...barang].sort((a, b) => (keseringan[b.id] || 0) - (keseringan[a.id] || 0) || a.nama.localeCompare(b.nama));
  const daftar = urut.filter((b, i) => i < JUMLAH_DAFTAR || tambahan.includes(b.id) || jumlah[b.id] > 0);
  const hasilCari = cari === null ? [] : urut.filter((b) => !daftar.includes(b) && b.nama.toLowerCase().includes(cari.trim().toLowerCase()));

  const total = barang.reduce((n, b) => n + (jumlah[b.id] || 0) * (b.harga_jual || 0), 0) + (lainnya || 0);
  const namaPilihan = pelanggan.find((p) => p.id === pelangganId)?.nama || namaBaru.trim();

  async function simpan() {
    setGalat("");
    let idPelanggan = pelangganId;
    if (bayar === "bon" && !idPelanggan && namaBaru.trim()) {
      const hasil = await siapkanPelanggan(namaBaru);
      if (hasil.galat) return setGalat(hasil.galat);
      idPelanggan = hasil.pelanggan.id;
    }
    const hasil = await jual({
      pilihan: Object.entries(jumlah).map(([barang_id, n]) => ({ barang_id, jumlah: n })),
      lainnya: lainnya || 0,
      modalLainnya,
      keterangan,
      bayar,
      pelangganId: idPelanggan,
    });
    if (hasil.galat) return setGalat(hasil.galat);
    onTersimpan(`Tersimpan: jual ${formatRupiah(hasil.catatan.nominal)}`);
    onTutup();
  }

  // Tunggu isi laci dan stok dimuat, supaya tidak sempat tampil "Rp 0" atau "Stok habis" yang keliru
  if (!isi) return null;

  return (
    <div className={bersama.susun}>
      {barang.length > 0 && (
        <div className={bersama.kartu}>
          {daftar.map((b) => {
            const n = jumlah[b.id] || 0;
            const penuh = n >= stok(b.id);
            return (
              <div className={gaya.baris} key={b.id}>
                <span className={gaya.nama}>
                  <span className={n ? "" : gaya.redup}>{b.nama}</span>
                  <small>{!b.harga_jual ? "Harga jual belum diisi" : stok(b.id) <= 0 ? "Stok habis" : `${ribuan(b.harga_jual)} · stok ${stok(b.id)}`}</small>
                </span>
                {n > 0 && (
                  <>
                    <button type="button" className={gaya.tombol} aria-label={`Kurangi ${b.nama}`} onClick={() => ubah(b.id, -1)}>
                      −
                    </button>
                    <strong className={gaya.jumlah}>{n}</strong>
                  </>
                )}
                <button type="button" className={`${gaya.tombol} ${gaya.tambah}`} aria-label={`Tambah ${b.nama}`} disabled={!bisaDijual(b) || penuh} onClick={() => ubah(b.id, 1)}>
                  +
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className={gaya.tautanDua}>
        {barang.length > daftar.length && (
          <button type="button" className={bersama.tautan} onClick={() => setCari(cari === null ? "" : null)}>
            + Barang lain
          </button>
        )}
        <button type="button" className={bersama.tautan} aria-expanded={lainnyaBuka} onClick={() => setLainnyaBuka(!lainnyaBuka)}>
          + Lainnya
        </button>
      </div>

      {cari !== null && (
        <>
          <input className={bersama.input} type="search" aria-label="Cari barang" placeholder="Cari barang" autoComplete="off" value={cari} onChange={(e) => setCari(e.target.value)} />
          {hasilCari.length > 0 && (
            <div className={bersama.deret}>
              {hasilCari.slice(0, 12).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={bersama.chip}
                  onClick={() => {
                    setTambahan((t) => [...t, b.id]);
                    if (bisaDijual(b)) ubah(b.id, 1);
                  }}
                >
                  {b.nama}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {lainnyaBuka && (
        <div className={gaya.lainnya}>
          <InputRupiah label="Nominal jualan lainnya" nilai={lainnya} onUbah={setLainnya} />
          <input className={bersama.input} aria-label="Keterangan jualan lainnya" placeholder="Keterangan (gorengan, pulsa)" autoComplete="off" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
          <label className={gaya.labelModal}>
            Modal (boleh kosong)
            <InputRupiah label="Modal jualan lainnya" nilai={modalLainnya} onUbah={setModalLainnya} />
          </label>
        </div>
      )}

      <Geser
        label="Cara bayar"
        pilihan={[
          { nilai: "tunai", label: "Tunai" },
          { nilai: "bon", label: "Bon" },
        ]}
        nilai={bayar}
        onUbah={setBayar}
        warna={bayar === "bon" ? "var(--bon-teks)" : undefined}
      />

      {bayar === "bon" && <PilihPelanggan daftar={pelanggan} terpilih={pelangganId} onPilih={setPelangganId} namaBaru={namaBaru} onNamaBaru={setNamaBaru} />}

      <p className={bersama.galat} role="alert">
        {galat}
      </p>

      <div className={bersama.kartuRute}>
        <Rute dari="pembeli" ke={bayar === "bon" ? "bon" : "laci"} namaPelanggan={namaPilihan} nominal={total} />
      </div>

      <button type="button" className={bersama.simpan} disabled={total <= 0} onClick={simpan}>
        Simpan
      </button>
    </div>
  );
}

export default function LembarJual({ terbuka, onTutup, onTersimpan }) {
  return (
    <Lembar terbuka={terbuka} onTutup={onTutup} judul="Jual">
      <IsiJual onTutup={onTutup} onTersimpan={onTersimpan} />
    </Lembar>
  );
}
