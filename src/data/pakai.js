// pakai.js: penghubung data ke tampilan. Memakai useLiveQuery, jadi layar otomatis
// ikut berubah setiap ada data yang berubah di database.

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, semuaAda, ambilMeta } from "./db.js";
import { bacaIsi } from "./ringkasan.js";
import { hariIni, geserTanggal } from "./tanggal.js";

const keMs = (tanggal) => {
  const [t, b, h] = tanggal.split("-").map(Number);
  return new Date(t, b - 1, h).getTime();
};

// Tanggal hari ini yang ikut berganti kalau aplikasi dibiarkan terbuka melewati tengah malam
export function useTanggalHariIni() {
  const [tanggal, setTanggal] = useState(hariIni);
  useEffect(() => {
    const periksa = () => setTanggal(hariIni());
    const timer = setInterval(periksa, 60_000);
    document.addEventListener("visibilitychange", periksa);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", periksa);
    };
  }, []);
  return tanggal;
}

// { laci, bon: { id: n }, stok: { id: n } }, atau undefined selagi dimuat
export const useIsi = () => useLiveQuery(bacaIsi);

export const useBarang = () => useLiveQuery(() => semuaAda(db.barang), [], []);
export const usePelanggan = () => useLiveQuery(() => semuaAda(db.pelanggan), [], []);
export const useSemuaCatatan = () => useLiveQuery(() => semuaAda(db.catatan), [], []);

// Catatan dalam satu tanggal, terbaru di atas
export function useCatatanHari(tanggal) {
  return useLiveQuery(
    async () => {
      const dari = keMs(tanggal);
      const sampai = keMs(geserTanggal(tanggal, 1));
      const daftar = await db.catatan.where("waktu").between(dari, sampai, true, false).toArray();
      return daftar.filter((c) => !c.deleted).sort((a, b) => b.waktu - a.waktu);
    },
    [tanggal],
    []
  );
}

// Berapa kali tiap barang terjual dalam 30 hari terakhir, untuk mengurutkan lembar Jual
export function useKeseringanJual(tanggal) {
  return useLiveQuery(
    async () => {
      const dari = keMs(geserTanggal(tanggal, -30));
      const daftar = await db.catatan.where("waktu").aboveOrEqual(dari).toArray();
      const hitungan = {};
      for (const c of daftar) {
        if (c.deleted || c.dari !== "pembeli") continue;
        for (const b of c.item || []) if (b.barang_id) hitungan[b.barang_id] = (hitungan[b.barang_id] || 0) + b.jumlah;
      }
      return hitungan;
    },
    [tanggal],
    {}
  );
}

export const usePengingatBelum = () =>
  useLiveQuery(async () => (await semuaAda(db.pengingat)).filter((p) => !p.selesai).length, [], 0);

export const useNamaWarung = () => useLiveQuery(() => ambilMeta("nama_warung"), [], null);
