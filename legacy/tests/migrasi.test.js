import { test } from "node:test";
import assert from "node:assert/strict";
import { dariV1, dariV2 } from "../src/data/migrasi.js";
import { pakaiVersiServer, siapKirim } from "../src/data/sync.js";
import { bacaIsiCadangan } from "../src/data/cadangan.js";
import { hitungUang, hitungStok, hitungUtang, hitungUntung } from "../src/data/hitung.js";
import { geserTanggal, awalMinggu, akhirBulan, geserBulan } from "../src/lib/tanggal.js";
import { nomorWhatsApp } from "../src/lib/format.js";

// ---------- Versi 1 ----------
const t0 = new Date(2026, 9, 29, 9, 0).getTime();
const v1 = {
  barang: [{ id: 1, nama: "Minyak goreng", stok: 8, harga: 18000, hargaBeli: 15000 }],
  transaksi: [
    { id: t0 + 1, tipe: "masuk", nominal: 36000, catatan: "Jual 2 Minyak goreng", tanggal: "2026-10-29", dibuat: t0 + 1, barangId: 1, jumlah: 2, modal: 30000 },
    { id: t0 + 2, tipe: "keluar", nominal: 5000, catatan: "plastik", tanggal: "2026-10-29", dibuat: t0 + 2 },
    { id: t0 + 3, tipe: "masuk", nominal: 10000, catatan: "Bayar kasbon: Bu Sari", tanggal: "2026-10-29", dibuat: t0 + 3 },
  ],
  kasbon: [{ id: 9, nama: "Bu Sari", mutasi: [{ tipe: "utang", nominal: 30000, catatan: "beras", dibuat: t0 - 1000 }, { tipe: "bayar", nominal: 10000, dibuat: t0 + 3 }] }],
};

test("v1: angka sama persis dengan versi lama", () => {
  const h = dariV1(v1);
  assert.equal(hitungStok(h.catatan).get(h.barang[0].id), 8);
  assert.deepEqual(hitungUang(h.catatan), { masuk: 46000, keluar: 5000, selisih: 41000 });
  assert.equal(hitungUtang(h.catatan).get(h.pelanggan[0].id), 20000);
  assert.equal(hitungUntung(h.catatan), 6000);
});

test("v1: bayar kasbon tidak dihitung dua kali", () => {
  const h = dariV1(v1);
  assert.equal(h.catatan.filter((c) => c.jenis === "bayar").length, 1);
  assert.equal(h.catatan.filter((c) => c.keterangan === "Bayar kasbon: Bu Sari").length, 0);
});

// ---------- Versi 2 ----------
const v2 = {
  barang: [{ id: "gula", nama: "Gula", harga_jual: 17000, harga_beli: 15000 }],
  pelanggan: [{ id: "sari", nama: "Bu Sari" }, { id: "sri", nama: "bu sri", deleted: true }],
  stok_mutasi: [
    { id: "m1", barang_id: "gula", jumlah: 10, alasan: "awal", tanggal: "2026-10-30", created_at: 1 },
    { id: "m2", barang_id: "gula", jumlah: -2, alasan: "jual", ref_id: "t1", tanggal: "2026-10-30", created_at: 2 },
    { id: "m3", barang_id: "gula", jumlah: -1, alasan: "kasbon", ref_id: "k1", tanggal: "2026-10-30", created_at: 3 },
    { id: "m4", barang_id: "gula", jumlah: 1, alasan: "tambah", tanggal: "2026-10-30", created_at: 4 },
  ],
  transaksi: [
    { id: "t1", tipe: "masuk", nominal: 34000, sumber: "jual", barang_id: "gula", jumlah: 2, modal: 30000, tanggal: "2026-10-30", created_at: 2 },
    { id: "t2", tipe: "masuk", nominal: 10000, sumber: "bayar_kasbon", kasbon_id: "k2", pelanggan_id: "sari", tanggal: "2026-10-30", created_at: 5 },
    { id: "t3", tipe: "keluar", nominal: 50000, sumber: "pinjam_kasbon", kasbon_id: "k3", pelanggan_id: "sari", tanggal: "2026-10-30", created_at: 6 },
    { id: "t4", tipe: "keluar", nominal: 3000, sumber: "manual", catatan: "plastik", tanggal: "2026-10-30", created_at: 7 },
    { id: "t5", tipe: "masuk", nominal: 999, sumber: "manual", tanggal: "2026-10-30", created_at: 8, deleted: true },
  ],
  kasbon: [
    { id: "k1", pelanggan_id: "sari", tipe: "utang", jenis: "barang", barang_id: "gula", jumlah: 1, nominal: 17000, modal: 15000, tanggal: "2026-10-30", created_at: 3 },
    { id: "k2", pelanggan_id: "sari", tipe: "bayar", nominal: 10000, transaksi_id: "t2", tanggal: "2026-10-30", created_at: 5 },
    { id: "k3", pelanggan_id: "sari", tipe: "utang", jenis: "tunai", nominal: 50000, transaksi_id: "t3", tanggal: "2026-10-30", created_at: 6 },
    { id: "k4", pelanggan_id: "sari", tipe: "utang", nominal: 8000, catatan: "gorengan", tanggal: "2026-10-30", created_at: 9 },
  ],
};

