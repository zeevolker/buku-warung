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

  // Untung barang = harga jual - harga beli, hanya dari barang yang dijual lewat tombol Jual
  // dan yang harga belinya diisi. Baris ini disembunyikan kalau belum ada penjualan seperti itu.
  const u = hitungUntungBarang(semua.filter(aturan[kartu.dataset.periode]));
  const barisUntung = kartu.querySelector(".baris.untung");
  barisUntung.hidden = u.jumlah === 0;
  const untungEl = kartu.querySelector('[data-isi="untung"]');
  untungEl.textContent = formatRupiah(u.untung);
  untungEl.className = u.untung < 0 ? "negatif" : "positif";
  kartu.querySelector('[data-isi="catatan-untung"]').textContent = u.jumlah
    ? `Dari ${u.jumlah} penjualan lewat tombol Jual yang harga belinya diisi.`
    : "";
});
