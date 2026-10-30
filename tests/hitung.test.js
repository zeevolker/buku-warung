import { test } from "node:test";
import assert from "node:assert/strict";
import { hitungStok, hitungKas, hitungSisaKasbon, hitungUntungBarang, hitungArusKasbon, dalamRentang } from "../src/data/hitung.js";

test("stok = jumlah mutasi, yang terhapus diabaikan", () => {
  const stok = hitungStok([
    { barang_id: "a", jumlah: 10 },
    { barang_id: "a", jumlah: -2 },
    { barang_id: "a", jumlah: -3, deleted: true },
    { barang_id: "b", jumlah: 4 },
  ]);
  assert.equal(stok.get("a"), 8);
  assert.equal(stok.get("b"), 4);
});

test("dua HP menjual barang yang sama saat offline: stok tetap benar setelah digabung", () => {
  const awal = { id: "m0", barang_id: "a", jumlah: 10 };
  const hpA = [awal, { id: "m1", barang_id: "a", jumlah: -2 }];
  const hpB = [awal, { id: "m2", barang_id: "a", jumlah: -1 }];
  const gabung = [...new Map([...hpA, ...hpB].map((m) => [m.id, m])).values()];
  assert.equal(hitungStok(gabung).get("a"), 7);
});

test("total kas = masuk - keluar", () => {
  const kas = hitungKas([
    { tipe: "masuk", nominal: 50000 },
    { tipe: "keluar", nominal: 20000 },
    { tipe: "masuk", nominal: 9999, deleted: true },
  ]);
  assert.deepEqual(kas, { masuk: 50000, keluar: 20000, total: 30000 });
});

test("sisa kasbon per pelanggan", () => {
  const sisa = hitungSisaKasbon([
    { pelanggan_id: "p", tipe: "utang", nominal: 30000 },
    { pelanggan_id: "p", tipe: "bayar", nominal: 10000 },
    { pelanggan_id: "q", tipe: "utang", nominal: 5000 },
  ]);
  assert.equal(sisa.get("p"), 20000);
  assert.equal(sisa.get("q"), 5000);
});

test("untung barang: tunai dan kasbon dihitung, yang tanpa modal tidak", () => {
  const u = hitungUntungBarang(
    [
      { sumber: "jual", nominal: 36000, modal: 31000 },
      { sumber: "jual", nominal: 5000, modal: null },
      { sumber: "manual", nominal: 99000, modal: null },
    ],
    [
      { tipe: "utang", barang_id: "a", nominal: 18000, modal: 15500 },
      { tipe: "utang", barang_id: null, nominal: 20000, modal: null },
    ]
  );
  assert.deepEqual(u, { untung: 7500, jumlah: 2 });
});

test("arus kasbon dan saring rentang tanggal", () => {
  const k = [
    { tipe: "utang", nominal: 10000, tanggal: "2026-10-28" },
    { tipe: "bayar", nominal: 4000, tanggal: "2026-10-30" },
    { tipe: "utang", nominal: 7000, tanggal: "2026-09-30" },
  ];
  assert.deepEqual(hitungArusKasbon(dalamRentang(k, "2026-10-01", "2026-10-30")), { utangBaru: 10000, dibayar: 4000 });
});
