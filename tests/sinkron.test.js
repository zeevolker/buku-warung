import { beforeEach, describe, test, expect } from "vitest";
import { db, ambilMeta, aturMeta, semuaAda } from "../src/data/db.js";
import { dorong, tarik, sinkronSekali, pakaiVersiServer, siapKirim, jumlahBelumTerkirim, namaServer } from "../src/data/sync.js";
import { uangAwal, jual, tambahBarang, tambahPelanggan, hapusCatatan, tambahPengingat } from "../src/data/aksi.js";
import { isiTempat } from "../src/data/hitung.js";
import { bacaIsi } from "../src/data/ringkasan.js";

// Server tiruan yang meniru trigger bw_sebelum_tulis: versi lama diabaikan, server_updated_at maju
function serverTiruan() {
  const tabel = {};
  let jam = Date.parse("2026-11-01T00:00:00Z");
  return {
    tabel,
    gagal: false,
    kirimanMasuk: [],
    isi: (nama) => Object.values(tabel[nama] || {}),
    tulis(nama, baris) {
      tabel[nama] ??= {};
      const lama = tabel[nama][baris.id];
      if (lama && baris.updated_at < lama.updated_at) return;
      jam += 1000;
      tabel[nama][baris.id] = { ...lama, ...baris, user_id: "u1", server_updated_at: new Date(jam).toISOString() };
    },
    async kirim(nama, daftar) {
      if (this.gagal) throw new Error("server mati");
      this.kirimanMasuk.push({ nama, daftar });
      for (const b of daftar) this.tulis(nama, b);
    },
    async ambilSejak(nama, sejak, batas) {
      if (this.gagal) throw new Error("server mati");
      return this.isi(nama)
        .filter((b) => b.server_updated_at >= sejak)
        .sort((a, b) => a.server_updated_at.localeCompare(b.server_updated_at))
        .slice(0, batas);
    },
  };
}

let server;

beforeEach(async () => {
  await db.delete();
  await db.open();
  server = serverTiruan();
});

describe("aturan versi", () => {
  test("pakaiVersiServer", () => {
    expect(pakaiVersiServer(undefined, { updated_at: 1 })).toBe(true);
    expect(pakaiVersiServer({ updated_at: 5, dirty: 0 }, { updated_at: 5 })).toBe(true);
    expect(pakaiVersiServer({ updated_at: 5, dirty: 1 }, { updated_at: 5 })).toBe(false);
    expect(pakaiVersiServer({ updated_at: 5, dirty: 1 }, { updated_at: 6 })).toBe(true);
    expect(pakaiVersiServer({ updated_at: 5, dirty: 0 }, { updated_at: 4 })).toBe(false);
  });

  test("siapKirim: kolom seragam, tanpa kolom khusus HP", () => {
    const p = siapKirim("pelanggan", { id: "a", nama: "Budi", dirty: 1, telepon: "08", user_id: "x", server_updated_at: "z", created_at: 1, updated_at: 2 });
    expect(p).toEqual({ id: "a", created_at: 1, updated_at: 2, deleted: false, nama: "Budi", no_wa: "" });
    expect(siapKirim("barang", { id: "b" }).batas_hampir_habis).toBe(5);
    expect(siapKirim("catatan", { id: "c" })).toMatchObject({ pelanggan_id: null, item: [], keterangan: "" });
    expect(Object.keys(siapKirim("pengingat", { id: "d" })).sort()).toEqual(["created_at", "deleted", "id", "keterangan", "selesai", "teks", "updated_at", "waktu_ingat"]);
  });

  test("catatan disimpan di tabel catatan2, tabel lain bernama sama", () => {
    expect(namaServer("catatan")).toBe("catatan2");
    expect(namaServer("barang")).toBe("barang");
  });
});

describe("dorong", () => {
  test("mengirim semua baris dirty, lalu tidak dirty lagi", async () => {
    await uangAwal(1000);
    await tambahPelanggan({ nama: "Budi" });
    await tambahPengingat({ teks: "Beli gas" });
    expect(await jumlahBelumTerkirim()).toBe(3);
    expect(await dorong(server)).toBe(3);
    expect(await jumlahBelumTerkirim()).toBe(0);
    expect(server.isi("catatan2")).toHaveLength(1);
    expect(server.isi("pengingat")).toHaveLength(1);
    expect(await dorong(server)).toBe(0);
  });

  test("pelanggan terkirim sebelum catatan yang menunjuk kepadanya", async () => {
    const { pelanggan } = await tambahPelanggan({ nama: "Budi" });
    await jual({ lainnya: 1000, bayar: "bon", pelangganId: pelanggan.id });
    await dorong(server);
    const urutan = server.kirimanMasuk.map((k) => k.nama);
    expect(urutan.indexOf("pelanggan")).toBeLessThan(urutan.indexOf("catatan2"));
  });

  test("gagal kirim: data tetap dirty dan aman", async () => {
    await uangAwal(1000);
    server.gagal = true;
    await expect(dorong(server)).rejects.toThrow();
    expect(await jumlahBelumTerkirim()).toBe(1);
    expect(isiTempat(await semuaAda(db.catatan), "laci")).toBe(1000);
  });

  test("baris yang berubah selama dikirim tetap dirty", async () => {
    await uangAwal(1000);
    const c = (await db.catatan.toArray())[0];
    const asli = server.kirim.bind(server);
    server.kirim = async (nama, daftar) => {
      await asli(nama, daftar);
      await db.catatan.put({ ...c, keterangan: "diubah", updated_at: c.updated_at + 5, dirty: 1 });
    };
    await dorong(server);
    expect((await db.catatan.get(c.id)).dirty).toBe(1);
  });
});

