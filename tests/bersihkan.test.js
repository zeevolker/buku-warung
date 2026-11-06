import { beforeEach, describe, test, expect } from "vitest";
import { db, ambilMeta, aturMeta } from "../src/data/db.js";
import { bolehDibersihkan, idDipakai, pilihYangDibersihkan, pilihYangHilang, bersihkanBilaPerlu, sinkronPenuh } from "../src/data/bersihkan.js";
import { sinkronSekali } from "../src/data/sync.js";
import { bacaIsi, isiSekarang } from "../src/data/ringkasan.js";
import { isiTempat, stokBarang, semuaBon, ringkasanHari, ringkasanBulan, rincianUntung } from "../src/data/hitung.js";
import { uangAwal, jual, belanja, tambahBarang, tambahPelanggan, hapusCatatan, hapusPelanggan, hapusBarang, terimaBon } from "../src/data/aksi.js";
import { hariIni } from "../src/data/tanggal.js";

const SEKARANG = new Date(2026, 10, 7, 9, 0).getTime();
const HARI = 24 * 60 * 60 * 1000;
const lalu = (n) => SEKARANG - n * HARI;
const akun = { sekarang: SEKARANG };
const baris = (id, isi = {}) => ({ id, deleted: true, dirty: 0, updated_at: lalu(31), ...isi });

describe("bolehDibersihkan", () => {
  test("31 hari lalu boleh, 29 hari lalu tidak, tepat 30 hari belum", () => {
    expect(bolehDibersihkan(baris("a"), akun)).toBe(true);
    expect(bolehDibersihkan(baris("a", { updated_at: lalu(29) }), akun)).toBe(false);
    expect(bolehDibersihkan(baris("a", { updated_at: lalu(30) }), akun)).toBe(false);
  });

  test("deleted = false tidak pernah, setua apa pun", () => {
    expect(bolehDibersihkan(baris("a", { deleted: false, updated_at: lalu(4000) }), akun)).toBe(false);
    expect(bolehDibersihkan(baris("a", { deleted: false, updated_at: lalu(4000) }), { ...akun, tamu: true })).toBe(false);
  });

  test("masih dirty: belum terkirim, jadi tidak boleh", () => {
    expect(bolehDibersihkan(baris("a", { dirty: 1 }), akun)).toBe(false);
  });

  test("tamu: dirty tidak dipakai, tapi syarat deleted dan 30 hari tetap", () => {
    const tamu = { ...akun, tamu: true };
    expect(bolehDibersihkan(baris("a", { dirty: 1 }), tamu)).toBe(true);
    expect(bolehDibersihkan(baris("a", { dirty: 1, updated_at: lalu(29) }), tamu)).toBe(false);
    expect(bolehDibersihkan(baris("a", { dirty: 1, deleted: false }), tamu)).toBe(false);
  });
});

test("idDipakai membaca pelanggan_id dan barang_id di dalam item", () => {
  const hasil = idDipakai([{ pelanggan_id: "p1", item: [{ barang_id: "b1" }, { barang_id: null }, {}] }, { pelanggan_id: null }]);
  expect([...hasil.pelanggan]).toEqual(["p1"]);
  expect([...hasil.barang]).toEqual(["b1"]);
});

