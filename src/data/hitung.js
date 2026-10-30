// hitung.js: semua angka di aplikasi dihitung dari daftar catatan.
//
// Ada 4 jenis catatan:
//   jual    barang laku. dibayar "sekarang" (uang masuk) atau "nanti" (jadi utang pelanggan)
//   keluar  uang keluar untuk "belanja" stok, "biaya" warung, atau "pinjaman" ke pelanggan
//   bayar   pelanggan membayar utangnya (uang masuk)
//   stok    koreksi stok tanpa uang (stok awal, barang rusak, salah hitung)
//
// Fungsi di sini "murni": hanya menerima catatan lalu mengembalikan angka,
// tanpa membaca database. Karena itu mudah dites (lihat folder tests/).

const masihAda = (c) => !c.deleted;

// ---------- Efek satu catatan ----------

export function uangMasuk(c) {
  if (c.jenis === "jual" && c.dibayar === "sekarang") return c.nominal;
  if (c.jenis === "bayar") return c.nominal;
  return 0;
}

export function uangKeluar(c) {
  return c.jenis === "keluar" ? c.nominal : 0;
}

// Perubahan stok: [{ barang_id, jumlah }], jumlah negatif = berkurang
export function perubahanStok(c) {
  const barang = (c.barang || []).filter((b) => b.barang_id);
  if (c.jenis === "jual") return barang.map((b) => ({ barang_id: b.barang_id, jumlah: -b.jumlah }));
  if (c.jenis === "keluar" && c.untuk === "belanja") return barang.map((b) => ({ barang_id: b.barang_id, jumlah: b.jumlah }));
  if (c.jenis === "stok") return barang.map((b) => ({ barang_id: b.barang_id, jumlah: b.jumlah }));
  return [];
}

// Perubahan utang pelanggan: positif = utang bertambah
export function perubahanUtang(c) {
  if (c.jenis === "jual" && c.dibayar === "nanti") return c.nominal;
  if (c.jenis === "keluar" && c.untuk === "pinjaman") return c.nominal;
  if (c.jenis === "bayar") return -c.nominal;
  return 0;
}

// Untung = (harga jual - modal) x jumlah, hanya untuk barang yang modalnya diketahui
export function untungCatatan(c) {
  if (c.jenis !== "jual") return 0;
  return (c.barang || [])
    .filter((b) => b.modal !== null && b.modal !== undefined)
    .reduce((n, b) => n + (b.harga - b.modal) * b.jumlah, 0);
}

// ---------- Rangkuman banyak catatan ----------

export function hitungUang(catatan) {
  let masuk = 0;
  let keluar = 0;
  for (const c of catatan.filter(masihAda)) {
    masuk += uangMasuk(c);
    keluar += uangKeluar(c);
  }
  return { masuk, keluar, selisih: masuk - keluar };
}

// Map: id barang -> stok sekarang
export function hitungStok(catatan) {
  const stok = new Map();
  for (const c of catatan.filter(masihAda)) {
    for (const p of perubahanStok(c)) stok.set(p.barang_id, (stok.get(p.barang_id) || 0) + p.jumlah);
  }
  return stok;
}

// Map: id pelanggan -> sisa utang
export function hitungUtang(catatan) {
  const utang = new Map();
  for (const c of catatan.filter(masihAda)) {
    const n = perubahanUtang(c);
    if (n && c.pelanggan_id) utang.set(c.pelanggan_id, (utang.get(c.pelanggan_id) || 0) + n);
  }
  return utang;
}

export function hitungUntung(catatan) {
  return catatan.filter(masihAda).reduce((n, c) => n + untungCatatan(c), 0);
}

// Utang pelanggan dalam satu periode: yang baru dan yang dibayar
export function hitungArusUtang(catatan) {
  let baru = 0;
  let dibayar = 0;
  for (const c of catatan.filter(masihAda)) {
    const n = perubahanUtang(c);
    if (n > 0) baru += n;
    else dibayar -= n;
  }
  return { baru, dibayar };
}

export function dalamRentang(catatan, dari, sampai) {
  return catatan.filter((c) => masihAda(c) && c.tanggal >= dari && c.tanggal <= sampai);
}
