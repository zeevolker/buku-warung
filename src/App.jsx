// App.jsx: daftar rute, transisi antar layar, dan menu bawah.
import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router";
import { AnimatePresence, m } from "motion/react";
import MenuBawah from "./komponen/MenuBawah.jsx";
import { isiSekarang } from "./data/ringkasan.js";

// Setiap layar dimuat saat dibutuhkan
const Beranda = lazy(() => import("./layar/Beranda/Beranda.jsx"));
const Laporan = lazy(() => import("./layar/Laporan/Laporan.jsx"));
const Barang = lazy(() => import("./layar/Barang/Barang.jsx"));
const Pelanggan = lazy(() => import("./layar/Pelanggan/Pelanggan.jsx"));
const DetailPelanggan = lazy(() => import("./layar/DetailPelanggan/DetailPelanggan.jsx"));
const Riwayat = lazy(() => import("./layar/Riwayat/Riwayat.jsx"));
const Catatan = lazy(() => import("./layar/Catatan/Catatan.jsx"));
const Akun = lazy(() => import("./layar/Akun/Akun.jsx"));
const Masuk = lazy(() => import("./layar/Masuk/Masuk.jsx"));
const Mulai = lazy(() => import("./layar/Mulai/Mulai.jsx"));
const Privasi = lazy(() => import("./layar/Privasi/Privasi.jsx"));

// Layar yang tampil tanpa menu bawah
const TANPA_MENU = ["/masuk", "/mulai", "/privasi"];

export default function App() {
  const lokasi = useLocation();

  // Simpan ringkasan hari-hari yang sudah lewat, supaya layar lain tidak perlu menghitung ulang
  useEffect(() => {
    isiSekarang().catch((e) => console.warn("Ringkasan gagal disimpan:", e));
  }, []);

  // Layar baru selalu mulai dari atas
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [lokasi.pathname]);

  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        <m.main
          key={lokasi.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
        >
          <Suspense fallback={null}>
            <Routes location={lokasi}>
              <Route path="/" element={<Beranda />} />
              <Route path="/laporan" element={<Laporan />} />
              <Route path="/barang" element={<Barang />} />
              <Route path="/pelanggan" element={<Pelanggan />} />
              <Route path="/pelanggan/:id" element={<DetailPelanggan />} />
              <Route path="/riwayat" element={<Riwayat />} />
              <Route path="/catatan" element={<Catatan />} />
              <Route path="/akun" element={<Akun />} />
              <Route path="/masuk" element={<Masuk />} />
              <Route path="/mulai" element={<Mulai />} />
              <Route path="/privasi" element={<Privasi />} />
              <Route path="*" element={<Beranda />} />
            </Routes>
          </Suspense>
        </m.main>
      </AnimatePresence>
      {!TANPA_MENU.includes(lokasi.pathname) && <MenuBawah />}
    </>
  );
}
