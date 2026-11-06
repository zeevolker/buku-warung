// Panduan.jsx: panduan 3 langkah di Beranda: lapisan gelap, tombol yang disorot tetap terlihat,
// dan gelembung penjelas. Tombol yang disorot dicari lewat atribut data-panduan.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gaya from "./Panduan.module.css";

const LANGKAH = [
  { sasaran: "jual", judul: "Ada barang laku? Tekan Jual.", isi: "Pilih barangnya, lalu tunai atau bon." },
  { sasaran: "belanja", judul: "Uang keluar? Tekan Belanja.", isi: "Beli stok, bayar biaya warung, atau pelanggan pinjam uang." },
  { sasaran: "bon", judul: "Pelanggan bayar? Tekan Terima bon.", isi: "Pilih pelanggannya, bonnya langsung berkurang." },
];
const JARAK = 6; // jarak sorotan dari tepi tombol

export default function Panduan({ onSelesai }) {
  const [nomor, setNomor] = useState(0);
  const [kotak, setKotak] = useState(null);
  const tombolLanjut = useRef(null);
  const langkah = LANGKAH[nomor];
  const terakhir = nomor === LANGKAH.length - 1;

  // Ukur posisi tombol yang disorot, dan ukur lagi kalau layar berubah ukuran
  useLayoutEffect(() => {
    function ukur() {
      const sasaran = document.querySelector(`[data-panduan="${langkah.sasaran}"]`);
      setKotak(sasaran ? sasaran.getBoundingClientRect() : null);
    }
    ukur();
    // Ukur lagi setelah transisi layar selesai dan datanya tampil, karena posisinya bisa bergeser
    const timer = setTimeout(ukur, 300);
    addEventListener("resize", ukur);
    addEventListener("scroll", ukur);
    return () => {
      clearTimeout(timer);
      removeEventListener("resize", ukur);
      removeEventListener("scroll", ukur);
    };
  }, [langkah.sasaran]);

  useEffect(() => {
    tombolLanjut.current?.focus();
  }, [nomor]);

  return (
    <div className={gaya.lapisan} role="dialog" aria-modal="true" aria-label="Panduan" onKeyDown={(e) => e.key === "Escape" && onSelesai()}>
      {kotak && <div className={gaya.sorot} style={{ left: kotak.left - JARAK, top: kotak.top - JARAK, width: kotak.width + JARAK * 2, height: kotak.height + JARAK * 2 }} />}
      <div className={gaya.gelembung} style={kotak ? { top: kotak.bottom + 20 } : undefined}>
        <span className={gaya.nomor}>
          {nomor + 1} dari {LANGKAH.length}
        </span>
        <strong>{langkah.judul}</strong>
        <span>{langkah.isi}</span>
        <div className={gaya.tombol}>
          <button type="button" className={gaya.lewati} onClick={onSelesai}>
            Lewati
          </button>
          <button ref={tombolLanjut} type="button" className={gaya.lanjut} onClick={() => (terakhir ? onSelesai() : setNomor(nomor + 1))}>
            {terakhir ? "Selesai" : "Lanjut"}
          </button>
        </div>
      </div>
    </div>
  );
}
