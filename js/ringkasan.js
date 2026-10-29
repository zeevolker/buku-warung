// ringkasan.js: hitung total per hari, minggu, dan bulan.

// Tanggal disimpan sebagai teks "YYYY-MM-DD", jadi bisa dibandingkan langsung
// dengan >= dan <= (urutan abjadnya sama dengan urutan waktunya).
function awalMinggu() {
  const d = new Date();
  const selisihDariSenin = (d.getDay() + 6) % 7; // Minggu=0 -> 6, Senin=1 -> 0
  d.setDate(d.getDate() - selisihDariSenin);
  return formatTanggal(d);
}

function awalBulan() {
  const d = new Date();
  d.setDate(1);
  return formatTanggal(d);
}

function hitung(daftar) {
  const masuk = daftar
    .filter((t) => t.tipe === "masuk")
    .reduce((jumlah, t) => jumlah + t.nominal, 0);
  const keluar = daftar
    .filter((t) => t.tipe === "keluar")
    .reduce((jumlah, t) => jumlah + t.nominal, 0);
  return { masuk, keluar, total: masuk - keluar };
}

const semua = ambilData(KEY_TRANSAKSI);

// Tiap periode = aturan "transaksi ini termasuk atau tidak?"
const aturan = {
  hari: (t) => t.tanggal === hariIni(),
  minggu: (t) => t.tanggal >= awalMinggu(),
  bulan: (t) => t.tanggal >= awalBulan(),
};

document.querySelectorAll(".periode").forEach((kartu) => {
  const hasil = hitung(semua.filter(aturan[kartu.dataset.periode]));

  kartu.querySelector('[data-isi="masuk"]').textContent = formatRupiah(hasil.masuk);
  kartu.querySelector('[data-isi="keluar"]').textContent = formatRupiah(hasil.keluar);

  const totalEl = kartu.querySelector('[data-isi="total"]');
  totalEl.textContent = formatRupiah(hasil.total);
  totalEl.className = hasil.total < 0 ? "negatif" : "positif";
});
