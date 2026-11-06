import { beforeEach, afterEach, describe, test, expect, vi } from "vitest";
import { catatan, HARI_INI, WAKTU_SEKARANG } from "./fixture.js";
import { db, aturMeta } from "../src/data/db.js";
import { isiTempat, semuaBon, semuaStok, tanggalCatatan } from "../src/data/hitung.js";
import { bacaIsi, bangunRingkasan, isiAkhirHari, isiSekarang, tandaiBerubah } from "../src/data/ringkasan.js";
import { geserTanggal } from "../src/data/tanggal.js";

// Hitung dari nol, sebagai pembanding. Angka nol dibuang supaya bentuknya bisa dibandingkan.
function dariNol(daftar, tanggal) {
  const sampai = daftar.filter((c) => tanggalCatatan(c) <= tanggal);
  const tanpaNol = (peta) => Object.fromEntries([...peta].filter(([, n]) => n !== 0));
  return { laci: isiTempat(sampai, "laci"), bon: tanpaNol(semuaBon(sampai)), stok: tanpaNol(semuaStok(sampai)) };
}

const rapikan = (isi) => ({
  laci: isi.laci,
  bon: Object.fromEntries(Object.entries(isi.bon).filter(([, n]) => n !== 0)),
  stok: Object.fromEntries(Object.entries(isi.stok).filter(([, n]) => n !== 0)),
});

function periksaSemuaHari(ringkasan, daftar) {
  for (let t = "2026-08-30"; t <= HARI_INI; t = geserTanggal(t, 1)) {
    expect(rapikan(isiAkhirHari(ringkasan, t)), t).toEqual(dariNol(daftar, t));
  }
}

describe("fungsi murni", () => {
  test("dibangun sekali sama dengan menghitung dari nol di setiap tanggal", () => {
    periksaSemuaHari(bangunRingkasan({}, catatan, "2026-01-01", HARI_INI), catatan);
  });

  test("angka akhir sesuai rancangan", () => {
    const isi = isiAkhirHari(bangunRingkasan({}, catatan, "2026-01-01", HARI_INI), HARI_INI);
    expect(isi.laci).toBe(1146000);
    expect(isi.bon.budi).toBe(53000);
    expect(isi.stok.indomie).toBe(87);
  });

  test("catatan terhapus di tanggal lama: hitung ulang sama dengan dari nol", () => {
    const lama = bangunRingkasan({}, catatan, "2026-01-01", HARI_INI);
    const target = catatan.find((c) => tanggalCatatan(c) === "2026-10-10");
    const sesudah = catatan.map((c) => (c === target ? { ...c, deleted: true } : c));
    const baru = bangunRingkasan(lama, sesudah, "2026-10-10", HARI_INI);
    periksaSemuaHari(baru, sesudah.filter((c) => !c.deleted));
  });

  test("catatan baru di tanggal lama: hitung ulang sama dengan dari nol", () => {
    const lama = bangunRingkasan({}, catatan, "2026-01-01", HARI_INI);
    const tambahan = { id: "baru", waktu: new Date(2026, 9, 25, 10).getTime(), dari: "pembeli", ke: "bon", pelanggan_id: "sari", nominal: 7000, item: [{ barang_id: "teh", jumlah: 1, harga: 7000, modal: 6000 }] };
    const sesudah = [...catatan, tambahan];
    periksaSemuaHari(bangunRingkasan(lama, sesudah, "2026-10-25", HARI_INI), sesudah);
  });

  test("hitung ulang berkali-kali secara acak tetap sama dengan dari nol", () => {
    // Pengacak sederhana dengan benih tetap, supaya hasil tes selalu sama
    let benih = 12345;
    const acak = (n) => (benih = (benih * 1103515245 + 12345) & 0x7fffffff) % n;
    let daftar = [...catatan];
    let ringkasan = bangunRingkasan({}, daftar, "2026-01-01", HARI_INI);
    for (let i = 0; i < 40; i++) {
      const pilih = acak(daftar.length);
      const tanggal = tanggalCatatan(daftar[pilih]);
      if (acak(2)) daftar = daftar.filter((_, j) => j !== pilih);
      else daftar = [...daftar, { id: `a${i}`, waktu: daftar[pilih].waktu + 1000, dari: "pembeli", ke: "laci", nominal: 1000 + acak(5000), item: [] }];
      ringkasan = bangunRingkasan(ringkasan, daftar, tanggal, HARI_INI);
      periksaSemuaHari(ringkasan, daftar);
    }
  });
});

describe("dengan database", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: WAKTU_SEKARANG });
    await db.delete();
    await db.open();
    await db.catatan.bulkAdd(catatan);
  });
  afterEach(() => vi.useRealTimers());

  test("isi sekarang sama dengan menghitung dari nol", async () => {
    expect(rapikan(await isiSekarang())).toEqual(dariNol(catatan, HARI_INI));
  });

  test("bacaIsi memberi hasil yang sama tanpa menulis apa pun", async () => {
    expect(rapikan(await bacaIsi())).toEqual(dariNol(catatan, HARI_INI));
    expect(await db.meta.count()).toBe(0);
  });

  test("hari ini tidak ikut disimpan, kemarin disimpan", async () => {
    await isiSekarang();
    const simpanan = (await db.meta.get("ringkasan")).nilai;
    expect(simpanan["2026-11-04"].laci).toBe(827000);
    expect(simpanan[HARI_INI]).toBeUndefined();
    expect((await db.meta.get("ringkasan_sampai")).nilai).toBe("2026-11-04");
  });

  test("perubahan di tanggal lama terbaca setelah ditandai", async () => {
    await isiSekarang();
    const target = catatan.find((c) => c.dari === "laci" && c.ke === "pemilik");
    await db.catatan.update(target.id, { deleted: true });
    await tandaiBerubah(target.waktu);
    const isi = await isiSekarang();
    expect(isi.laci).toBe(1146000 + 1200000);
    expect((await db.meta.get("ringkasan_ulang"))).toBeUndefined();
  });

  test("ganti hari: hari kemarin masuk ringkasan", async () => {
    await isiSekarang();
    vi.setSystemTime(new Date(2026, 10, 6, 8, 0));
    expect((await isiSekarang()).laci).toBe(1146000);
    expect((await db.meta.get("ringkasan")).nilai[HARI_INI].laci).toBe(1146000);
  });

  test("ringkasan rusak atau hilang bisa dibangun ulang", async () => {
    await isiSekarang();
    await aturMeta("ringkasan", {});
    await aturMeta("ringkasan_sampai", null);
    expect(rapikan(await isiSekarang())).toEqual(dariNol(catatan, HARI_INI));
  });
});
