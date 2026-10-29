// pwa.js: daftarkan service worker (kalau browser mendukung).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // Gagal mendaftar tidak apa-apa: aplikasi tetap jalan seperti biasa.
    });
  });
}

// Kalau halaman dibiarkan terbuka sampai lewat tengah malam, muat ulang supaya
// "hari ini" mengikuti tanggal sebenarnya. Dicek saat halaman kembali terlihat
// dan tiap menit. Tidak dimuat ulang saat pengguna sedang mengetik.
const tanggalDimuat = hariIni();

function cekGantiHari() {
  if (hariIni() === tanggalDimuat) return;
  const aktif = document.activeElement;
  if (aktif && aktif.tagName === "INPUT" && aktif.value) return;
  location.reload();
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") cekGantiHari();
});
setInterval(cekGantiHari, 60 * 1000);
