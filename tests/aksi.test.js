import { beforeEach, describe, test, expect } from "vitest";
import { db, semuaAda } from "../src/data/db.js";
import { isiTempat, stokBarang, untung } from "../src/data/hitung.js";
import {
  jual, belanja, terimaBon, uangAwal, ambilPribadi, hitungUlangLaci, tambahBarang, koreksiStok, tambahPelanggan, hapusCatatan,
} from "../src/data/aksi.js";

const catatan = () => semuaAda(db.catatan);
const laci = async () => isiTempat(await catatan(), "laci");
const stok = async (id) => stokBarang(await catatan(), id);
const bon = async (id) => isiTempat(await catatan(), "bon", id);
const rute = async () => (await catatan()).sort((a, b) => a.waktu - b.waktu).map((c) => `${c.dari}>${c.ke}:${c.nominal}`);

let kopi;
let budi;

beforeEach(async () => {
  await db.delete();
  await db.open();
  await uangAwal(100000);
  kopi = (await tambahBarang({ nama: "Kopi", harga_jual: 2000, harga_beli: 1500, stok: 10, asal: "rak" })).barang;
  budi = (await tambahPelanggan({ nama: "Budi" })).pelanggan;
});

describe("rute setiap kejadian (rancangan bagian 2)", () => {
  test("persiapan: uang awal dan barang di rak", async () => {
    expect(await rute()).toEqual(["pemilik>laci:100000", "pemilik>stok:15000"]);
    expect(await stok(kopi.id)).toBe(10);
  });

  test("jual tunai: pembeli → laci, modal disimpan", async () => {
    const { catatan: c } = await jual({ pilihan: [{ barang_id: kopi.id, jumlah: 2 }] });
    expect(c).toMatchObject({ dari: "pembeli", ke: "laci", nominal: 4000, dirty: 1 });
    expect(c.item[0]).toMatchObject({ jumlah: 2, harga: 2000, modal: 1500 });
    expect(await laci()).toBe(104000);
    expect(await stok(kopi.id)).toBe(8);
  });

  test("jual ngebon: pembeli → bon, laci tetap", async () => {
    const { catatan: c } = await jual({ pilihan: [{ barang_id: kopi.id, jumlah: 1 }], bayar: "bon", pelangganId: budi.id });
    expect(c).toMatchObject({ dari: "pembeli", ke: "bon", pelanggan_id: budi.id });
    expect(await laci()).toBe(100000);
    expect(await bon(budi.id)).toBe(2000);
    expect(await stok(kopi.id)).toBe(9);
  });

  test("jualan tanpa stok (Lainnya)", async () => {
    const { catatan: c } = await jual({ lainnya: 5000, keterangan: " gorengan " });
    expect(c).toMatchObject({ nominal: 5000, keterangan: "gorengan", item: [] });
  });

  test("terima bon: bon → laci", async () => {
    await jual({ lainnya: 10000, bayar: "bon", pelangganId: budi.id });
    await terimaBon({ pelangganId: budi.id, nominal: 4000 });
    expect(await bon(budi.id)).toBe(6000);
    expect(await laci()).toBe(104000);
  });

  test("pinjam uang: laci → bon", async () => {
    await belanja({ jenis: "pinjaman", total: 30000, pelangganId: budi.id });
    expect(await laci()).toBe(70000);
    expect(await bon(budi.id)).toBe(30000);
  });

  test("belanja stok: laci → agen, stok bertambah, harga beli diperbarui", async () => {
    const { catatan: [c] } = await belanja({ jenis: "stok", total: 16000, barangId: kopi.id, jumlah: 10 });
    expect(c).toMatchObject({ dari: "laci", ke: "agen", nominal: 16000 });
    expect(await stok(kopi.id)).toBe(20);
    expect((await db.barang.get(kopi.id)).harga_beli).toBe(1600);
  });

  test("biaya: laci → biaya", async () => {
    await belanja({ jenis: "biaya", total: 20000, keterangan: "plastik" });
    expect(await laci()).toBe(80000);
    expect(untung(await catatan())).toBe(-20000);
  });

  test("ambil pribadi: laci → pemilik, ditolak kalau melebihi", async () => {
    await ambilPribadi(40000);
    expect(await laci()).toBe(60000);
    expect((await ambilPribadi(60001)).galat).toContain("Laci cuma Rp 60.000");
  });

  test("hitung ulang: selisih dua arah, sama tidak mencatat apa pun", async () => {
    await hitungUlangLaci(95000);
    expect((await rute()).at(-1)).toBe("laci>selisih:5000");
    expect(await laci()).toBe(95000);
    await hitungUlangLaci(97000);
    expect((await rute()).at(-1)).toBe("selisih>laci:2000");
    const jumlah = (await catatan()).length;
    await hitungUlangLaci(97000);
    expect((await catatan()).length).toBe(jumlah);
  });

  test("tambah barang baru dibeli: laci → agen", async () => {
    const { barang } = await tambahBarang({ nama: "Teh", harga_jual: 3000, harga_beli: 2000, stok: 5, asal: "dibeli" });
    expect((await rute()).at(-1)).toBe("laci>agen:10000");
    expect(await stok(barang.id)).toBe(5);
    expect(barang.batas_hampir_habis).toBe(5);
  });

  test("koreksi stok: stok → biaya senilai harga beli, untung berkurang", async () => {
    await koreksiStok(kopi.id, 8, "Rusak");
    expect((await rute()).at(-1)).toBe("stok>biaya:3000");
    expect((await catatan()).at(-1)).toBeDefined();
    expect(await stok(kopi.id)).toBe(8);
    expect(untung(await catatan())).toBe(-3000);
  });

  test("koreksi stok lebih banyak: pemilik → stok", async () => {
    await koreksiStok(kopi.id, 12);
    expect((await rute()).at(-1)).toBe("pemilik>stok:3000");
    expect(await stok(kopi.id)).toBe(12);
  });

  test("pelanggan dengan bon lama: pemilik → bon, laci dan untung tetap", async () => {
    const { pelanggan } = await tambahPelanggan({ nama: "Sari", no_wa: "0812", bonLama: 50000 });
    expect(await bon(pelanggan.id)).toBe(50000);
    expect(await laci()).toBe(100000);
    expect(untung(await catatan())).toBe(0);
  });
});

