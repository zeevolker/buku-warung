// hitung.js: semua angka di aplikasi dihitung dari daftar catatan.
//
// Satu rumus: isi tempat = total yang masuk KE tempat itu − total yang keluar DARI tempat itu.
//
// Semua fungsi di sini "murni": hanya menerima data lalu mengembalikan hasil, tanpa React
// dan tanpa database. Catatan yang sudah dihapus (deleted) selalu diabaikan.

import { tanggalDariMs, geserTanggal, awalMinggu, awalBulan, akhirBulan, geserBulan, hariIni } from "./tanggal.js";

const masihAda = (c) => !c.deleted;

export const tanggalCatatan = (c) => tanggalDariMs(c.waktu);

// rentang = { dari, sampai } berupa teks tanggal. Kalau kosong, semua catatan dipakai.
function dalamRentang(catatan, rentang) {
  const ada = catatan.filter(masihAda);
  if (!rentang) return ada;
  return ada.filter((c) => {
    const t = tanggalCatatan(c);
    return (!rentang.dari || t >= rentang.dari) && (!rentang.sampai || t <= rentang.sampai);
  });
}

const sampaiTanggal = (catatan, tanggal) => dalamRentang(catatan, { sampai: tanggal });

// ---------- Isi tempat ----------

// pelangganId hanya untuk bon: isiTempat(catatan, "bon", "budi") = utang Budi
export function isiTempat(catatan, tempat, pelangganId) {
  let isi = 0;
  for (const c of catatan.filter(masihAda)) {
    if (pelangganId && c.pelanggan_id !== pelangganId) continue;
    if (c.ke === tempat) isi += c.nominal;
    if (c.dari === tempat) isi -= c.nominal;
  }
  return isi;
}

// Map: id pelanggan -> sisa bon
export function semuaBon(catatan) {
  const bon = new Map();
  for (const c of catatan.filter(masihAda)) {
    if (c.ke === "bon") bon.set(c.pelanggan_id, (bon.get(c.pelanggan_id) || 0) + c.nominal);
    if (c.dari === "bon") bon.set(c.pelanggan_id, (bon.get(c.pelanggan_id) || 0) - c.nominal);
  }
  return bon;
}

// ---------- Stok ----------

// Aturan stok, satu-satunya di aplikasi. Mengembalikan +1, −1, atau 0.
// Barang masuk rak kalau dibeli dari agen atau ditambahkan ke stok.
// Barang keluar rak kalau dibeli pembeli atau dikeluarkan dari stok (rusak, hilang, dipakai).
export function arahStok(c) {
  if (c.ke === "agen" || c.ke === "stok") return 1;
  if (c.dari === "pembeli" || c.dari === "stok") return -1;
  return 0;
}

export function stokBarang(catatan, barangId) {
  return semuaStok(catatan).get(barangId) || 0;
}

// Map: id barang -> stok
export function semuaStok(catatan) {
  const stok = new Map();
  for (const c of catatan.filter(masihAda)) {
    const arah = arahStok(c);
    for (const b of c.item || []) {
      if (b.barang_id) stok.set(b.barang_id, (stok.get(b.barang_id) || 0) + arah * b.jumlah);
    }
  }
  return stok;
}

// ---------- Untung ----------

// Untung = hasil jualan − modal barang yang terjual − biaya
export function rincianUntung(catatan, rentang) {
  let hasil = 0;
  let modal = 0;
  let biaya = 0;
  for (const c of dalamRentang(catatan, rentang)) {
    if (c.dari === "pembeli") {
      hasil += c.nominal;
      for (const b of c.item || []) modal += b.jumlah * (b.modal || 0);
    }
    if (c.ke === "biaya") biaya += c.nominal;
  }
  return { hasil, modal, biaya, untung: hasil - modal - biaya };
}

export const untung = (catatan, rentang) => rincianUntung(catatan, rentang).untung;

// ---------- Bagian laporan ----------

export function arusLaci(catatan, rentang) {
  let masuk = 0;
  let keluar = 0;
  for (const c of dalamRentang(catatan, rentang)) {
    if (c.ke === "laci") masuk += c.nominal;
    if (c.dari === "laci") keluar += c.nominal;
  }
  return { masuk, keluar };
}

// Hasil Hitung ulang: positif berarti uang fisik lebih banyak dari catatan
export function selisihLaci(catatan, rentang) {
  let selisih = 0;
  for (const c of dalamRentang(catatan, rentang)) {
    if (c.dari === "selisih") selisih += c.nominal;
    if (c.ke === "selisih") selisih -= c.nominal;
  }
  return selisih;
}

