import { beforeEach, describe, test, expect } from "vitest";
import { catatanDariV3, dataDariV3, pindahkanDataHp, pelangganDariV3, barangDariV3 } from "../src/data/migrasi.js";
import { dariV1, dariV2 } from "../src/data/migrasiLama.js";
import { bacaIsiCadangan, buatIsiCadangan, pulihkan } from "../src/data/cadangan.js";
import { db, ambilMeta, semuaAda } from "../src/data/db.js";
import { semuaBon, semuaStok, rincianUntung, isiTempat, tanggalCatatan } from "../src/data/hitung.js";
import { uangAwal, tambahBarang, jual } from "../src/data/aksi.js";
// Pembanding: perhitungan dan migrasi v3 yang asli
import * as v3 from "../legacy/src/data/hitung.js";
import * as migrasiV3 from "../legacy/src/data/migrasi.js";

const jam = (tgl, j = 9) => new Date(2026, 9, tgl, j).getTime();
const barang = [
  { id: "kopi", nama: "Kopi", harga_jual: 2000, harga_beli: 1500, created_at: 1, updated_at: 2, deleted: false, dirty: 0 },
  { id: "gula", nama: "Gula", harga_jual: 17000, harga_beli: 15000, created_at: 1, updated_at: 2, deleted: false, dirty: 1 },
  { id: "lama", nama: "Barang terhapus", harga_jual: 1000, harga_beli: 800, created_at: 1, updated_at: 2, deleted: true, dirty: 0 },
];
const pelanggan = [
  { id: "budi", nama: "Budi", telepon: "0812", created_at: 1, updated_at: 2, deleted: false, dirty: 0 },
  { id: "sari", nama: "Sari", telepon: "", created_at: 1, updated_at: 2, deleted: true, dirty: 0 },
];
const dasar = (id, tgl, isi) => ({ id, tanggal: `2026-10-${tgl}`, created_at: jam(tgl), updated_at: jam(tgl) + 5, deleted: false, nominal: 0, dibayar: null, untuk: null, pelanggan_id: null, barang: [], keterangan: "", ...isi });

const catatan = [
  dasar("awalK", 10, { jenis: "stok", keterangan: "Stok awal", barang: [{ barang_id: "kopi", nama: "Kopi", jumlah: 40 }] }),
  dasar("awalG", 10, { jenis: "stok", keterangan: "Stok awal", barang: [{ barang_id: "gula", nama: "Gula", jumlah: 10 }] }),
  dasar("j1", 11, { jenis: "jual", dibayar: "sekarang", nominal: 4000, barang: [{ barang_id: "kopi", nama: "Kopi", jumlah: 2, harga: 2000, modal: 1500 }] }),
  dasar("j2", 11, { jenis: "jual", dibayar: "nanti", pelanggan_id: "budi", nominal: 17000, barang: [{ barang_id: "gula", nama: "Gula", jumlah: 1, harga: 17000, modal: 15000 }] }),
  dasar("j3", 12, { jenis: "jual", dibayar: "sekarang", nominal: 5000, keterangan: "gorengan" }),
  dasar("j4", 12, { jenis: "jual", dibayar: "sekarang", nominal: 2000, barang: [{ barang_id: "kopi", nama: "Kopi", jumlah: 1, harga: 2000, modal: null }] }),
  dasar("b1", 13, { jenis: "keluar", untuk: "belanja", nominal: 16000, barang: [{ barang_id: "kopi", nama: "Kopi", jumlah: 10, harga: 1600 }] }),
  dasar("b2", 13, { jenis: "keluar", untuk: "biaya", nominal: 3000, keterangan: "plastik" }),
  dasar("b3", 14, { jenis: "keluar", untuk: "pinjaman", pelanggan_id: "budi", nominal: 20000 }),
  dasar("y1", 15, { jenis: "bayar", pelanggan_id: "budi", nominal: 5000 }),
  dasar("k1", 16, { jenis: "stok", keterangan: "Koreksi stok", barang: [{ barang_id: "kopi", nama: "Kopi", jumlah: -3 }] }),
  dasar("k2", 16, { jenis: "stok", keterangan: "Koreksi stok", barang: [{ barang_id: "gula", nama: "Gula", jumlah: 2 }] }),
  dasar("h1", 17, { jenis: "jual", dibayar: "sekarang", nominal: 99000, deleted: true }),
  dasar("h2", 17, { jenis: "bayar", pelanggan_id: "budi", nominal: 1000, deleted: true }),
  // Pelanggan yang sudah dihapus tetap punya catatan
  dasar("s1", 18, { jenis: "jual", dibayar: "nanti", pelanggan_id: "sari", nominal: 7000 }),
  dasar("s2", 18, { jenis: "bayar", pelanggan_id: "sari", nominal: 7000 }),
];

