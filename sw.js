// sw.js: service worker supaya aplikasi bisa dibuka tanpa internet.
// Strategi: coba ambil versi terbaru dari internet dulu; kalau gagal (offline),
// pakai salinan yang tersimpan. Jadi pembaruan kode tetap sampai ke pengguna.
const NAMA_CACHE = "buku-warung-v3";

const FILE_AWAL = [
  "./",
  "index.html",
  "riwayat.html",
  "ringkasan.html",
  "stok.html",
  "kasbon.html",
  "css/style.css",
  "js/storage.js",
  "js/ui.js",
  "js/catat.js",
  "js/ringkasan.js",
  "js/stok.js",
  "js/kasbon.js",
  "js/riwayat.js",
  "js/pengingat.js",
  "js/cadangan.js",
  "js/pwa.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(NAMA_CACHE).then((cache) => cache.addAll(FILE_AWAL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((nama) => Promise.all(nama.filter((n) => n !== NAMA_CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req, { cache: "no-cache" })
      .then((res) => {
        const salinan = res.clone();
        caches.open(NAMA_CACHE).then((cache) => cache.put(req, salinan));
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("index.html")))
  );
});