describe("belanja melebihi laci", () => {
  test("tanpa persetujuan: tidak menyimpan apa pun, memberi tahu kekurangannya", async () => {
    const jumlah = (await catatan()).length;
    const hasil = await belanja({ jenis: "stok", total: 150000, barangId: kopi.id, jumlah: 100 });
    expect(hasil.perluPribadi).toEqual({ isiLaci: 100000, kekurangan: 50000 });
    expect((await catatan()).length).toBe(jumlah);
    expect((await db.barang.get(kopi.id)).harga_beli).toBe(1500);
  });

  test("setuju: dua catatan, laci jadi nol, tidak minus", async () => {
    await belanja({ jenis: "stok", total: 150000, barangId: kopi.id, jumlah: 100, pakaiPribadi: true });
    expect((await rute()).slice(-2)).toEqual(["pemilik>laci:50000", "laci>agen:150000"]);
    expect(await laci()).toBe(0);
    expect(await stok(kopi.id)).toBe(110);
  });

  test("biaya dan barang baru dibeli memakai aturan yang sama", async () => {
    expect((await belanja({ jenis: "biaya", total: 120000 })).perluPribadi.kekurangan).toBe(20000);
    const hasil = await tambahBarang({ nama: "Gula", harga_beli: 50000, stok: 3, asal: "dibeli" });
    expect(hasil.perluPribadi.kekurangan).toBe(50000);
    expect(await db.barang.count()).toBe(1); // barangnya belum tersimpan
    await tambahBarang({ nama: "Gula", harga_beli: 50000, stok: 3, asal: "dibeli", pakaiPribadi: true });
    expect(await laci()).toBe(0);
    expect(await db.barang.count()).toBe(2);
  });
});