const hasil = catatanDariV3(catatan, barang);
const satu = (id) => hasil.find((c) => c.id === id);

describe("rute setiap jenis catatan v3", () => {
  test("jual", () => {
    expect(satu("j1")).toMatchObject({ dari: "pembeli", ke: "laci", pelanggan_id: null, nominal: 4000 });
    expect(satu("j2")).toMatchObject({ dari: "pembeli", ke: "bon", pelanggan_id: "budi", nominal: 17000 });
  });

  test("keluar", () => {
    expect(satu("b1")).toMatchObject({ dari: "laci", ke: "agen" });
    expect(satu("b1").item[0]).toMatchObject({ barang_id: "kopi", jumlah: 10 });
    expect(satu("b2")).toMatchObject({ dari: "laci", ke: "biaya", keterangan: "plastik" });
    expect(satu("b3")).toMatchObject({ dari: "laci", ke: "bon", pelanggan_id: "budi" });
  });

  test("bayar", () => {
    expect(satu("y1")).toMatchObject({ dari: "bon", ke: "laci", pelanggan_id: "budi", nominal: 5000 });
  });

  test("koreksi stok: tambah pemilik → stok, kurang stok → biaya, nilai = jumlah × harga beli", () => {
    expect(satu("awalK")).toMatchObject({ dari: "pemilik", ke: "stok", nominal: 60000 });
    expect(satu("k1")).toMatchObject({ dari: "stok", ke: "biaya", nominal: 4500 });
    expect(satu("k1").item[0]).toMatchObject({ jumlah: 3, harga: 1500, modal: 1500 });
    expect(satu("k2")).toMatchObject({ dari: "pemilik", ke: "stok", nominal: 30000 });
  });

  test("id, waktu, modal, dan status terhapus dipertahankan", () => {
    expect(satu("j1").id).toBe("j1");
    expect(satu("j1").waktu).toBe(jam(11));
    expect(satu("j1").created_at).toBe(jam(11));
    expect(satu("j1").updated_at).toBe(jam(11) + 5);
    expect(satu("j1").item[0].modal).toBe(1500);
    expect(satu("j4").item[0].modal).toBeNull();
    expect(satu("h1").deleted).toBe(true);
    expect(hasil.every((c) => c.dirty === 1)).toBe(true);
  });

  test("tanggal v3 yang beda dengan created_at tetap masuk tanggal yang sama", () => {
    const [c] = catatanDariV3([dasar("x", 20, { jenis: "jual", dibayar: "sekarang", nominal: 1, tanggal: "2026-10-05" })]);
    expect(tanggalCatatan(c)).toBe("2026-10-05");
  });

  test("jenis yang tidak dikenal dilewati", () => {
    expect(catatanDariV3([dasar("x", 20, { jenis: "aneh" })])).toEqual([]);
  });
});

