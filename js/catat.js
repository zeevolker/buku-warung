// catat.js: logika halaman Catat Cepat.
const formEl = document.getElementById("form-catat");
const nominalEl = document.getElementById("nominal");
const catatanEl = document.getElementById("catatan");
const pesanEl = document.getElementById("pesan");
const daftarEl = document.getElementById("daftar");
const totalMasukEl = document.getElementById("total-masuk");
const totalKeluarEl = document.getElementById("total-keluar");
const untungEl = document.getElementById("untung");

function simpan(tipe) {
  const nominal = Number(nominalEl.value);

  if (!nominal || nominal <= 0) {
    pesanEl.textContent = "Isi nominal dulu, harus lebih dari 0.";
    nominalEl.focus();
    return;
  }

  tambahTransaksi(tipe, nominal, catatanEl.value);
  pesanEl.textContent = "";
  formEl.reset();
  nominalEl.focus();
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

    const hapus = document.createElement("button");
    hapus.type = "button";
    hapus.className = "hapus";
    hapus.textContent = "Hapus";
    hapus.addEventListener("click", () => {
      if (confirm("Hapus catatan ini?")) {
        hapusTransaksi(t.id);
        tampilkan();
      }
    });

    li.append(info, nominal, hapus);
    daftarEl.appendChild(li);
  });
}

document.getElementById("btn-masuk").addEventListener("click", () => simpan("masuk"));
document.getElementById("btn-keluar").addEventListener("click", () => simpan("keluar"));

tampilkan();
