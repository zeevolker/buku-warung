// sw.js: service worker supaya aplikasi bisa dibuka tanpa internet.
//
// Saat dipasang, semua file hasil build disimpan. Daftarnya dibaca dari asset-manifest.json
// yang dibuat Vite (nama file JS/CSS berubah tiap build, jadi tidak bisa ditulis tangan).
// Strategi saat dipakai:
// - Halaman HTML: coba internet dulu supaya selalu versi terbaru, pakai salinan kalau offline.
// - File di assets/ (namanya mengandung hash, jadi tidak pernah berubah): pakai salinan dulu.
// - Permintaan ke server lain (Supabase, Google) tidak disentuh.

const VERSI = "bw-v2.1";
const HALAMAN = ["./", "index.html", "riwayat.html", "ringkasan.html", "stok.html", "kasbon.html", "akun.html", "privasi.html", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png"];

async function daftarAset() {
  try {
    const res = await fetch("asset-manifest.json", { cache: "no-store" });
    const manifest = await res.json();
    const file = new Set();
    for (const isi of Object.values(manifest)) {
      if (isi.file) file.add(isi.file);
      (isi.css || []).forEach((c) => file.add(c));
      (isi.assets || []).forEach((a) => file.add(a));
    }
    return [...file];
  } catch {
    return []; // tidak apa-apa: aset tetap tersimpan saat pertama kali dimuat
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSI);
      await cache.addAll(HALAMAN);
      await cache.addAll(await daftarAset());
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const nama of await caches.keys()) if (nama !== VERSI) await caches.delete(nama);
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  if (url.pathname.includes("/assets/")) {
    // Salinan dulu
    event.respondWith(
      caches.match(req).then(
        (ada) =>
          ada ||
          fetch(req).then((res) => {
            const salin = res.clone();
            caches.open(VERSI).then((c) => c.put(req, salin));
            return res;
          })
      )
    );
    return;
  }

  // Internet dulu, salinan kalau offline
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const salin = res.clone();
          caches.open(VERSI).then((c) => c.put(req, salin));
        }
        return res;
      })
      .catch(async () => (await caches.match(req, { ignoreSearch: true })) || caches.match("index.html"))
  );
});