describe("pilihYangDibersihkan", () => {
  test("barang dan pelanggan yang masih dipakai catatan aktif tidak dibersihkan", () => {
    const hasil = pilihYangDibersihkan(
      {
        barang: [baris("b1"), baris("b2")],
        pelanggan: [baris("p1"), baris("p2")],
        catatan: [baris("c1", { deleted: false, pelanggan_id: "p1", item: [{ barang_id: "b1" }] })],
      },
      akun
    );
    expect(hasil).toMatchObject({ catatan: [], barang: ["b2"], pelanggan: ["p2"] });
  });

  test("dipakai catatan terhapus yang belum 30 hari: tetap disimpan", () => {
    const hasil = pilihYangDibersihkan({ barang: [baris("b1")], pelanggan: [baris("p1")], catatan: [baris("c1", { updated_at: lalu(5), pelanggan_id: "p1", item: [{ barang_id: "b1" }] })] }, akun);
    expect(hasil).toMatchObject({ catatan: [], barang: [], pelanggan: [] });
  });

  test("dipakai catatan yang masih dirty: tetap disimpan", () => {
    const hasil = pilihYangDibersihkan({ pelanggan: [baris("p1")], catatan: [baris("c1", { dirty: 1, pelanggan_id: "p1" })] }, akun);
    expect(hasil).toMatchObject({ catatan: [], pelanggan: [] });
  });

  test("catatannya ikut bersih: barang dan pelanggan langsung bersih di putaran yang sama", () => {
    const hasil = pilihYangDibersihkan({ barang: [baris("b1")], pelanggan: [baris("p1")], catatan: [baris("c1", { pelanggan_id: "p1", item: [{ barang_id: "b1" }] })] }, akun);
    expect(hasil).toMatchObject({ catatan: ["c1"], barang: ["b1"], pelanggan: ["p1"] });
  });

  test("pengingat dan memo ikut aturan yang sama", () => {
    const hasil = pilihYangDibersihkan({ pengingat: [baris("a"), baris("b", { deleted: false })], memo: [baris("c"), baris("d", { dirty: 1 })] }, akun);
    expect(hasil).toMatchObject({ pengingat: ["a"], memo: ["c"] });
  });
});

describe("pilihYangHilang", () => {
  const server = (isi = {}) => ({ barang: new Set(), pelanggan: new Set(), catatan: new Set(), pengingat: new Set(), memo: new Set(), ...isi });

  test("tidak ada di server dan tidak dirty: dihapus. Dirty atau masih ada di server: tetap", () => {
    const { hapus } = pilihYangHilang(
      { catatan: [baris("hilang", { deleted: false }), baris("baru", { dirty: 1, deleted: false }), baris("ada", { deleted: false })], memo: [baris("m1", { deleted: false })] },
      server({ catatan: new Set(["ada"]) })
    );
    expect(hapus.catatan).toEqual(["hilang"]);
    expect(hapus.memo).toEqual(["m1"]);
  });

  test("pelanggan yang dipakai catatan belum terkirim dikirim ulang, bukan dihapus", () => {
    const { hapus, kirimUlang } = pilihYangHilang(
      { pelanggan: [baris("p1"), baris("p2")], barang: [baris("b1"), baris("b2")], catatan: [baris("c1", { dirty: 1, deleted: false, pelanggan_id: "p1", item: [{ barang_id: "b1" }] })] },
      server()
    );
    expect(kirimUlang).toEqual({ barang: ["b1"], pelanggan: ["p1"] });
    expect(hapus.pelanggan).toEqual(["p2"]);
    expect(hapus.barang).toEqual(["b2"]);
  });

  test("catatan yang ikut hilang tidak menahan pelanggannya", () => {
    const { hapus, kirimUlang } = pilihYangHilang({ pelanggan: [baris("p1")], catatan: [baris("c1", { pelanggan_id: "p1" })] }, server());
    expect(hapus.pelanggan).toEqual(["p1"]);
    expect(kirimUlang.pelanggan).toEqual([]);
  });
});

// ---------- Dengan database ----------

const kosongkan = async () => {
  await db.delete();
  await db.open();
};

// Mundurkan waktu ubah sebuah baris, seperti kalau sudah lama dihapus
const tuakan = (tabel, id, hari, isi = {}) => db[tabel].update(id, { updated_at: Date.now() - hari * HARI, dirty: 0, ...isi });

const ringkas = async () => {
  const catatan = await db.catatan.toArray();
  const hari = hariIni();
  return {
    isi: await bacaIsi(),
    laci: isiTempat(catatan, "laci"),
    stok: Object.fromEntries((await db.barang.toArray()).filter((b) => !b.deleted).map((b) => [b.nama, stokBarang(catatan, b.id)])),
    bon: Object.fromEntries(semuaBon(catatan)),
    untung: rincianUntung(catatan),
    hari: ringkasanHari(catatan, hari),
    bulan: ringkasanBulan(catatan, hari),
  };
};

