import { test } from "node:test";
import assert from "node:assert/strict";
import { aturUlangModal } from "../src/data/hitung.js";

const belanja = (id, created_at, harga, modal_lama) => ({
  id,
  created_at,
  jenis: "keluar",
  untuk: "belanja",
  barang: [{ barang_id: "gula", jumlah: 1, harga, modal_lama }],
});

test("hapus belanja terbaru: modal kembali ke sebelumnya", () => {
  const a = belanja("a", 1, 50000, 15000);
  assert.deepEqual(aturUlangModal(a, [a], 50000), { modal: 15000 });
});

test("modal sebelumnya 0 tetap dikembalikan", () => {
  const a = belanja("a", 1, 16000, 0);
  assert.deepEqual(aturUlangModal(a, [a], 16000), { modal: 0 });
});

test("modal sudah diubah tangan setelah belanja: tidak disentuh", () => {
  const a = belanja("a", 1, 16000, 15000);
  assert.deepEqual(aturUlangModal(a, [a], 17000), {});
});

test("hapus belanja lama: modal tetap, belanja berikut mewarisi modal_lama", () => {
  const a = belanja("a", 1, 20000, 15000);
  const b = belanja("b", 2, 30000, 20000);
  const { modal, belanjaBerikut } = aturUlangModal(a, [a, b], 30000);
  assert.equal(modal, undefined);
  assert.equal(belanjaBerikut.id, "b");
  assert.equal(belanjaBerikut.barang[0].modal_lama, 15000);
  // Lalu belanja b dihapus: modal kembali ke sebelum kedua belanja
  assert.deepEqual(aturUlangModal(belanjaBerikut, [belanjaBerikut], 30000), { modal: 15000 });
});

test("modal diubah tangan di antara dua belanja: modal_lama belanja berikut dibiarkan", () => {
  const a = belanja("a", 1, 20000, 15000);
  const b = belanja("b", 2, 30000, 25000);
  assert.deepEqual(aturUlangModal(a, [a, b], 30000), {});
  assert.deepEqual(aturUlangModal(b, [b], 30000), { modal: 25000 });
});

test("belanja barang lain dan belanja yang sudah dihapus diabaikan", () => {
  const a = belanja("a", 1, 20000, 15000);
  const lain = { ...belanja("l", 2, 9000, 8000), barang: [{ barang_id: "kopi", jumlah: 1, harga: 9000, modal_lama: 8000 }] };
  const terhapus = { ...belanja("t", 3, 30000, 20000), deleted: true };
  assert.deepEqual(aturUlangModal(a, [a, lain, terhapus], 20000), { modal: 15000 });
});

test("belanja lama tanpa modal_lama: tidak bisa dikembalikan", () => {
  const a = belanja("a", 1, 20000, undefined);
  assert.deepEqual(aturUlangModal(a, [a], 20000), {});
});
