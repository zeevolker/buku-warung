// catat.js: logika halaman Catat Cepat.
const formEl = document.getElementById("form-catat");
const nominalEl = document.getElementById("nominal");
const catatanEl = document.getElementById("catatan");
const pesanEl = document.getElementById("pesan");
const infoEl = document.getElementById("info");
const bannerEl = document.getElementById("banner-ubah");
const daftarEl = document.getElementById("daftar");
const totalMasukEl = document.getElementById("total-masuk");
const totalKeluarEl = document.getElementById("total-keluar");
const untungEl = document.getElementById("untung");

let idDiubah = null; // null = mode catat baru, angka = sedang mengubah catatan itu
let timerInfo;

document.getElementById("tanggal-hari-ini").textContent = new Date().toLocaleDateString("id-ID", {
  weekday: "long", day: "numeric", month: "long", year: "numeric",
});

function tampilInfo(teks) {
  infoEl.textContent = teks;
  clearTimeout(timerInfo);
  timerInfo = setTimeout(() => { infoEl.textContent = ""; }, 3000);
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
  bannerEl.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
  nominalEl.focus();
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

  const jenis = tipe === "masuk" ? "Uang masuk" : "Uang keluar";
  tampilInfo(`${sedangUbah ? "Diubah" : "Tersimpan"}: ${jenis} ${formatRupiah(nominal)}`);
  pesanEl.textContent = "";
  selesaiUbah();
  formEl.reset();
  tampilkan();
}

function tampilkan() {
  const hariIniData = ambilData(KEY_TRANSAKSI)
    .filter((t) => t.tanggal === hariIni())
    .reverse(); // yang terbaru di atas

  const totalMasuk = hariIniData
    .filter((t) => t.tipe === "masuk")
    .reduce((jumlah, t) => jumlah + t.nominal, 0);
  const totalKeluar = hariIniData
    .filter((t) => t.tipe === "keluar")
    .reduce((jumlah, t) => jumlah + t.nominal, 0);

  totalMasukEl.textContent = formatRupiah(totalMasuk);
  totalKeluarEl.textContent = formatRupiah(totalKeluar);
  untungEl.textContent = formatRupiah(totalMasuk - totalKeluar);

  daftarEl.innerHTML = "";

  if (hariIniData.length === 0) {
    const kosong = document.createElement("li");
    kosong.className = "kosong";
    kosong.textContent = "Belum ada catatan hari ini. Isi nominal di atas lalu pilih Uang Masuk atau Uang Keluar.";
    daftarEl.appendChild(kosong);
    return;
  }

  hariIniData.forEach((t) => {
    const li = document.createElement("li");
    li.className = "item " + t.tipe;

    const info = document.createElement("span");
    info.textContent = t.catatan || (t.tipe === "masuk" ? "Uang masuk" : "Uang keluar");

    const nominal = document.createElement("strong");
    nominal.textContent = (t.tipe === "masuk" ? "+ " : "- ") + formatRupiah(t.nominal);

    const waktu = document.createElement("small");
    waktu.className = "waktu";
    waktu.textContent = labelWaktuTransaksi(t);

    const ubah = document.createElement("button");
    ubah.type = "button";
    ubah.className = "ubah-catat";
    ubah.textContent = "Ubah";
    ubah.addEventListener("click", () => mulaiUbah(t));

    const hapus = buatTombolHapus(() => {
      hapusTransaksi(t.id);
      if (idDiubah === t.id) { selesaiUbah(); formEl.reset(); }
      tampilkan();
    });

    const aksi = document.createElement("span");
    aksi.className = "aksi";
    aksi.append(ubah, hapus);

    li.append(info, nominal, waktu, aksi);
    daftarEl.appendChild(li);
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

document.getElementById("btn-masuk").addEventListener("click", () => simpan("masuk"));
document.getElementById("btn-keluar").addEventListener("click", () => simpan("keluar"));
document.getElementById("batal-ubah").addEventListener("click", () => { selesaiUbah(); formEl.reset(); });

tampilkan();