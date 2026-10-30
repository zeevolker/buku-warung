// hitung.js: semua perhitungan angka. Fungsi di sini "murni": menerima daftar baris,
// mengembalikan angka, tanpa membaca database. Karena itu mudah dites (lihat tests/).
//
// Prinsip penting: stok, sisa kasbon, dan total TIDAK disimpan sebagai satu angka,
// tapi selalu dihitung dari catatan-catatannya. Dengan begitu dua HP yang mencatat
// penjualan bersamaan saat offline tidak saling menimpa angka stok.

const hidup = (b) => !b.deleted;

// Jenis utang: "barang" (dari stok), "lain" (barang di luar stok), "tunai" (pinjam uang).
// Catatan lama belum punya kolom jenis, jadi ditebak dari ada/tidaknya barang.
export function jenisKasbon(k) {
  if (k.tipe !== "utang") return null;
  return k.jenis || (k.barang_id ? "barang" : "lain");
}

// Stok tiap barang = jumlah semua pergerakan stoknya (awal, tambah, jual, kasbon, ...)
export function hitungStok(mutasi) {
  const stok = new Map();
  for (const m of mutasi.filter(hidup)) {
    stok.set(m.barang_id, (stok.get(m.barang_id) || 0) + m.jumlah);
  }
  return stok;
}

// Total = uang masuk dikurangi uang keluar (arus kas, bukan laba)
export function hitungKas(transaksi) {
  let masuk = 0;
  let keluar = 0;
  for (const t of transaksi.filter(hidup)) {
    if (t.tipe === "masuk") masuk += t.nominal;
    else if (t.tipe === "keluar") keluar += t.nominal;
  }
  return { masuk, keluar, total: masuk - keluar };
}

// Sisa kasbon tiap pelanggan = utang dikurangi bayar
export function hitungSisaKasbon(kasbon) {
  const sisa = new Map();
  for (const k of kasbon.filter(hidup)) {
    const nilai = k.tipe === "utang" ? k.nominal : -k.nominal;
    sisa.set(k.pelanggan_id, (sisa.get(k.pelanggan_id) || 0) + nilai);
  }
  return sisa;
}

// Untung dari barang = harga jual - modal, untuk penjualan tunai (lewat tombol Jual)
// maupun kasbon barang. Hanya dihitung kalau modalnya diketahui, supaya untung tidak
// terlihat lebih besar dari kenyataan.
export function hitungUntungBarang(transaksi, kasbon) {
  let untung = 0;
  let jumlah = 0;
  const tambah = (baris) => {
    if (baris.modal === null || baris.modal === undefined) return;
    untung += baris.nominal - baris.modal;
    jumlah += 1;
  };
  transaksi.filter(hidup).filter((t) => t.sumber === "jual").forEach(tambah);
  kasbon.filter(hidup).filter((k) => k.tipe === "utang" && k.barang_id).forEach(tambah);
  return { untung, jumlah };
}

// Kasbon yang diberikan dan yang dibayar dalam satu periode
export function hitungArusKasbon(kasbon) {
  let utangBaru = 0;
  let dibayar = 0;
  for (const k of kasbon.filter(hidup)) {
    if (k.tipe === "utang") utangBaru += k.nominal;
    else dibayar += k.nominal;
  }
  return { utangBaru, dibayar };
}

// Saring baris yang tanggalnya di antara `dari` dan `sampai` (inklusif)
export function dalamRentang(baris, dari, sampai) {
  return baris.filter((b) => hidup(b) && b.tanggal >= dari && b.tanggal <= sampai);
}
