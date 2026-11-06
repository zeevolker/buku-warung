// App.jsx: daftar rute, transisi antar layar, dan menu bawah.
import { lazy, Suspense, useEffect, useState } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router";
import { AnimatePresence, m } from "motion/react";
import MenuBawah from "./komponen/MenuBawah.jsx";
import VersiBaru from "./komponen/VersiBaru.jsx";
import { isiSekarang } from "./data/ringkasan.js";
import { ambilMeta, aturMeta, db } from "./data/db.js";
import { mulaiAkun, useAkun } from "./data/akun.js";

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

// Layar yang boleh dibuka sebelum selesai mengisi data awal
const BEBAS_MULAI = TANPA_MENU;

// Data lama dipindahkan lebih dulu. Library migrasi hanya dimuat kalau memang belum pernah berjalan.
let janjiPindah = null;
function pindahkanDataLama() {
  janjiPindah ??= (async () => {
    if (localStorage.getItem("bw4_migrasi_lokal")) return;
    const { pindahkanDataHp } = await import("./data/migrasi.js");
    await pindahkanDataHp();
  })();
  return janjiPindah;
}

// Layar selamat datang dilewati untuk layar bebas, dan saat baru kembali dari login Google,
// karena kodenya di alamat masih diproses Supabase.
function harusLewatMulai(alamat) {
  return !BEBAS_MULAI.includes(alamat) && !window.location.search.includes("code=");
}

// Yang sudah punya data tidak perlu lewat layar pertama kali lagi
async function sudahSelesaiMulai() {
  if (await ambilMeta("mulai_selesai")) return true;
  if ((await db.catatan.count()) || (await db.barang.count())) {
    await aturMeta("mulai_selesai", 1);
    return true;
  }
  return false;
}

export default function App() {
  const lokasi = useLocation();
  const pindah = useNavigate();
  const akun = useAkun();
  const [siap, setSiap] = useState(false);

  // Sekali saat aplikasi dibuka: pindahkan data lama, lalu sambungkan akun di belakang layar
  useEffect(() => {
    pindahkanDataLama()
      .catch((e) => console.error("Migrasi data lama gagal:", e))
      .then(sudahSelesaiMulai)
      .then((selesai) => {
        // Diarahkan sebelum tampil, supaya pengguna baru tidak sempat melihat Beranda kosong
        if (!selesai && harusLewatMulai(lokasi.pathname)) pindah("/mulai", { replace: true });
      })
      .catch((e) => console.error(e))
      .finally(() => {
        setSiap(true);
        mulaiAkun().catch((e) => console.warn("Gagal menyiapkan akun:", e));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pertama kali: arahkan ke layar selamat datang
  useEffect(() => {
    if (!siap || !harusLewatMulai(lokasi.pathname)) return;
    let batal = false;
    sudahSelesaiMulai().then((selesai) => {
      if (!selesai && !batal) pindah("/mulai", { replace: true });
    });
    return () => {
      batal = true;
    };
  }, [siap, lokasi.pathname, akun.email, pindah]);

  // Dibuka dari email "lupa kata sandi"
  useEffect(() => {
    if (akun.pulihkanSandi && lokasi.pathname !== "/masuk") pindah("/masuk", { replace: true });
  }, [akun.pulihkanSandi, lokasi.pathname, pindah]);

  // Simpan ringkasan hari-hari yang sudah lewat, supaya layar lain tidak perlu menghitung ulang
  useEffect(() => {
    if (siap) isiSekarang().catch((e) => console.warn("Ringkasan gagal disimpan:", e));
  }, [siap]);

  // Layar baru selalu mulai dari atas
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [lokasi.pathname]);

  if (!siap) return null;

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
      <VersiBaru />
    </>
  );
}
