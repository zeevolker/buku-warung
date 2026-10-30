import { test } from "node:test";
import assert from "node:assert/strict";
import { hitungUang, hitungStok, hitungUtang, hitungUntung, hitungArusUtang, dalamRentang } from "../src/data/hitung.js";

// Satu hari di warung, dalam bentuk catatan
const hari = [
  { jenis: "stok", tanggal: "2026-10-30", nominal: 0, barang: [{ barang_id: "telur", jumlah: 40 }] },
  { jenis: "jual", dibayar: "sekarang", tanggal: "2026-10-30", nominal: 36000, barang: [{ barang_id: "minyak", jumlah: 2, harga: 18000, modal: 15500 }] },
  { jenis: "jual", dibayar: "nanti", pelanggan_id: "sari", tanggal: "2026-10-30", nominal: 17000, barang: [{ barang_id: "gula", jumlah: 1, harga: 17000, modal: 15000 }] },
  { jenis: "jual", dibayar: "sekarang", tanggal: "2026-10-30", nominal: 5000, barang: [], keterangan: "gorengan" },
  { jenis: "keluar", untuk: "belanja", tanggal: "2026-10-30", nominal: 48000, barang: [{ barang_id: "telur", jumlah: 30, harga: 1600 }] },
  { jenis: "keluar", untuk: "pinjaman", pelanggan_id: "budi", tanggal: "2026-10-30", nominal: 20000, barang: [] },
  { jenis: "keluar", untuk: "biaya", tanggal: "2026-10-30", nominal: 3000, barang: [] },
  { jenis: "bayar", pelanggan_id: "budi", tanggal: "2026-10-30", nominal: 5000, barang: [] },
  { jenis: "jual", dibayar: "sekarang", tanggal: "2026-10-30", nominal: 99000, barang: [], deleted: true },
];

test("uang di laci: jual tunai + bayar - semua uang keluar", () => {
  assert.deepEqual(hitungUang(hari), { masuk: 36000 + 5000 + 5000, keluar: 48000 + 20000 + 3000, selisih: 46000 - 71000 });
});

test("kasbon barang tidak menambah uang, tapi menambah utang", () => {
  const utang = hitungUtang(hari);
  assert.equal(utang.get("sari"), 17000);
  assert.equal(utang.get("budi"), 15000); // pinjam 20.000, bayar 5.000
});

test("stok: jual mengurangi, belanja dan koreksi menambah", () => {
  const stok = hitungStok(hari);
  assert.equal(stok.get("telur"), 70);
  assert.equal(stok.get("minyak"), -2); // tanpa stok awal, berarti minus: aksi.js yang mencegahnya
  assert.equal(stok.get("gula"), -1);
});

test("untung hanya dari barang yang modalnya diketahui", () => {
  assert.equal(hitungUntung(hari), 2 * 2500 + 2000);
});

test("arus utang dalam periode", () => {
  assert.deepEqual(hitungArusUtang(hari), { baru: 37000, dibayar: 5000 });
});

test("menghapus satu catatan otomatis membatalkan semua efeknya", () => {
  const tanpaBelanja = hari.filter((c) => c.untuk !== "belanja");
  assert.equal(hitungStok(tanpaBelanja).get("telur"), 40);
  assert.equal(hitungUang(tanpaBelanja).keluar, 23000);
});

test("dua HP mencatat bersamaan saat offline: hasil gabungan tetap benar", () => {
  const awal = { id: "a", jenis: "stok", barang: [{ barang_id: "telur", jumlah: 30 }] };
  const hpA = [awal, { id: "b", jenis: "jual", dibayar: "sekarang", nominal: 8000, barang: [{ barang_id: "telur", jumlah: 4, harga: 2000 }] }];
  const hpB = [awal, { id: "c", jenis: "jual", dibayar: "sekarang", nominal: 12000, barang: [{ barang_id: "telur", jumlah: 6, harga: 2000 }] }];
  const gabung = [...new Map([...hpA, ...hpB].map((c) => [c.id, c])).values()];
  assert.equal(hitungStok(gabung).get("telur"), 20);
  assert.equal(hitungUang(gabung).masuk, 20000);
});

test("saring rentang tanggal", () => {
  const c = [{ tanggal: "2026-10-01" }, { tanggal: "2026-10-15" }, { tanggal: "2026-11-01" }];
  assert.equal(dalamRentang(c, "2026-10-01", "2026-10-31").length, 2);
});