describe("angka sama persis dengan perhitungan v3", () => {
  test("stok setiap barang", () => {
    const lama = v3.hitungStok(catatan);
    const baru = semuaStok(hasil);
    expect([...lama.keys()].sort()).toEqual([...baru.keys()].sort());
    for (const [id, n] of lama) expect(baru.get(id), id).toBe(n);
    expect(baru.get("kopi")).toBe(44);
  });

  test("bon setiap pelanggan", () => {
    const lama = v3.hitungUtang(catatan);
    const baru = semuaBon(hasil);
    for (const [id, n] of lama) expect(baru.get(id), id).toBe(n);
    expect(baru.get("budi")).toBe(32000);
    expect(baru.get("sari")).toBe(0);
  });

  test("untung: v3 hanya menghitung selisih barang; rumus v4 = itu + jualan tanpa modal − biaya", () => {
    const lama = v3.hitungUntung(catatan);
    expect(lama).toBe(1000 + 2000);
    const r = rincianUntung(hasil);
    expect(r.jualanTanpaModal).toBe(5000 + 2000 + 7000);
    expect(r.biaya).toBe(3000 + 4500);
    expect(r.untung).toBe(lama + r.jualanTanpaModal - r.biaya);
    // Tanpa jualan tanpa modal dan biaya, angkanya persis sama dengan v3
    expect(r.hasil - r.jualanTanpaModal - r.modal).toBe(lama);
  });

  test("selisih uang: laci v4 sama dengan uang masuk − keluar v3", () => {
    expect(isiTempat(hasil, "laci")).toBe(v3.hitungUang(catatan).selisih);
  });

  test("isi laci hasil pindahan bisa minus, karena v3 tidak mencatat uang awal", () => {
    expect(isiTempat(hasil, "laci")).toBeLessThan(0);
  });
});

test("barang dan pelanggan: kolom baru terisi, dirty sesuai permintaan", () => {
  expect(barangDariV3(barang[0])).toMatchObject({ id: "kopi", batas_hampir_habis: 5, harga_beli: 1500, dirty: 0 });
  expect(pelangganDariV3(pelanggan[0])).toMatchObject({ id: "budi", no_wa: "0812", dirty: 0 });
  expect(pelangganDariV3({ ...pelanggan[0], no_wa: "0899" }).no_wa).toBe("0899");
  expect(pelangganDariV3(pelanggan[1]).deleted).toBe(true);
});

describe("salinan fungsi versi 1 dan 2 sama dengan legacy", () => {
  const t0 = new Date(2026, 9, 29, 9).getTime();
  const v1 = {
    barang: [{ id: 1, nama: "Minyak goreng", stok: 8, harga: 18000, hargaBeli: 15000 }],
    transaksi: [
      { id: t0 + 1, tipe: "masuk", nominal: 36000, catatan: "Jual 2 Minyak goreng", tanggal: "2026-10-29", dibuat: t0 + 1, barangId: 1, jumlah: 2, modal: 30000 },
      { id: t0 + 2, tipe: "keluar", nominal: 5000, catatan: "plastik", tanggal: "2026-10-29", dibuat: t0 + 2 },
      { id: t0 + 3, tipe: "masuk", nominal: 10000, catatan: "Bayar kasbon: Bu Sari", tanggal: "2026-10-29", dibuat: t0 + 3 },
    ],
    kasbon: [{ id: 9, nama: "Bu Sari", mutasi: [{ tipe: "utang", nominal: 30000, catatan: "beras", dibuat: t0 - 1000 }, { tipe: "bayar", nominal: 10000, dibuat: t0 + 3 }] }],
  };
  const v2 = {
    barang: [{ id: "b", nama: "Kopi" }],
    pelanggan: [{ id: "p" }],
    transaksi: [{ id: "t1", tanggal: "2026-10-29", created_at: t0, sumber: "jual", tipe: "masuk", barang_id: "b", jumlah: 2, nominal: 4000, modal: 3000 }],
    kasbon: [{ id: "k1", tanggal: "2026-10-29", created_at: t0, tipe: "utang", pelanggan_id: "p", nominal: 5000, catatan: "rokok" }],
    stok_mutasi: [{ id: "m1", tanggal: "2026-10-29", created_at: t0, barang_id: "b", jumlah: 10, alasan: "awal" }],
  };
  const tanpaWaktuUbah = (d) => JSON.parse(JSON.stringify(d, (k, v) => (k === "updated_at" ? undefined : k === "created_at" && v > 1e13 ? undefined : v)));

  test("versi 1", () => {
    const urut = () => {
      let n = 0;
      return () => `id${++n}`;
    };
    expect(tanpaWaktuUbah(dariV1(v1, urut()))).toEqual(tanpaWaktuUbah(migrasiV3.dariV1(v1, urut())));
  });

  test("versi 2", () => {
    expect(tanpaWaktuUbah(dariV2(v2))).toEqual(tanpaWaktuUbah(migrasiV3.dariV2(v2)));
  });
});