describe("bersihkanBilaPerlu", () => {
  beforeEach(async () => {
    await kosongkan();
    await aturMeta("pemilik", "u1");
  });

  test("isi laci, stok, bon, dan laporan sama sebelum dan sesudah", async () => {
    await uangAwal(500000);
    const { barang: kopi } = await tambahBarang({ nama: "Kopi", harga_jual: 2000, harga_beli: 1500, stok: 10 });
    const { barang: lama } = await tambahBarang({ nama: "Barang lama", harga_jual: 1000, harga_beli: 500, stok: 0 });
    const { pelanggan: budi } = await tambahPelanggan({ nama: "Budi" });
    const { pelanggan: sari } = await tambahPelanggan({ nama: "Sari" });
    await jual({ item: [{ barang_id: kopi.id, jumlah: 2 }] });
    await jual({ lainnya: 30000, bayar: "bon", pelangganId: budi.id });
    await terimaBon({ pelangganId: budi.id, nominal: 10000 });
    await belanja({ jenis: "biaya", total: 5000, keterangan: "Plastik" });

    // Dihapus lama: satu penjualan, satu pelanggan dan barang yang tidak dipakai
    const { catatan: dihapus } = await jual({ lainnya: 7000, keterangan: "Salah catat" });
    expect((await hapusCatatan(dihapus.id)).galat).toBeUndefined();
    await hapusPelanggan(sari.id);
    await hapusBarang(lama.id);
    await isiSekarang();
    const jumlahAwal = await db.catatan.count();

    await tuakan("catatan", dihapus.id, 31);
    await tuakan("pelanggan", sari.id, 31);
    await tuakan("barang", lama.id, 31);
    // Barang yang dihapus tapi punya catatan aktif tidak boleh ikut hilang
    await tuakan("barang", kopi.id, 31, { deleted: true });

    const sebelum = await ringkas();
    await bersihkanBilaPerlu();
    expect(await ringkas()).toEqual(sebelum);

    expect(await db.catatan.count()).toBe(jumlahAwal - 1);
    expect(await db.catatan.get(dihapus.id)).toBeUndefined();
    expect(await db.pelanggan.get(sari.id)).toBeUndefined();
    expect(await db.barang.get(lama.id)).toBeUndefined();
    expect(await db.barang.get(kopi.id)).toBeTruthy();
    expect(await db.pelanggan.get(budi.id)).toBeTruthy();
  });

  test("paling sering sekali sehari, dan waktunya dicatat di meta", async () => {
    const m = { id: "m1", deleted: true, dirty: 0, updated_at: Date.now() - 31 * HARI };
    await db.memo.put(m);
    const t = Date.now();
    await bersihkanBilaPerlu(t);
    expect(await db.memo.count()).toBe(0);
    expect(await ambilMeta("bersihkan_terakhir")).toBe(t);

    await db.memo.put(m);
    expect(await bersihkanBilaPerlu(t + HARI - 1000)).toBeNull();
    expect(await db.memo.count()).toBe(1);
    await bersihkanBilaPerlu(t + HARI + 1000);
    expect(await db.memo.count()).toBe(0);
  });

  test("punya akun: dirty tidak dibersihkan. Tamu: dibersihkan", async () => {
    const m = { id: "m1", deleted: true, dirty: 1, updated_at: Date.now() - 31 * HARI };
    await db.memo.put(m);
    await bersihkanBilaPerlu();
    expect(await db.memo.count()).toBe(1);

    await db.meta.clear();
    await bersihkanBilaPerlu();
    expect(await db.memo.count()).toBe(0);
  });
});

function serverTiruan(isi = {}, batasServer = Infinity) {
  return {
    tabel: isi,
    gagalDi: null,
    terkirim: [],
    async ambilId(nama, setelah, batas) {
      if (this.gagalDi === nama) throw new Error("server mati");
      return (this.tabel[nama] || [])
        .map((b) => b.id)
        .sort()
        .filter((id) => setelah === null || id > setelah)
        .slice(0, Math.min(batas, batasServer));
    },
    async kirim(nama, daftar) {
      this.terkirim.push({ nama, daftar });
      this.tabel[nama] = [...(this.tabel[nama] || []), ...daftar];
    },
    async ambilSejak() {
      return [];
    },
  };
}

const lokal = (id, isi = {}) => ({ id, deleted: false, dirty: 0, created_at: 1, updated_at: 1, ...isi });

