import { test } from "node:test";
import assert from "node:assert/strict";
import { ubahDataLama } from "../src/data/migrasi.js";
import { pakaiVersiServer, siapKirim } from "../src/data/sync.js";
import { bacaIsiCadangan } from "../src/data/cadangan.js";
import { hitungStok, hitungKas, hitungSisaKasbon } from "../src/data/hitung.js";
import { geserTanggal, awalMinggu, awalBulan } from "../src/lib/tanggal.js";
import { nomorWhatsApp } from "../src/lib/format.js";

// Data versi 1 seperti yang tersimpan di localStorage
const t0 = new Date(2026, 9, 29, 9, 0).getTime();
const lama = {
  barang: [{ id: 1, nama: "Minyak goreng", stok: 8, harga: 18000, hargaBeli: 15000, diubah: t0 }],
  transaksi: [
    { id: t0 + 1, tipe: "masuk", nominal: 36000, catatan: "Jual 2 Minyak goreng", tanggal: "2026-10-29", dibuat: t0 + 1, barangId: 1, jumlah: 2, modal: 30000 },
    { id: t0 + 2, tipe: "keluar", nominal: 5000, catatan: "plastik", tanggal: "2026-10-29", dibuat: t0 + 2 },
    { id: t0 + 3, tipe: "masuk", nominal: 10000, catatan: "Bayar kasbon: Bu Sari", tanggal: "2026-10-29", dibuat: t0 + 3 },
    { id: 5, tipe: "masuk", nominal: 7000, catatan: "lama tanpa jam", tanggal: "2026-10-20" },
  ],
  kasbon: [
    {
      id: 9,
      nama: "Bu Sari",
      telepon: "0812",
      mutasi: [
        { id: 1, tipe: "utang", nominal: 30000, catatan: "beras", dibuat: t0 - 1000 },
        { id: 2, tipe: "bayar", nominal: 10000, catatan: "", dibuat: t0 + 3 },
      ],
    },
  ],
};

let urut = 0;
const idUji = () => `id-${++urut}`;

test("migrasi: stok akhir, total, dan sisa kasbon sama persis dengan versi lama", () => {
  const h = ubahDataLama(lama, idUji);
  const idMinyak = h.barang[0].id;
  assert.equal(hitungStok(h.stok_mutasi).get(idMinyak), 8);
  assert.deepEqual(hitungKas(h.transaksi), { masuk: 53000, keluar: 5000, total: 48000 });
  assert.equal(hitungSisaKasbon(h.kasbon).get(h.pelanggan[0].id), 20000);
  assert.equal(h.barang[0].harga_beli, 15000);
});

test("migrasi: penjualan lama terhubung ke barang dan mutasi stoknya", () => {
  const h = ubahDataLama(lama, idUji);
  const jual = h.transaksi.find((t) => t.sumber === "jual");
  assert.equal(jual.barang_id, h.barang[0].id);
  const mutasi = h.stok_mutasi.find((m) => m.ref_id === jual.id);
  assert.equal(mutasi.jumlah, -2);
  // Menghapus penjualan lama harus mengembalikan stok: awal = 8 + 2
  assert.equal(h.stok_mutasi.find((m) => m.alasan === "awal").jumlah, 10);
});

test("migrasi: bayar kasbon lama dihubungkan dengan uang masuknya", () => {
  const h = ubahDataLama(lama, idUji);
  const bayar = h.kasbon.find((k) => k.tipe === "bayar");
  const uang = h.transaksi.find((t) => t.sumber === "bayar_kasbon");
  assert.equal(bayar.transaksi_id, uang.id);
  assert.equal(uang.kasbon_id, bayar.id);
  assert.equal(uang.pelanggan_id, h.pelanggan[0].id);
});

test("migrasi: catatan lama tanpa jam tetap punya tanggal", () => {
  const h = ubahDataLama(lama, idUji);
  assert.equal(h.transaksi.find((t) => t.catatan === "lama tanpa jam").tanggal, "2026-10-20");
});

test("sinkron: versi terbaru yang dipakai, perubahan HP yang belum terkirim tidak tertimpa", () => {
  assert.equal(pakaiVersiServer(undefined, { updated_at: 1 }), true);
  assert.equal(pakaiVersiServer({ updated_at: 5, dirty: 0 }, { updated_at: 9 }), true);
  assert.equal(pakaiVersiServer({ updated_at: 9, dirty: 0 }, { updated_at: 5 }), false);
  assert.equal(pakaiVersiServer({ updated_at: 9, dirty: 1 }, { updated_at: 9 }), false);
  assert.equal(pakaiVersiServer({ updated_at: 5, dirty: 1 }, { updated_at: 9 }), true);
  assert.deepEqual(siapKirim({ id: "x", dirty: 1, nama: "a" }), { id: "x", nama: "a" });
});

test("cadangan: file versi 1 diterima dan diubah, file asing ditolak", () => {
  const v1 = bacaIsiCadangan({ aplikasi: "buku-warung", versi: 1, ...lama });
  assert.equal(v1.data.transaksi.length, 4);
  assert.equal(bacaIsiCadangan({ aplikasi: "lain" }), null);
  assert.equal(bacaIsiCadangan({ aplikasi: "buku-warung", versi: 2, data: { barang: [] } }), null);
});

test("tanggal lokal dan nomor WhatsApp", () => {
  assert.equal(geserTanggal("2026-03-01", -1), "2026-02-28");
  assert.equal(geserTanggal("2026-12-31", 1), "2027-01-01");
  assert.equal(awalMinggu("2026-11-01"), "2026-10-26"); // Minggu -> Senin sebelumnya
  assert.equal(awalBulan("2026-10-30"), "2026-10-01");
  assert.equal(nomorWhatsApp("0812-3456"), "628123456");
  assert.equal(nomorWhatsApp("+62 812 3456"), "628123456");
});
