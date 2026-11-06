// aksi.js: semua yang bisa dilakukan pengguna. Layar memanggil fungsi di sini,
// bukan menulis ke database sendiri.
//
// Setiap kejadian hanya MENAMBAH catatan. Tidak ada angka stok, bon, atau laci yang disimpan.
// Setiap fungsi mengembalikan { galat: "pesan" } kalau ditolak, atau data kalau berhasil.

import { db, barisBaru, barisDiubah, semuaAda } from "./db.js";
import { isiTempat, semuaStok, bolehDihapus, hargaBeliSetelahHapus, catatanBelanja } from "./hitung.js";
import { tandaiBerubah } from "./ringkasan.js";
import { formatRupiah, kunciNama } from "./format.js";

const tolak = (galat) => ({ galat });
const BATAS_HAMPIR_HABIS = 5;

// Semua aksi berjalan dalam satu transaksi: tersimpan semua atau tidak sama sekali
const transaksi = (fungsi) => db.transaction("rw", db.barang, db.pelanggan, db.catatan, db.meta, fungsi);

const catatanAda = () => semuaAda(db.catatan);
const isiLaci = async () => isiTempat(await catatanAda(), "laci");

// Tulis beberapa catatan berurutan. Waktunya dibedakan 1 milidetik supaya urutannya tetap.
async function tulisCatatan(daftar) {
  const waktu = Date.now();
  const baris = daftar.map((isi, i) =>
    barisBaru({ waktu: waktu + i, pelanggan_id: null, item: [], keterangan: "", ...isi })
  );
  await db.catatan.bulkAdd(baris);
  await tandaiBerubah(waktu);
  return baris;
}

const hanyaSatu = async (isi) => ({ catatan: (await tulisCatatan([isi]))[0] });

// ---------- Jual ----------
// pilihan = [{ barang_id, jumlah }]; lainnya = nominal jualan tanpa stok (gorengan, pulsa)
// modalLainnya = modal jualan Lainnya, boleh kosong. Kalau kosong, dihitung untung penuh.
// bayar = "tunai" | "bon"
export function jual({ pilihan = [], lainnya = 0, modalLainnya = null, keterangan = "", bayar = "tunai", pelangganId = null }) {
  return transaksi(async () => {
    const stok = semuaStok(await catatanAda());
    const item = [];
    for (const p of pilihan.filter((p) => p.jumlah > 0)) {
      const b = await db.barang.get(p.barang_id);
      if (!b || b.deleted) return tolak("Barang tidak ditemukan.");
      if (!b.harga_jual) return tolak(`Harga jual ${b.nama} belum diisi.`);
      const ada = stok.get(b.id) || 0;
      if (p.jumlah > ada) return tolak(`Stok ${b.nama} tinggal ${ada}.`);
      // null berarti modalnya tidak diketahui (barang lama yang harga belinya belum diisi)
      item.push({ barang_id: b.id, nama: b.nama, jumlah: p.jumlah, harga: b.harga_jual, modal: b.harga_beli || null });
    }
    const nominal = item.reduce((n, b) => n + b.harga * b.jumlah, 0) + (lainnya || 0);
    if (nominal <= 0) return tolak("Pilih barang atau isi nominal dulu.");

    // Lainnya yang modalnya diisi disimpan sebagai item tanpa barang_id: stok tidak berubah
    const adaModalLainnya = modalLainnya !== null && modalLainnya !== undefined && modalLainnya !== "";
    if (adaModalLainnya && !(modalLainnya >= 0)) return tolak("Modal tidak boleh minus.");
    if (adaModalLainnya && lainnya > 0) {
      item.push({ barang_id: null, nama: keterangan.trim() || "Lainnya", jumlah: 1, harga: lainnya, modal: modalLainnya });
    }

    if (bayar === "bon") {
      const p = pelangganId && (await db.pelanggan.get(pelangganId));
      if (!p || p.deleted) return tolak("Pilih pelanggan yang ngebon.");
    }
    return hanyaSatu({
      dari: "pembeli",
      ke: bayar === "bon" ? "bon" : "laci",
      pelanggan_id: bayar === "bon" ? pelangganId : null,
      nominal,
      item,
      keterangan: keterangan.trim(),
    });
  });
}

