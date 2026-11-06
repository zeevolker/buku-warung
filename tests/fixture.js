// fixture.js: data contoh rancangan bagian 7 dan mockup Laporan, sebagai catatan sungguhan.
// Hari ini Kamis 5 November 2026. Angka harapannya ada di tests/hitung.test.js.

export const HARI_INI = "2026-11-05";
export const WAKTU_SEKARANG = new Date(2026, 10, 5, 13, 0).getTime();

export const pelanggan = [
  { id: "sari", nama: "Sari" },
  { id: "budi", nama: "Budi" },
  { id: "dedi", nama: "Pak Dedi" },
  { id: "rina", nama: "Ibu Rina" },
];

export const barang = [
  { id: "indomie", nama: "Indomie", harga_jual: 3500, harga_beli: 3000 },
  { id: "teh", nama: "Teh botol", harga_jual: 7500, harga_beli: 6000 },
  { id: "minyak", nama: "Minyak goreng", harga_jual: 18000, harga_beli: 15500 },
  { id: "rokok", nama: "Rokok Surya", harga_jual: 34000, harga_beli: 31600 },
  { id: "gula", nama: "Gula", harga_jual: 17000, harga_beli: 13000 },
  { id: "beras", nama: "Beras karung", harga_jual: 400000, harga_beli: 330000 },
];

const namaBarang = new Map(barang.map((b) => [b.id, b.nama]));
const item = (barang_id, jumlah, harga, modal) => ({ barang_id, nama: namaBarang.get(barang_id), jumlah, harga, modal });

let urutan = 0;
function catat(bulan, tgl, jam, menit, dari, ke, nominal, isi = {}) {
  return { id: `c${++urutan}`, waktu: new Date(2026, bulan - 1, tgl, jam, menit).getTime(), dari, ke, nominal, pelanggan_id: null, item: [], keterangan: "", deleted: false, ...isi };
}

const tunai = (bulan, tgl, jam, menit, nominal, daftar = []) => catat(bulan, tgl, jam, menit, "pembeli", "laci", nominal, { item: daftar });
const bon = (bulan, tgl, id, nominal, daftar = []) => catat(bulan, tgl, 9, 0, "pembeli", "bon", nominal, { pelanggan_id: id, item: daftar });
const biaya = (bulan, tgl, nominal, keterangan = "") => catat(bulan, tgl, 16, 0, "laci", "biaya", nominal, { keterangan });
const dariAgen = (bulan, tgl, nominal, daftar) => catat(bulan, tgl, 7, 0, "laci", "agen", nominal, { item: daftar });

// Empat jualan Oktober yang sama tiap minggu: 78 Indomie dan 30 Rokok Surya
const jualanMingguan = (tgl) => [
  tunai(10, tgl, 8, 0, 78 * 3500, [item("indomie", 78, 3500, 3000)]),
  tunai(10, tgl, 9, 0, 30 * 34000, [item("rokok", 30, 34000, 31600)]),
];

export const catatan = [
  // ---------- September: uang awal, stok awal, bon lama, untung Rp 1.814.000 ----------
  catat(9, 1, 7, 0, "pemilik", "laci", 138000, { keterangan: "Uang awal" }),
  catat(9, 1, 7, 1, "pemilik", "stok", 600000, { item: [item("teh", 100, 6000, 6000)] }),
  catat(9, 1, 7, 2, "pemilik", "stok", 775000, { item: [item("minyak", 50, 15500, 15500)] }),
  catat(9, 1, 7, 3, "pemilik", "stok", 6600000, { item: [item("beras", 20, 330000, 330000)] }),
  catat(9, 1, 7, 4, "pemilik", "bon", 80000, { pelanggan_id: "sari", keterangan: "Bon lama" }),
  catat(9, 1, 7, 5, "pemilik", "bon", 30000, { pelanggan_id: "budi", keterangan: "Bon lama" }),
  catat(9, 1, 7, 6, "pemilik", "bon", 40000, { pelanggan_id: "dedi", keterangan: "Bon lama" }),
  catat(9, 1, 7, 7, "pemilik", "bon", 40000, { pelanggan_id: "rina", keterangan: "Bon lama" }),
  tunai(9, 15, 12, 0, 1814000),

  // ---------- Oktober: untung Rp 2.050.000 (431rb, 492rb, 522rb, 605rb) ----------
  dariAgen(10, 2, 4740000, [item("rokok", 150, 31600, 31600)]),
  dariAgen(10, 2, 1200000, [item("indomie", 400, 3000, 3000)]),
  dariAgen(10, 2, 560000, [item("gula", 40, 14000, 14000)]),

  ...jualanMingguan(3),
  tunai(10, 3, 10, 0, 525000),
  biaya(10, 3, 205000),

  ...jualanMingguan(10),
  tunai(10, 10, 10, 0, 524000),
  bon(10, 10, "sari", 25000),
  bon(10, 10, "budi", 15000),
  bon(10, 10, "dedi", 12000),
  bon(10, 10, "rina", 10000),
  biaya(10, 10, 205000),

  ...jualanMingguan(17),
  tunai(10, 17, 10, 0, 616000),
  biaya(10, 17, 205000),
  catat(10, 20, 20, 0, "laci", "selisih", 12000),

  ...jualanMingguan(24),
  tunai(10, 24, 10, 0, 699000),
  biaya(10, 24, 205000),
  catat(10, 28, 18, 0, "laci", "pemilik", 1200000),

  // ---------- Senin 2 Nov: untung Rp 58.000 ----------
  dariAgen(11, 2, 400000, [item("minyak", 20, 20000, 15500)]),
  tunai(11, 2, 10, 0, 400000, [item("beras", 1, 400000, 330000)]),
  biaya(11, 2, 12000),

  // ---------- Selasa 3 Nov: untung Rp 61.000 ----------
  dariAgen(11, 3, 450000, [item("minyak", 30, 15000, 20000)]),
  tunai(11, 3, 10, 0, 405000, [item("beras", 1, 405000, 333000)]),
  bon(11, 3, "sari", 15000, [item("teh", 2, 7500, 6000)]),
  biaya(11, 3, 14000),

  // ---------- Rabu 4 Nov: untung Rp 49.000 ----------
  dariAgen(11, 4, 435000, [item("gula", 29, 15000, 14000)]),
  tunai(11, 4, 10, 0, 381000, [item("beras", 1, 381000, 318000)]),
  catat(11, 4, 15, 0, "bon", "laci", 10000, { pelanggan_id: "rina" }),
  biaya(11, 4, 14000),

  // ---------- Kamis 5 Nov (hari ini): untung Rp 56.000 ----------
  tunai(11, 5, 7, 0, 337000, [item("beras", 1, 337000, 270400)]),
  tunai(11, 5, 7, 40, 36000, [item("minyak", 2, 18000, 15500)]),
  tunai(11, 5, 8, 15, 11000, [item("indomie", 1, 3500, 3000), item("teh", 1, 7500, 6000)]),
  catat(11, 5, 9, 30, "pembeli", "bon", 28000, { pelanggan_id: "budi", item: [item("rokok", 1, 28000, 25600)] }),
  dariAgen(11, 5, 65000, [item("gula", 5, 13000, 14000)]),
  catat(11, 5, 11, 20, "bon", "laci", 20000, { pelanggan_id: "budi" }),
  catat(11, 5, 12, 0, "laci", "biaya", 20000, { keterangan: "Bayar plastik" }),
];