export function diambilPribadi(catatan, rentang) {
  return dalamRentang(catatan, rentang)
    .filter((c) => c.dari === "laci" && c.ke === "pemilik")
    .reduce((n, c) => n + c.nominal, 0);
}

// Barang yang terjual, dikelompokkan: [{ barang_id, nama, jumlah, untung }]
function penjualanBarang(catatan, rentang) {
  const hasil = new Map();
  for (const c of dalamRentang(catatan, rentang)) {
    if (c.dari !== "pembeli") continue;
    for (const b of c.item || []) {
      const kunci = b.barang_id || b.nama;
      const baris = hasil.get(kunci) || { barang_id: b.barang_id, nama: b.nama, jumlah: 0, untung: 0 };
      baris.jumlah += b.jumlah;
      baris.untung += b.jumlah * (b.harga - (b.modal || 0));
      hasil.set(kunci, baris);
    }
  }
  return [...hasil.values()];
}

const terbesar = (daftar, nilai) => daftar.reduce((a, b) => (a === null || nilai(b) > nilai(a) ? b : a), null);

export const palingLaku = (catatan, rentang) => terbesar(penjualanBarang(catatan, rentang), (b) => b.jumlah);
export const palingUntung = (catatan, rentang) => terbesar(penjualanBarang(catatan, rentang), (b) => b.untung);

// ---------- Ringkasan laporan ----------

export function ringkasanHari(catatan, tanggal) {
  const rentang = { dari: tanggal, sampai: tanggal };
  return {
    tanggal,
    ...rincianUntung(catatan, rentang),
    ...arusLaci(catatan, rentang),
    laciPagi: isiTempat(sampaiTanggal(catatan, geserTanggal(tanggal, -1)), "laci"),
    laciAkhir: isiTempat(sampaiTanggal(catatan, tanggal), "laci"),
    terakhir: dalamRentang(catatan, rentang).sort((a, b) => b.waktu - a.waktu),
  };
}

const NAMA_HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

// Hari yang belum terjadi punya untung null, supaya grafiknya kosong
export function ringkasanMinggu(catatan, tanggal, kini = hariIni()) {
  const dari = awalMinggu(tanggal);
  const sampai = geserTanggal(dari, 6);
  const perHari = NAMA_HARI.map((nama, i) => {
    const t = geserTanggal(dari, i);
    return { tanggal: t, nama, untung: t > kini ? null : untung(catatan, { dari: t, sampai: t }) };
  });
  return {
    dari,
    sampai,
    ...rincianUntung(catatan, { dari, sampai }),
    ...arusLaci(catatan, { dari, sampai }),
    perHari,
    terbaik: terbesar(perHari.filter((h) => h.untung !== null), (h) => h.untung),
    laciAwal: isiTempat(sampaiTanggal(catatan, geserTanggal(dari, -1)), "laci"),
    laciAkhir: isiTempat(sampaiTanggal(catatan, sampai), "laci"),
    bonAwal: isiTempat(sampaiTanggal(catatan, geserTanggal(dari, -1)), "bon"),
    bonAkhir: isiTempat(sampaiTanggal(catatan, sampai), "bon"),
  };
}

// Sebulan dibagi empat: 1–7, 8–14, 15–21, 22–akhir bulan
function mingguDalamBulan(tanggal) {
  const dari = awalBulan(tanggal);
  const akhir = akhirBulan(tanggal);
  return [
    { label: "1–7", dari, sampai: geserTanggal(dari, 6) },
    { label: "8–14", dari: geserTanggal(dari, 7), sampai: geserTanggal(dari, 13) },
    { label: "15–21", dari: geserTanggal(dari, 14), sampai: geserTanggal(dari, 20) },
    { label: `22–${Number(akhir.slice(8))}`, dari: geserTanggal(dari, 21), sampai: akhir },
  ];
}