// ---------- Belanja ----------
// Uang keluar dari laci. Kalau melebihi isi laci, mengembalikan { perluPribadi: { isiLaci, kekurangan } }
// tanpa menyimpan apa pun. Setelah pengguna setuju, panggil lagi dengan pakaiPribadi: true.
async function keluarDariLaci(total, tujuan, pakaiPribadi) {
  const laci = await isiLaci();
  const kekurangan = total - Math.max(0, laci);
  if (kekurangan > 0 && !pakaiPribadi) return { perluPribadi: { isiLaci: Math.max(0, laci), kekurangan } };
  return { catatan: await tulisCatatan(catatanBelanja(total, laci, tujuan)) };
}

// jenis = "stok" | "biaya" | "pinjaman"
export function belanja({ jenis, total, barangId, jumlah, pelangganId, keterangan = "", pakaiPribadi = false }) {
  return transaksi(async () => {
    if (!(total > 0)) return tolak("Isi jumlah uangnya dulu.");
    if (jenis === "biaya") return keluarDariLaci(total, { ke: "biaya", keterangan: keterangan.trim() }, pakaiPribadi);

    if (jenis === "pinjaman") {
      const p = pelangganId && (await db.pelanggan.get(pelangganId));
      if (!p || p.deleted) return tolak("Pilih pelanggan yang pinjam.");
      return keluarDariLaci(total, { ke: "bon", pelanggan_id: p.id, keterangan: keterangan.trim() }, pakaiPribadi);
    }

    const b = barangId && (await db.barang.get(barangId));
    if (!b || b.deleted) return tolak("Pilih barang yang dibeli.");
    if (!Number.isInteger(jumlah) || jumlah <= 0) return tolak("Isi jumlah barang yang dibeli.");
    const harga = Math.round(total / jumlah);
    // modal di sini = harga beli SEBELUM belanja ini, supaya bisa dikembalikan kalau catatannya dihapus
    const item = [{ barang_id: b.id, nama: b.nama, jumlah, harga, modal: b.harga_beli || 0 }];
    const hasil = await keluarDariLaci(total, { ke: "agen", item, keterangan: keterangan.trim() }, pakaiPribadi);
    // Pakai harga beli terakhir
    if (hasil.catatan && b.harga_beli !== harga) await db.barang.put(barisDiubah(b, { harga_beli: harga }));
    return hasil;
  });
}

// ---------- Bon dan laci ----------
export function terimaBon({ pelangganId, nominal }) {
  return transaksi(async () => {
    const p = pelangganId && (await db.pelanggan.get(pelangganId));
    if (!p || p.deleted) return tolak("Pilih pelanggan yang membayar.");
    if (!(nominal > 0)) return tolak("Isi jumlah yang dibayar.");
    const bon = isiTempat(await catatanAda(), "bon", p.id);
    if (nominal > bon) return tolak(`Bon ${p.nama} tinggal ${formatRupiah(bon)}.`);
    return hanyaSatu({ dari: "bon", ke: "laci", pelanggan_id: p.id, nominal });
  });
}

export function uangAwal(nominal) {
  return transaksi(async () => {
    if (!(nominal > 0)) return tolak("Isi jumlah uangnya dulu.");
    return hanyaSatu({ dari: "pemilik", ke: "laci", nominal });
  });
}

export function ambilPribadi(nominal) {
  return transaksi(async () => {
    if (!(nominal > 0)) return tolak("Isi jumlah uangnya dulu.");
    const laci = await isiLaci();
    if (nominal > laci) return tolak(`Laci cuma ${formatRupiah(Math.max(0, laci))}.`);
    return hanyaSatu({ dari: "laci", ke: "pemilik", nominal });
  });
}

// Uang fisik berbeda dari catatan: selisihnya dicatat, isi laci jadi sama dengan uang fisik
export function hitungUlangLaci(uangSebenarnya) {
  return transaksi(async () => {
    if (!(uangSebenarnya >= 0)) return tolak("Isi jumlah uang di laci.");
    const selisih = uangSebenarnya - (await isiLaci());
    if (selisih === 0) return {};
    return hanyaSatu(selisih > 0 ? { dari: "selisih", ke: "laci", nominal: selisih } : { dari: "laci", ke: "selisih", nominal: -selisih });
  });
}

