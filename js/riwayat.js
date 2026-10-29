// riwayat.js: lihat, ubah, dan hapus catatan dari tanggal mana pun.
const pilihEl = document.getElementById("pilih-tanggal");
const judulEl = document.getElementById("judul-tanggal");
const btnSebelum = document.getElementById("btn-sebelum");
const btnBerikut = document.getElementById("btn-berikut");
const btnHariIni = document.getElementById("btn-hari-ini");
const btnBagikan = document.getElementById("btn-bagikan");
const daftarEl = document.getElementById("daftar-riwayat");
const masukEl = document.getElementById("r-masuk");
const keluarEl = document.getElementById("r-keluar");
const totalEl = document.getElementById("r-total");

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
let tanggal = hariIni();
let daftar = [];
let hasil = { masuk: 0, keluar: 0, total: 0 };

// Dibuka dengan alamat riwayat.html?tanggal=2026-10-28 (misalnya setelah mengubah catatan)
const dariAlamat = new URLSearchParams(location.search).get("tanggal");
if (dariAlamat && POLA_TANGGAL.test(dariAlamat) && dariAlamat <= hariIni()) {
  tanggal = dariAlamat;
}

function pindahKe(tanggalBaru) {
  // Tanggal tidak valid atau di masa depan ditolak; tampilkan() mengembalikan
  // kolom tanggal ke tanggal yang sedang dilihat.
  if (POLA_TANGGAL.test(tanggalBaru) && tanggalBaru <= hariIni()) {
    tanggal = tanggalBaru;
    // Simpan tanggal di alamat supaya muat ulang tetap di tanggal yang sama.
    const alamat =
      tanggal === hariIni() ? location.pathname : "?tanggal=" + tanggal;
    history.replaceState(null, "", alamat);
  }
  tampilkan();
}

function ubahCatatan(t) {
  location.href = `index.html?ubah=${t.id}&kembali=riwayat`;
}

function hapusCatatan(t) {
  hapusTransaksi(t.id);
  tampilkan();
}

function teksBagikan() {
  return [
    "Buku Warung: " + formatTanggalLengkap(tanggal),
    "Uang masuk: " + formatRupiah(hasil.masuk),
    "Uang keluar: " + formatRupiah(hasil.keluar),
    "Total: " + formatRupiah(hasil.total),
    daftar.length + " catatan",
  ].join("\n");
}

function tampilkan() {
  const hariIniStr = hariIni();
  pilihEl.value = tanggal;
  pilihEl.max = hariIniStr;
  judulEl.textContent =
    formatTanggalLengkap(tanggal) + (tanggal === hariIniStr ? " (hari ini)" : "");
  btnBerikut.disabled = tanggal >= hariIniStr;
  btnHariIni.hidden = tanggal === hariIniStr;

  daftar = transaksiPadaTanggal(tanggal);
  hasil = hitungTotal(daftar);
  masukEl.textContent = formatRupiah(hasil.masuk);
  keluarEl.textContent = formatRupiah(hasil.keluar);
  totalEl.textContent = formatRupiah(hasil.total);
  btnBagikan.disabled = daftar.length === 0;

  daftarEl.innerHTML = "";

  if (daftar.length === 0) {
    const kosong = document.createElement("li");
    kosong.className = "kosong";
    kosong.textContent = "Tidak ada catatan pada tanggal ini.";
    daftarEl.appendChild(kosong);
    return;
  }

  daftar.forEach((t) => {
    daftarEl.appendChild(
      buatItemTransaksi(t, { onUbah: ubahCatatan, onHapus: hapusCatatan }),
    );
  });
}

btnSebelum.addEventListener("click", () => pindahKe(geserTanggal(tanggal, -1)));
btnBerikut.addEventListener("click", () => pindahKe(geserTanggal(tanggal, 1)));
btnHariIni.addEventListener("click", () => pindahKe(hariIni()));
pilihEl.addEventListener("change", () => pindahKe(pilihEl.value));
btnBagikan.addEventListener("click", () => bagikanTeks(teksBagikan()));

tampilkan();