describe("yang ditolak", () => {
  test("jual melebihi stok atau tanpa harga", async () => {
    expect((await jual({ pilihan: [{ barang_id: kopi.id, jumlah: 11 }] })).galat).toBe("Stok Kopi tinggal 10.");
    const { barang } = await tambahBarang({ nama: "Teh" });
    expect((await jual({ pilihan: [{ barang_id: barang.id, jumlah: 1 }] })).galat).toContain("Harga jual");
    expect((await jual({})).galat).toBeTruthy();
  });

  test("bon tanpa pelanggan", async () => {
    expect((await jual({ lainnya: 1000, bayar: "bon" })).galat).toContain("pelanggan");
    expect((await belanja({ jenis: "pinjaman", total: 1000 })).galat).toContain("pelanggan");
  });

  test("terima bon melebihi sisa", async () => {
    await jual({ lainnya: 5000, bayar: "bon", pelangganId: budi.id });
    expect((await terimaBon({ pelangganId: budi.id, nominal: 6000 })).galat).toBe("Bon Budi tinggal Rp 5.000.");
  });

  test("nama ganda", async () => {
    expect((await tambahBarang({ nama: " kopi " })).galat).toContain("sudah ada");
    expect((await tambahPelanggan({ nama: "BUDI" })).galat).toContain("sudah ada");
  });

  test("belanja stok tanpa jumlah bulat", async () => {
    expect((await belanja({ jenis: "stok", total: 1000, barangId: kopi.id, jumlah: 1.5 })).galat).toBeTruthy();
  });
});

describe("hapusCatatan", () => {
  test("hapus lunak: baris tetap ada, akibatnya batal, dirty menyala", async () => {
    const { catatan: c } = await jual({ pilihan: [{ barang_id: kopi.id, jumlah: 2 }] });
    await hapusCatatan(c.id);
    expect(await laci()).toBe(100000);
    expect(await stok(kopi.id)).toBe(10);
    expect(await db.catatan.get(c.id)).toMatchObject({ deleted: true, dirty: 1 });
  });

  test("ditolak kalau stok jadi minus, catatannya tetap ada", async () => {
    const { catatan: [masuk] } = await belanja({ jenis: "stok", total: 5000, barangId: kopi.id, jumlah: 5 });
    await jual({ pilihan: [{ barang_id: kopi.id, jumlah: 15 }] });
    expect((await hapusCatatan(masuk.id)).galat).toContain("Stok Kopi");
    expect((await db.catatan.get(masuk.id)).deleted).toBe(false);
  });

  test("ditolak kalau bon jadi minus", async () => {
    const { catatan: c } = await jual({ lainnya: 5000, bayar: "bon", pelangganId: budi.id });
    await terimaBon({ pelangganId: budi.id, nominal: 5000 });
    expect((await hapusCatatan(c.id)).galat).toContain("Bon Budi");
  });

  test("belanja dihapus: harga beli kembali, termasuk dua belanja berurutan", async () => {
    const { catatan: [a] } = await belanja({ jenis: "stok", total: 5000, barangId: kopi.id, jumlah: 1 });
    const { catatan: [b] } = await belanja({ jenis: "stok", total: 6000, barangId: kopi.id, jumlah: 1 });
    expect((await db.barang.get(kopi.id)).harga_beli).toBe(6000);
    await hapusCatatan(a.id);
    expect((await db.barang.get(kopi.id)).harga_beli).toBe(6000);
    await hapusCatatan(b.id);
    expect((await db.barang.get(kopi.id)).harga_beli).toBe(1500);
  });

  test("modal di catatan jual lama tidak berubah oleh belanja baru", async () => {
    const { catatan: c } = await jual({ pilihan: [{ barang_id: kopi.id, jumlah: 1 }] });
    await belanja({ jenis: "stok", total: 9000, barangId: kopi.id, jumlah: 3 });
    expect((await db.catatan.get(c.id)).item[0].modal).toBe(1500);
  });
});