// ---------- Barang ----------
// asal = "rak" (sudah ada di rak: pemilik → stok) | "dibeli" (baru dibeli: laci → agen)
export function tambahBarang({ nama, harga_jual = 0, harga_beli = 0, stok = 0, batas_hampir_habis = BATAS_HAMPIR_HABIS, asal = "rak", pakaiPribadi = false }) {
  return transaksi(async () => {
    nama = (nama || "").trim();
    if (!nama) return tolak("Tulis nama barangnya.");
    const ada = await semuaAda(db.barang);
    if (ada.some((b) => kunciNama(b.nama) === kunciNama(nama))) return tolak(`"${nama}" sudah ada di daftar.`);
    if (!(harga_beli > 0)) return tolak("Isi harga belinya dulu.");

    const barang = barisBaru({ nama, harga_jual, harga_beli, batas_hampir_habis });
    if (!(stok > 0)) {
      await db.barang.add(barang);
      return { barang };
    }
    const item = [{ barang_id: barang.id, nama, jumlah: stok, harga: harga_beli, modal: harga_beli }];
    const nominal = stok * harga_beli;
    if (asal === "dibeli") {
      const hasil = await keluarDariLaci(nominal, { ke: "agen", item }, pakaiPribadi);
      if (hasil.perluPribadi) return hasil;
      await db.barang.add(barang);
      return { barang, ...hasil };
    }
    await db.barang.add(barang);
    return { barang, ...(await hanyaSatu({ dari: "pemilik", ke: "stok", nominal, item })) };
  });
}

// Pengguna mengisi jumlah yang sebenarnya di rak. Barang berkurang menjadi biaya
// (nilai = jumlah × harga beli). Barang lebih banyak dari catatan dianggap tambahan dari pemilik.
export function koreksiStok(barangId, jumlahSebenarnya, alasan = "") {
  return transaksi(async () => {
    const b = await db.barang.get(barangId);
    if (!b || b.deleted) return tolak("Barang tidak ditemukan.");
    if (!Number.isInteger(jumlahSebenarnya) || jumlahSebenarnya < 0) return tolak("Isi jumlah yang sebenarnya.");
    const selisih = jumlahSebenarnya - (semuaStok(await catatanAda()).get(b.id) || 0);
    if (selisih === 0) return {};
    const jumlah = Math.abs(selisih);
    const harga = b.harga_beli || 0;
    const tempat = selisih < 0 ? { dari: "stok", ke: "biaya" } : { dari: "pemilik", ke: "stok" };
    return hanyaSatu({ ...tempat, nominal: jumlah * harga, item: [{ barang_id: b.id, nama: b.nama, jumlah, harga, modal: harga }], keterangan: alasan.trim() });
  });
}

// ---------- Pelanggan ----------
export function tambahPelanggan({ nama, no_wa = "", bonLama = 0 }) {
  return transaksi(async () => {
    nama = (nama || "").trim().replace(/\s+/g, " ");
    if (!nama) return tolak("Tulis nama pelanggannya.");
    const ada = await semuaAda(db.pelanggan);
    if (ada.some((p) => kunciNama(p.nama) === kunciNama(nama))) return tolak(`${nama} sudah ada.`);
    const pelanggan = barisBaru({ nama, no_wa: no_wa.trim() });
    await db.pelanggan.add(pelanggan);
    if (bonLama > 0) await tulisCatatan([{ dari: "pemilik", ke: "bon", pelanggan_id: pelanggan.id, nominal: bonLama, keterangan: "Bon lama" }]);
    return { pelanggan };
  });
}

// Pelanggan dari nama yang diketik di lembar Jual atau Belanja: pakai yang sudah ada, atau buat baru
export async function siapkanPelanggan(nama) {
  const ada = (await semuaAda(db.pelanggan)).find((p) => kunciNama(p.nama) === kunciNama(nama));
  return ada ? { pelanggan: ada } : tambahPelanggan({ nama });
}

// ---------- Menghapus catatan ----------
export function hapusCatatan(id) {
  return transaksi(async () => {
    const c = await db.catatan.get(id);
    if (!c || c.deleted) return {};
    const semua = await catatanAda();
    const pelanggan = new Map((await db.pelanggan.toArray()).map((p) => [p.id, p.nama]));
    const izin = bolehDihapus(c, semua, (idP) => pelanggan.get(idP) || "pelanggan");
    if (!izin.boleh) return tolak(izin.alasan);

    await db.catatan.put(barisDiubah(c, { deleted: true }));
    if (c.ke === "agen" && c.item?.[0]) {
      const b = await db.barang.get(c.item[0].barang_id);
      const { hargaBeli, belanjaBerikut } = hargaBeliSetelahHapus(c, semua, b?.harga_beli);
      if (belanjaBerikut) await db.catatan.put(barisDiubah(belanjaBerikut, {}));
      if (hargaBeli !== undefined && b && !b.deleted) await db.barang.put(barisDiubah(b, { harga_beli: hargaBeli }));
    }
    await tandaiBerubah(c.waktu);
    return {};
  });
}