describe("memindahkan data di HP", () => {
  // Membuat database v3 sungguhan di IndexedDB
  function buatDbV3({ barang = [], pelanggan = [], catatan = [], meta = [] }) {
    return new Promise((ok, gagal) => {
      const req = indexedDB.open("buku-warung", 2);
      req.onupgradeneeded = () => {
        for (const nama of ["barang", "pelanggan", "catatan"]) req.result.createObjectStore(nama, { keyPath: "id" });
        req.result.createObjectStore("meta", { keyPath: "kunci" });
      };
      req.onerror = () => gagal(req.error);
      req.onsuccess = () => {
        const tx = req.result.transaction(["barang", "pelanggan", "catatan", "meta"], "readwrite");
        for (const b of barang) tx.objectStore("barang").put(b);
        for (const p of pelanggan) tx.objectStore("pelanggan").put(p);
        for (const c of catatan) tx.objectStore("catatan").put(c);
        for (const m of meta) tx.objectStore("meta").put(m);
        tx.oncomplete = () => {
          req.result.close();
          ok();
        };
      };
    });
  }

  const hapusDbV3 = () =>
    new Promise((ok) => {
      const req = indexedDB.deleteDatabase("buku-warung");
      req.onsuccess = req.onerror = req.onblocked = () => ok();
    });

  beforeEach(async () => {
    localStorage.clear();
    await hapusDbV3();
    await db.delete();
    await db.open();
  });

  test("data v3 pindah, nama dan pemilik ikut, cocokkan laci ditandai", async () => {
    await buatDbV3({ barang, pelanggan, catatan, meta: [{ kunci: "pemilik", nilai: "u1" }] });
    localStorage.setItem("bw_nama_warung", "Warung Sari");
    expect(await pindahkanDataHp()).toBe(catatan.length);

    expect(await db.catatan.count()).toBe(catatan.length);
    expect(await db.barang.count()).toBe(3);
    expect(await ambilMeta("cocokkan_laci")).toBe(1);
    expect(await ambilMeta("mulai_selesai")).toBe(1);
    expect(await ambilMeta("nama_warung")).toBe("Warung Sari");
    expect(await ambilMeta("pemilik")).toBe("u1");
    expect((await db.barang.get("gula")).dirty).toBe(1);
    expect((await db.barang.get("kopi")).dirty).toBe(0);
    expect(semuaStok(await semuaAda(db.catatan)).get("kopi")).toBe(44);
  });

  test("hanya berjalan sekali, tidak menggandakan dan tidak mengulang setelah keluar akun", async () => {
    await buatDbV3({ barang, pelanggan, catatan });
    await pindahkanDataHp();
    await db.catatan.clear();
    expect(await pindahkanDataHp()).toBe(0);
    expect(await db.catatan.count()).toBe(0);
  });

  test("HP baru tanpa data lama: tidak ada yang berubah, database lama tidak dibuat", async () => {
    expect(await pindahkanDataHp()).toBe(0);
    expect(await ambilMeta("mulai_selesai")).toBeNull();
    expect(await ambilMeta("cocokkan_laci")).toBeNull();
    expect((await indexedDB.databases()).some((d) => d.name === "buku-warung")).toBe(false);
  });

  test("data versi 1 di localStorage ikut pindah kalau v3 belum pernah dibuka", async () => {
    const t = new Date(2026, 9, 1, 9).getTime();
    localStorage.setItem("bw_barang", JSON.stringify([{ id: 1, nama: "Kopi", stok: 5, harga: 2000, hargaBeli: 1500 }]));
    localStorage.setItem("bw_transaksi", JSON.stringify([{ id: t, tipe: "keluar", nominal: 1000, catatan: "plastik", tanggal: "2026-10-01", dibuat: t }]));
    expect(await pindahkanDataHp()).toBeGreaterThan(0);
    const b = (await db.barang.toArray())[0];
    expect(semuaStok(await semuaAda(db.catatan)).get(b.id)).toBe(5);
    expect(isiTempat(await semuaAda(db.catatan), "laci")).toBe(-1000);
  });
});