test("v2: setiap kejadian jadi satu catatan dengan id yang sama", () => {
  const c = dariV2(v2);
  assert.deepEqual(c.map((x) => x.id).sort(), ["k1", "k2", "k3", "k4", "m1", "m4", "t1", "t4"]);
});

test("v2: stok, uang, utang, untung tetap sama", () => {
  const c = dariV2(v2);
  assert.equal(hitungStok(c).get("gula"), 8); // 10 - 2 - 1 + 1
  assert.deepEqual(hitungUang(c), { masuk: 34000 + 10000, keluar: 50000 + 3000, selisih: -9000 });
  assert.equal(hitungUtang(c).get("sari"), 17000 + 50000 + 8000 - 10000);
  assert.equal(hitungUntung(c), 2 * 2000 + 2000);
});

// ---------- Sinkron dan cadangan ----------
test("sinkron: versi terbaru menang, perubahan yang belum terkirim tidak tertimpa", () => {
  assert.equal(pakaiVersiServer(undefined, { updated_at: 1 }), true);
  assert.equal(pakaiVersiServer({ updated_at: 5, dirty: 0 }, { updated_at: 9 }), true);
  assert.equal(pakaiVersiServer({ updated_at: 9, dirty: 0 }, { updated_at: 5 }), false);
  assert.equal(pakaiVersiServer({ updated_at: 9, dirty: 1 }, { updated_at: 9 }), false);
  assert.deepEqual(siapKirim({ id: "x", dirty: 1 }), { id: "x" });
});

test("cadangan: file v1, v2, v3 diterima; file asing ditolak", () => {
  assert.equal(bacaIsiCadangan({ aplikasi: "buku-warung", versi: 1, ...v1 }).data.barang.length, 1);
  assert.equal(bacaIsiCadangan({ aplikasi: "buku-warung", versi: 2, data: v2 }).data.catatan.length, 8);
  const v3 = { aplikasi: "buku-warung", versi: 3, data: { barang: [], pelanggan: [], catatan: [{ id: "a", jenis: "jual", nominal: 1, tanggal: "2026-10-30", barang: [] }] } };
  assert.equal(bacaIsiCadangan(v3).data.catatan.length, 1);
  assert.equal(bacaIsiCadangan({ aplikasi: "lain" }), null);
  assert.equal(bacaIsiCadangan({ aplikasi: "buku-warung", versi: 3, data: { barang: [] } }), null);
});

test("tanggal lokal dan nomor WhatsApp", () => {
  assert.equal(geserTanggal("2026-03-01", -1), "2026-02-28");
  assert.equal(awalMinggu("2026-11-01"), "2026-10-26");
  assert.equal(akhirBulan("2026-02-10"), "2026-02-28");
  assert.equal(geserBulan("2026-01-31", -1), "2025-12-01");
  assert.equal(nomorWhatsApp("0812-3456"), "628123456");
});