export function ringkasanBulan(catatan, tanggal, kini = hariIni()) {
  const dari = awalBulan(tanggal);
  const sampai = akhirBulan(tanggal);
  const rentang = { dari, sampai };
  const rincian = rincianUntung(catatan, rentang);
  const awalLalu = geserBulan(dari, -1);
  const untungLalu = untung(catatan, { dari: awalLalu, sampai: akhirBulan(awalLalu) });
  const perMinggu = mingguDalamBulan(dari).map((m) => ({ ...m, untung: m.dari > kini ? null : untung(catatan, m) }));
  return {
    dari,
    sampai,
    ...rincian,
    untungBulanLalu: untungLalu,
    // Persen hanya berarti kalau bulan lalu untung
    persenDariBulanLalu: untungLalu > 0 ? Math.round(((rincian.untung - untungLalu) / untungLalu) * 100) : null,
    perMinggu,
    terbaik: terbesar(perMinggu.filter((m) => m.untung !== null), (m) => m.untung),
    palingLaku: palingLaku(catatan, rentang),
    palingUntung: palingUntung(catatan, rentang),
    diambilPribadi: diambilPribadi(catatan, rentang),
    selisihLaci: selisihLaci(catatan, rentang),
    bonAwal: isiTempat(sampaiTanggal(catatan, geserTanggal(dari, -1)), "bon"),
    bonAkhir: isiTempat(sampaiTanggal(catatan, sampai), "bon"),
  };
}

// ---------- Menghapus catatan ----------

// Angka yang sudah minus (dua HP menjual barang yang sama saat offline) tetap boleh diperbaiki:
// yang ditolak hanya penghapusan yang membuatnya minus atau makin minus.
const makinMinus = (baru = 0, lama = 0) => baru < 0 && baru < lama;

// namaPelanggan = fungsi id -> nama, untuk kalimat alasannya
export function bolehDihapus(c, semuaCatatan, namaPelanggan = () => "pelanggan") {
  const sisa = semuaCatatan.filter((x) => x.id !== c.id);

  const stokKini = semuaStok(semuaCatatan);
  const stokSisa = semuaStok(sisa);
  for (const b of c.item || []) {
    if (b.barang_id && makinMinus(stokSisa.get(b.barang_id), stokKini.get(b.barang_id))) {
      return { boleh: false, alasan: `Stok ${b.nama} akan jadi minus kalau catatan ini dihapus. Kalau jumlah di rak memang beda, pakai Koreksi stok.` };
    }
  }

  if (c.pelanggan_id && makinMinus(semuaBon(sisa).get(c.pelanggan_id), semuaBon(semuaCatatan).get(c.pelanggan_id))) {
    return { boleh: false, alasan: `Bon ${namaPelanggan(c.pelanggan_id)} akan jadi minus kalau catatan ini dihapus. Hapus dulu catatan Terima bon-nya.` };
  }
  return { boleh: true };
}

// Belanja mengubah harga beli barang, jadi saat dihapus efek itu juga harus dibatalkan.
// Item belanja menyimpan harga beli sebelum belanja itu di kolom `modal`, sehingga membentuk rantai:
// - Ada belanja lebih baru: harga beli tetap, belanja itu mewarisi `modal` dari yang dihapus.
// - Ini belanja terbaru dan harga beli belum diubah tangan: harga beli kembali ke `modal`.
export function hargaBeliSetelahHapus(c, semuaCatatan, hargaBeliKini) {
  const b = c.item?.[0];
  if (c.ke !== "agen" || !b || b.modal === undefined || b.modal === null) return {};
  const berikut = semuaCatatan
    .filter((x) => masihAda(x) && x.id !== c.id && x.ke === "agen" && x.item?.[0]?.barang_id === b.barang_id && x.waktu > c.waktu)
    .sort((x, y) => x.waktu - y.waktu)[0];
  if (berikut) {
    if (berikut.item[0].modal !== b.harga) return {}; // harga beli sempat diubah tangan di antaranya
    return { belanjaBerikut: { ...berikut, item: [{ ...berikut.item[0], modal: b.modal }] } };
  }
  return hargaBeliKini === b.harga ? { hargaBeli: b.modal } : {};
}

// ---------- Belanja melebihi laci ----------

// Isi laci tidak boleh minus. Kalau total lebih besar dari isi laci, kekurangannya dicatat
// sebagai uang pribadi masuk ke laci dulu, baru uangnya keluar. `tujuan` berisi kolom catatan keluar.
export function catatanBelanja(total, isiLaci, tujuan = { ke: "agen" }) {
  const keluar = { dari: "laci", nominal: total, ...tujuan };
  const kekurangan = total - Math.max(0, isiLaci);
  if (kekurangan <= 0) return [keluar];
  return [{ dari: "pemilik", ke: "laci", nominal: kekurangan, keterangan: "Uang pribadi untuk belanja" }, keluar];
}
