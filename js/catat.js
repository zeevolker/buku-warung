// catat.js: logika halaman Catat Cepat.
const formEl = document.getElementById("form-catat");
const nominalEl = document.getElementById("nominal");
const catatanEl = document.getElementById("catatan");
const pesanEl = document.getElementById("pesan");
const infoEl = document.getElementById("info");
const bannerEl = document.getElementById("banner-ubah");
const bannerTeksEl = document.getElementById("banner-teks");
const daftarEl = document.getElementById("daftar");
const totalMasukEl = document.getElementById("total-masuk");
const totalKeluarEl = document.getElementById("total-keluar");
const totalEl = document.getElementById("total");

let idDiubah = null; // null = mode catat baru, angka = sedang mengubah catatan itu
let tujuanKembali = null; // diisi kalau mengubah catatan dari halaman Riwayat
let timerInfo;

document.getElementById("tanggal-hari-ini").textContent =
  formatTanggalLengkap(hariIni());

function tampilInfo(teks) {
  infoEl.textContent = teks;
  clearTimeout(timerInfo);
  timerInfo = setTimeout(() => {
    infoEl.textContent = "";
  }, 3000);
}

function selesaiUbah() {
  idDiubah = null;
  bannerEl.hidden = true;
}

function mulaiUbah(t) {
  idDiubah = t.id;
  nominalEl.value = t.nominal.toLocaleString("id-ID");
  catatanEl.value = t.catatan;
  pesanEl.textContent = "";
  bannerTeksEl.textContent =
    t.tanggal === hariIni()
      ? "Sedang mengubah catatan. Pilih Uang Masuk atau Uang Keluar untuk menyimpan."
      : `Mengubah catatan tanggal ${formatTanggalPanjang(t.tanggal)}. Pilih Uang Masuk atau Uang Keluar untuk menyimpan.`;
  bannerEl.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
  nominalEl.focus();
}

function batalUbah() {
  if (tujuanKembali) {
    location.href = tujuanKembali;
    return;
  }
  selesaiUbah();
  formEl.reset();
}

function simpan(tipe) {
  const nominal = ambilAngka(nominalEl);

  if (nominal <= 0) {
    pesanEl.textContent = "Isi nominal dulu, harus lebih dari 0.";
    nominalEl.focus();
    return;
  }

  const sedangUbah = idDiubah !== null;
  const berhasil = sedangUbah
    ? ubahTransaksi(idDiubah, tipe, nominal, catatanEl.value)
    : tambahTransaksi(tipe, nominal, catatanEl.value);

  // Kalau gagal, biarkan isi form supaya pengguna tidak perlu mengetik ulang.
  if (!berhasil) return;

  // Mengubah catatan dari Riwayat: setelah disimpan, kembali ke tanggal itu.
  if (sedangUbah && tujuanKembali) {
    location.href = tujuanKembali;
    return;
  }

  const jenis = tipe === "masuk" ? "Uang masuk" : "Uang keluar";
  tampilInfo(
    `${sedangUbah ? "Diubah" : "Tersimpan"}: ${jenis} ${formatRupiah(nominal)}`,
  );
  pesanEl.textContent = "";
  selesaiUbah();
  formEl.reset();
  tampilkan();
}

function hapusDariDaftar(t) {
  hapusTransaksi(t.id);
  if (idDiubah === t.id) {
    selesaiUbah();
    formEl.reset();
  }
  tampilkan();
}

function tampilkan() {
  const hariIniData = transaksiPadaTanggal(hariIni());
  const hasil = hitungTotal(hariIniData);

  totalMasukEl.textContent = formatRupiah(hasil.masuk);
  totalKeluarEl.textContent = formatRupiah(hasil.keluar);
  totalEl.textContent = formatRupiah(hasil.total);

  daftarEl.innerHTML = "";

  if (hariIniData.length === 0) {
    const kosong = document.createElement("li");
    kosong.className = "kosong";
    kosong.textContent =
      "Belum ada catatan hari ini. Isi nominal di atas lalu pilih Uang Masuk atau Uang Keluar.";
    daftarEl.appendChild(kosong);
    return;
  }

  hariIniData.forEach((t) => {
    daftarEl.appendChild(
      buatItemTransaksi(t, { onUbah: mulaiUbah, onHapus: hapusDariDaftar }),
    );
  });
}

pasangFormatRupiah(nominalEl);

// Tombol nominal cepat: menambah ke nominal yang sudah ada (tap 2x +5.000 = 10.000)
document.querySelectorAll("[data-tambah]").forEach((tombol) => {
  tombol.addEventListener("click", () => {
    const baru = ambilAngka(nominalEl) + Number(tombol.dataset.tambah);
    nominalEl.value = baru.toLocaleString("id-ID");
  });
});

document
  .getElementById("btn-masuk")
  .addEventListener("click", () => simpan("masuk"));
document
  .getElementById("btn-keluar")
  .addEventListener("click", () => simpan("keluar"));
document.getElementById("batal-ubah").addEventListener("click", batalUbah);

tampilkan();

// Dibuka dari Riwayat: index.html?ubah=ID&kembali=riwayat
const params = new URLSearchParams(location.search);
const idDariAlamat = Number(params.get("ubah"));
if (idDariAlamat) {
  const t = ambilData(KEY_TRANSAKSI).find((x) => x.id === idDariAlamat);
  if (t) {
    if (params.get("kembali") === "riwayat") {
      tujuanKembali = "riwayat.html?tanggal=" + t.tanggal;
    }
    mulaiUbah(t);
  }
  // Hapus parameter supaya muat ulang tidak membuka mode ubah lagi.
  history.replaceState(null, "", location.pathname);
}
