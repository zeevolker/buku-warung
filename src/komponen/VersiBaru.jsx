// VersiBaru.jsx: mendaftarkan service worker dan memberi tahu kalau ada versi baru.
// Versi baru menunggu sampai pengguna menekan Muat ulang, atau aplikasi dibuka lagi,
// supaya isian yang sedang diketik tidak hilang.
import { useEffect, useRef, useState } from "react";
import gaya from "./VersiBaru.module.css";

export default function VersiBaru() {
  const [ada, setAda] = useState(false);
  const perbarui = useRef(null);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    import("virtual:pwa-register")
      .then(({ registerSW }) => {
        perbarui.current = registerSW({ onNeedRefresh: () => setAda(true) });
      })
      .catch((e) => console.warn("Service worker gagal didaftarkan:", e));
    // Buang simpanan service worker v3, yang tidak dipakai lagi
    globalThis.caches?.keys().then((nama) => nama.filter((n) => n.startsWith("bw-v")).forEach((n) => caches.delete(n)));
  }, []);

  if (!ada) return null;
  return (
    <div className={gaya.pita} role="status">
      <span>Versi baru tersedia</span>
      <button type="button" onClick={() => perbarui.current?.(true)}>
        Muat ulang
      </button>
    </div>
  );
}
