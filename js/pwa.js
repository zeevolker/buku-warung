// pwa.js: daftarkan service worker (kalau browser mendukung).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // Gagal mendaftar tidak apa-apa: aplikasi tetap jalan seperti biasa.
    });
  });
}