describe("sinkronPenuh", () => {
  beforeEach(kosongkan);

  test("baris yang tidak ada di server dihapus, yang dirty tetap, baris server utuh", async () => {
    await db.catatan.bulkPut([lokal("a", { waktu: 1 }), lokal("hilang", { waktu: 1 }), lokal("baru", { waktu: 1, dirty: 1 })]);
    await db.memo.put(lokal("m-hilang"));
    await sinkronPenuh(serverTiruan({ catatan2: [{ id: "a" }] }));
    expect((await db.catatan.toArray()).map((c) => c.id).sort()).toEqual(["a", "baru"]);
    expect(await db.memo.count()).toBe(0);
  });

  test("daftar id dibaca sampai habis walau server memberi lebih sedikit dari yang diminta", async () => {
    const banyak = Array.from({ length: 25 }, (_, i) => ({ id: `c${String(i).padStart(2, "0")}` }));
    await db.catatan.bulkPut(banyak.map((b) => lokal(b.id, { waktu: 1 })));
    await sinkronPenuh(serverTiruan({ catatan2: banyak }, 10));
    expect(await db.catatan.count()).toBe(25);
  });

  test("salah satu tabel gagal dibaca: tidak ada yang dihapus", async () => {
    await db.catatan.put(lokal("hilang", { waktu: 1 }));
    await db.pengingat.put(lokal("p"));
    const server = serverTiruan({ catatan2: [{ id: "lain" }] });
    server.gagalDi = "memo";
    await expect(sinkronPenuh(server)).rejects.toThrow();
    expect(await db.catatan.count()).toBe(1);
    expect(await db.pengingat.count()).toBe(1);
  });

  test("server kosong sama sekali: tidak ada yang dihapus", async () => {
    await db.catatan.put(lokal("a", { waktu: 1 }));
    expect(await sinkronPenuh(serverTiruan())).toBeNull();
    expect(await db.catatan.count()).toBe(1);
  });

  test("catatan aktif yang hilang mengubah isi laci, dan ringkasan lama ikut dihitung ulang", async () => {
    const kemarin = new Date();
    kemarin.setDate(kemarin.getDate() - 3);
    const waktu = kemarin.getTime();
    await db.catatan.bulkPut([
      lokal("awal", { waktu, dari: "pemilik", ke: "laci", nominal: 100000 }),
      lokal("hilang", { waktu, dari: "pembeli", ke: "laci", nominal: 5000 }),
    ]);
    await isiSekarang();
    expect((await bacaIsi()).laci).toBe(105000);
    await sinkronPenuh(serverTiruan({ catatan2: [{ id: "awal" }] }));
    expect((await bacaIsi()).laci).toBe(100000);
  });

  test("sinkronSekali: lebih dari 30 hari menjalankan sinkron penuh lebih dulu, dan pelanggan terkirim sebelum catatannya", async () => {
    await aturMeta("migrasi_cloud", 1);
    await aturMeta("sinkron_terakhir", Date.now() - 31 * HARI);
    await db.pelanggan.put(lokal("p1", { nama: "Budi" }));
    await db.catatan.bulkPut([
      lokal("c-baru", { dirty: 1, waktu: 1, dari: "pembeli", ke: "bon", pelanggan_id: "p1", nominal: 1 }),
      lokal("c-hilang", { waktu: 1 }),
    ]);
    const server = serverTiruan({ memo: [{ id: "lain" }] });
    await sinkronSekali(server);
    expect(await db.catatan.get("c-hilang")).toBeUndefined();
    expect(server.terkirim.map((k) => k.nama)).toEqual(["pelanggan", "catatan2"]);
    expect((await db.pelanggan.get("p1")).dirty).toBe(0);
  });

  test("sinkronSekali: 29 hari lalu, atau belum pernah sinkron, tidak mencocokkan daftar id", async () => {
    for (const terakhir of [Date.now() - 29 * HARI, null]) {
      await kosongkan();
      await aturMeta("migrasi_cloud", 1);
      if (terakhir) await aturMeta("sinkron_terakhir", terakhir);
      await db.catatan.put(lokal("tetap", { waktu: 1 }));
      await sinkronSekali(serverTiruan({ memo: [{ id: "lain" }] }));
      expect(await db.catatan.get("tetap")).toBeTruthy();
    }
  });
});