describe("cadangan", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  test("format v4: simpan lalu pulihkan menghasilkan data yang sama", async () => {
    await uangAwal(100000);
    const { barang: b } = await tambahBarang({ nama: "Kopi", harga_jual: 2000, harga_beli: 1500, stok: 5 });
    await jual({ pilihan: [{ barang_id: b.id, jumlah: 2 }] });
    const isi = await buatIsiCadangan();
    expect(isi.versi).toBe(4);
    expect(JSON.stringify(isi)).not.toContain('"dirty"');

    await uangAwal(999);
    const hasilBaca = bacaIsiCadangan(JSON.parse(JSON.stringify(isi)));
    expect(hasilBaca.lama).toBe(false);
    await pulihkan(hasilBaca);
    const semua = await semuaAda(db.catatan);
    expect(isiTempat(semua, "laci")).toBe(104000);
    expect(semuaStok(semua).get(b.id)).toBe(3);
    // Yang tidak ada di file ditandai terhapus dan semuanya terkirim ulang
    expect((await db.catatan.toArray()).filter((c) => c.deleted)).toHaveLength(1);
    expect((await db.catatan.toArray()).every((c) => c.dirty === 1)).toBe(true);
    expect(await ambilMeta("cocokkan_laci")).toBeNull();
  });

  test("file v3 terbaca dan menandai cocokkan laci", async () => {
    const baca = bacaIsiCadangan({ aplikasi: "buku-warung", versi: 3, dibuat: 5, data: { barang, pelanggan, catatan } });
    expect(baca.lama).toBe(true);
    expect(baca.data.catatan.find((c) => c.id === "j2")).toMatchObject({ dari: "pembeli", ke: "bon" });
    expect(baca.data.pengingat).toEqual([]);
    await pulihkan(baca);
    expect(await ambilMeta("cocokkan_laci")).toBe(1);
    expect(semuaBon(await semuaAda(db.catatan)).get("budi")).toBe(32000);
  });

  test("file v1 dan v2 terbaca", () => {
    const t = new Date(2026, 9, 1).getTime();
    const satu = bacaIsiCadangan({ aplikasi: "buku-warung", transaksi: [{ id: t, tipe: "keluar", nominal: 1000, tanggal: "2026-10-01", dibuat: t }], barang: [] });
    expect(satu.data.catatan[0]).toMatchObject({ dari: "laci", ke: "biaya", nominal: 1000 });
    const dua = bacaIsiCadangan({ aplikasi: "buku-warung", versi: 2, data: { barang: [], pelanggan: [], transaksi: [{ id: "t", tipe: "keluar", nominal: 2000, tanggal: "2026-10-01", created_at: t, sumber: "manual" }] } });
    expect(dua.data.catatan[0]).toMatchObject({ dari: "laci", ke: "biaya", nominal: 2000 });
    expect(dua.lama).toBe(true);
  });

  test("file yang rusak ditolak", () => {
    for (const isi of [null, {}, { aplikasi: "lain" }, { aplikasi: "buku-warung" }, { aplikasi: "buku-warung", versi: 9, data: {} }, { aplikasi: "buku-warung", versi: 3, data: { barang: [], pelanggan: [], catatan: [{ id: "a", jenis: "aneh" }] } }, { aplikasi: "buku-warung", versi: 4, data: { barang: [], pelanggan: [], catatan: [{ id: "a", dari: "bon", ke: "laci", nominal: 1, waktu: 1, item: [] }] } }]) {
      expect(bacaIsiCadangan(isi), JSON.stringify(isi)).toBeNull();
    }
  });

  test("data v3 lengkap lewat dataDariV3", () => {
    const d = dataDariV3({ barang, pelanggan, catatan });
    expect(d.barang.every((b) => b.dirty === 1)).toBe(true);
    expect(d.catatan).toHaveLength(catatan.length);
  });
});