describe("tarik", () => {
  test("baris dari HP lain masuk tanpa kolom server, dan tidak dirty", async () => {
    server.tulis("catatan2", { id: "c1", waktu: Date.now(), dari: "pemilik", ke: "laci", nominal: 5000, item: [], keterangan: "", pelanggan_id: null, created_at: 1, updated_at: 1, deleted: false });
    expect(await tarik(server)).toBe(1);
    const c = await db.catatan.get("c1");
    expect(c).toMatchObject({ nominal: 5000, dirty: 0 });
    expect(c.user_id).toBeUndefined();
    expect(c.server_updated_at).toBeUndefined();
  });

  test("hapus dari HP lain ikut, angka berubah", async () => {
    const { catatan } = await uangAwal(5000);
    await sinkronSekali(server);
    expect(isiTempat(await semuaAda(db.catatan), "laci")).toBe(5000);
    server.tulis("catatan2", { ...server.tabel.catatan2[catatan.id], deleted: true, updated_at: catatan.updated_at + 1000 });
    await tarik(server);
    expect(isiTempat(await semuaAda(db.catatan), "laci")).toBe(0);
  });

  test("perubahan HP yang lebih baru menang atas versi server", async () => {
    const { catatan } = await uangAwal(5000);
    await sinkronSekali(server);
    await db.catatan.put({ ...(await db.catatan.get(catatan.id)), keterangan: "HP", updated_at: catatan.updated_at + 50, dirty: 1 });
    server.tulis("catatan2", { ...server.tabel.catatan2[catatan.id], keterangan: "lama", updated_at: catatan.updated_at + 10 });
    await tarik(server);
    expect((await db.catatan.get(catatan.id)).keterangan).toBe("HP");
  });

  test("catatan lama dari HP lain membuat ringkasan dihitung ulang", async () => {
    const lalu = new Date();
    lalu.setDate(lalu.getDate() - 20);
    await uangAwal(1000);
    await sinkronSekali(server);
    server.tulis("catatan2", { id: "lama", waktu: lalu.getTime(), dari: "pemilik", ke: "laci", nominal: 700, item: [], keterangan: "", pelanggan_id: null, created_at: 1, updated_at: Date.now(), deleted: false });
    await tarik(server);
    expect((await bacaIsi()).laci).toBe(1700);
  });

  test("kursor tersimpan per tabel, tarikan berikutnya mulai dari sana", async () => {
    server.tulis("barang", { id: "b1", nama: "Kopi", created_at: 1, updated_at: 1, deleted: false });
    await tarik(server);
    expect(await ambilMeta("tarik:barang")).toBe(server.tabel.barang.b1.server_updated_at);
    const dicatat = [];
    const asli = server.ambilSejak.bind(server);
    server.ambilSejak = (nama, sejak, batas) => {
      dicatat.push([nama, sejak]);
      return asli(nama, sejak, batas);
    };
    await tarik(server);
    const barang = dicatat.find(([nama]) => nama === "barang")[1];
    // Tumpang 10 detik sebelum kursor
    expect(Date.parse(server.tabel.barang.b1.server_updated_at) - Date.parse(barang)).toBe(10000);
  });
});

describe("dua HP", () => {
  test("data sama setelah keduanya sinkron", async () => {
    const b = await tambahBarang({ nama: "Kopi", harga_jual: 2000, harga_beli: 1500, stok: 5 });
    await jual({ pilihan: [{ barang_id: b.barang.id, jumlah: 2 }] });
    await sinkronSekali(server);
    const hpSatu = (await semuaAda(db.catatan)).map((c) => c.id).sort();

    // HP kedua: database kosong, server yang sama
    await db.delete();
    await db.open();
    await sinkronSekali(server);
    expect((await semuaAda(db.catatan)).map((c) => c.id).sort()).toEqual(hpSatu);
    expect((await db.barang.toArray())[0].nama).toBe("Kopi");
    expect(await jumlahBelumTerkirim()).toBe(0);
  });

  test("hapus setelah sinkron terkirim sebagai deleted, tidak benar-benar hilang", async () => {
    const { catatan } = await uangAwal(5000);
    await uangAwal(1000);
    await sinkronSekali(server);
    expect(await hapusCatatan(catatan.id)).toEqual({});
    await sinkronSekali(server);
    expect(server.tabel.catatan2[catatan.id].deleted).toBe(true);
  });
});

test("sinkron pertama memindahkan catatan v3 di cloud sekali saja", async () => {
  server.tulis("pelanggan", { id: "p1", nama: "Budi", created_at: 1, updated_at: 1, deleted: false });
  server.tulis("catatan", { id: "v3a", jenis: "jual", tanggal: "2026-10-30", nominal: 5000, dibayar: "nanti", pelanggan_id: "p1", barang: [], keterangan: "", created_at: new Date(2026, 9, 30, 9).getTime(), updated_at: 5, deleted: false });
  await sinkronSekali(server);
  expect(server.tabel.catatan2.v3a).toMatchObject({ dari: "pembeli", ke: "bon", nominal: 5000, pelanggan_id: "p1" });
  expect(await ambilMeta("cocokkan_laci")).toBe(1);
  expect(await ambilMeta("migrasi_cloud")).toBe(1);

  await aturMeta("cocokkan_laci", 0);
  const jumlah = server.kirimanMasuk.length;
  await sinkronSekali(server);
  expect(server.kirimanMasuk.length).toBe(jumlah);
  expect(await ambilMeta("cocokkan_laci")).toBe(0);
});
