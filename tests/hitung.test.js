import { describe, test, expect } from "vitest";
import { catatan, HARI_INI } from "./fixture.js";
import {
  isiTempat, stokBarang, semuaBon, untung, rincianUntung, ringkasanHari, ringkasanMinggu, ringkasanBulan,
  arusLaci, arusWarung, bolehDihapus, catatanBelanja, hargaBeliSetelahHapus, arahStok, palingLaku,
} from "../src/data/hitung.js";

const cari = (keterangan) => catatan.find((c) => c.keterangan === keterangan);

describe("angka rancangan bagian 7", () => {
  test("isi laci dan bon", () => {
    expect(isiTempat(catatan, "laci")).toBe(1146000);
    expect(isiTempat(catatan, "bon")).toBe(265000);
    expect(isiTempat(catatan, "bon", "sari")).toBe(120000);
    expect(isiTempat(catatan, "bon", "budi")).toBe(53000);
    expect(isiTempat(catatan, "bon", "dedi")).toBe(52000);
    expect(isiTempat(catatan, "bon", "rina")).toBe(40000);
  });

  test("laporan hari", () => {
    const h = ringkasanHari(catatan, HARI_INI);
    expect(h).toMatchObject({ untung: 56000, hasil: 412000, modal: 336000, biaya: 20000, laciPagi: 827000, laciAkhir: 1146000, masuk: 404000, keluar: 85000 });
    expect(h.terakhir[0].keterangan).toBe("Bayar plastik");
    expect(h.terakhir).toHaveLength(7);
  });

  test("laporan minggu", () => {
    const m = ringkasanMinggu(catatan, HARI_INI, HARI_INI);
    expect(m).toMatchObject({ untung: 224000, hasil: 1613000, modal: 1329000, biaya: 60000, laciAwal: 956000, laciAkhir: 1146000, masuk: 1600000, keluar: 1410000, bonAwal: 252000, bonAkhir: 265000 });
    expect(m.perHari.map((h) => h.untung)).toEqual([58000, 61000, 49000, 56000, null, null, null]);
    expect(m.terbaik.nama).toBe("Sel");
  });

  test("laporan bulan Oktober", () => {
    const b = ringkasanBulan(catatan, "2026-10-15", HARI_INI);
    expect(b).toMatchObject({ untung: 2050000, biaya: 820000, diambilPribadi: 1200000, selisihLaci: -12000, bonAwal: 190000, bonAkhir: 252000, untungBulanLalu: 1814000, persenDariBulanLalu: 13 });
    expect(b.perMinggu.map((m) => [m.label, m.untung])).toEqual([["1–7", 431000], ["8–14", 492000], ["15–21", 522000], ["22–31", 605000]]);
    expect(b.terbaik.label).toBe("22–31");
    expect(b.palingLaku).toMatchObject({ nama: "Indomie", jumlah: 312 });
    expect(b.palingUntung).toMatchObject({ nama: "Rokok Surya", untung: 288000 });
  });

  test("minggu bulan berjalan yang belum terjadi kosong", () => {
    const b = ringkasanBulan(catatan, HARI_INI, HARI_INI);
    expect(b.perMinggu.map((m) => m.untung)).toEqual([224000, null, null, null]);
    expect(b.perMinggu[3].label).toBe("22–30");
  });
});

describe("stok", () => {
  test("arah setiap kejadian di rancangan bagian 2", () => {
    expect(arahStok({ dari: "pembeli", ke: "laci" })).toBe(-1);
    expect(arahStok({ dari: "pembeli", ke: "bon" })).toBe(-1);
    expect(arahStok({ dari: "laci", ke: "agen" })).toBe(1);
    expect(arahStok({ dari: "pemilik", ke: "stok" })).toBe(1);
    expect(arahStok({ dari: "stok", ke: "biaya" })).toBe(-1);
    expect(arahStok({ dari: "bon", ke: "laci" })).toBe(0);
    expect(arahStok({ dari: "laci", ke: "bon" })).toBe(0);
  });

  test("stok dari fixture", () => {
    expect(stokBarang(catatan, "indomie")).toBe(87);
    expect(stokBarang(catatan, "rokok")).toBe(29);
    expect(stokBarang(catatan, "gula")).toBe(74);
    expect(stokBarang(catatan, "tidak-ada")).toBe(0);
  });
});

describe("rumus", () => {
  test("catatan yang dihapus tidak dihitung", () => {
    const c = { id: "x", waktu: 1, dari: "pembeli", ke: "laci", nominal: 5000, item: [{ barang_id: "a", jumlah: 1, harga: 5000, modal: 4000 }] };
    expect(isiTempat([c], "laci")).toBe(5000);
    expect(isiTempat([{ ...c, deleted: true }], "laci")).toBe(0);
    expect(stokBarang([{ ...c, deleted: true }], "a")).toBe(0);
    expect(untung([{ ...c, deleted: true }])).toBe(0);
  });

  test("koreksi stok masuk biaya, uang pemilik dan pinjaman bukan untung", () => {
    const daftar = [
      { id: "1", waktu: 1, dari: "stok", ke: "biaya", nominal: 3000, item: [{ barang_id: "a", jumlah: 1, harga: 3000, modal: 3000 }] },
      { id: "2", waktu: 2, dari: "pemilik", ke: "laci", nominal: 100000 },
      { id: "3", waktu: 3, dari: "laci", ke: "bon", pelanggan_id: "b", nominal: 20000 },
      { id: "4", waktu: 4, dari: "laci", ke: "selisih", nominal: 500 },
    ];
    expect(rincianUntung(daftar)).toEqual({ hasil: 0, modal: 0, biaya: 3000, untung: -3000, jualanTanpaModal: 0 });
  });

  test("menghapus catatan otomatis membatalkan akibatnya", () => {
    const sisa = catatan.filter((c) => c.keterangan !== "Bayar plastik");
    expect(isiTempat(sisa, "laci")).toBe(1166000);
    expect(untung(sisa, { dari: HARI_INI, sampai: HARI_INI })).toBe(76000);
  });
});

describe("bolehDihapus", () => {
  const nama = (id) => ({ b: "Budi" })[id];
  const stokAwal = { id: "s", waktu: 1, dari: "pemilik", ke: "stok", nominal: 0, item: [{ barang_id: "kopi", nama: "Kopi", jumlah: 2 }] };
  const jual = (id, waktu) => ({ id, waktu, dari: "pembeli", ke: "laci", nominal: 2000, item: [{ barang_id: "kopi", nama: "Kopi", jumlah: 1, harga: 2000, modal: 1500 }] });

  test("stok jadi minus: ditolak dengan alasan", () => {
    const daftar = [stokAwal, jual("j", 2)];
    const hasil = bolehDihapus(stokAwal, daftar);
    expect(hasil.boleh).toBe(false);
    expect(hasil.alasan).toContain("Stok Kopi");
    expect(hasil.alasan).toContain("Koreksi stok");
  });

  test("bon jadi minus: ditolak dengan nama pelanggan", () => {
    const kasbon = { id: "k", waktu: 1, dari: "pembeli", ke: "bon", pelanggan_id: "b", nominal: 10000 };
    const bayar = { id: "y", waktu: 2, dari: "bon", ke: "laci", pelanggan_id: "b", nominal: 10000 };
    const hasil = bolehDihapus(kasbon, [kasbon, bayar], nama);
    expect(hasil.boleh).toBe(false);
    expect(hasil.alasan).toContain("Bon Budi");
    expect(bolehDihapus(bayar, [kasbon, bayar], nama).boleh).toBe(true);
  });

  test("hapus jualan biasa boleh", () => {
    expect(bolehDihapus(jual("j", 2), [stokAwal, jual("j", 2)]).boleh).toBe(true);
  });

  test("laci jadi minus: ditolak dengan pesan dan jumlahnya", () => {
    const awal = { id: "a", waktu: 1, dari: "pemilik", ke: "laci", nominal: 100000 };
    const keluar = { id: "k", waktu: 2, dari: "laci", ke: "biaya", nominal: 130000 };
    const pribadi = { id: "p", waktu: 2, dari: "pemilik", ke: "laci", nominal: 30000 };
    const daftar = [awal, pribadi, keluar];
    expect(bolehDihapus(pribadi, daftar)).toEqual({ boleh: false, jenis: "laci", alasan: "Tidak bisa dihapus, isi laci akan jadi −Rp 30.000. Pakai Hitung ulang kalau uangnya memang beda." });
    expect(bolehDihapus(keluar, daftar).boleh).toBe(true);
  });

  test("laci tepat nol setelah dihapus: boleh", () => {
    const awal = { id: "a", waktu: 1, dari: "pemilik", ke: "laci", nominal: 5000 };
    expect(bolehDihapus(awal, [awal]).boleh).toBe(true);
  });

  test("laci yang sudah minus tetap boleh dikurangi minusnya, tapi tidak boleh makin minus", () => {
    const keluar = { id: "k", waktu: 1, dari: "laci", ke: "biaya", nominal: 9000 };
    const masuk = { id: "m", waktu: 2, dari: "pembeli", ke: "laci", nominal: 4000 };
    expect(isiTempat([keluar, masuk], "laci")).toBe(-5000);
    expect(bolehDihapus(keluar, [keluar, masuk]).boleh).toBe(true);
    expect(bolehDihapus(masuk, [keluar, masuk]).alasan).toContain("−Rp 9.000");
  });

  test("stok yang sudah minus tetap boleh dikurangi minusnya", () => {
    const daftar = [stokAwal, jual("1", 2), jual("2", 3), jual("3", 4), jual("4", 5)];
    expect(stokBarang(daftar, "kopi")).toBe(-2);
    expect(bolehDihapus(jual("1", 2), daftar).boleh).toBe(true);
    expect(bolehDihapus(stokAwal, daftar).boleh).toBe(false);
  });
});

describe("jualan tanpa modal", () => {
  test("data contoh: hari dan minggu nol, Oktober dan September sesuai jualan Lainnya", () => {
    expect(ringkasanHari(catatan, HARI_INI).jualanTanpaModal).toBe(0);
    expect(ringkasanMinggu(catatan, HARI_INI, HARI_INI).jualanTanpaModal).toBe(0);
    expect(ringkasanBulan(catatan, "2026-10-15", HARI_INI).jualanTanpaModal).toBe(2426000);
    expect(ringkasanBulan(catatan, "2026-09-15", HARI_INI).jualanTanpaModal).toBe(1814000);
  });

  const jual = (nominal, item = []) => ({ id: String(nominal), waktu: 1, dari: "pembeli", ke: "laci", nominal, item });

  test("Lainnya kosong: untung penuh dan masuk jualan tanpa modal", () => {
    expect(rincianUntung([jual(5000)])).toMatchObject({ untung: 5000, jualanTanpaModal: 5000 });
  });

  test("Lainnya dengan modal, termasuk modal nol: tidak termasuk jualan tanpa modal", () => {
    const item = (modal) => [{ barang_id: null, nama: "Gorengan", jumlah: 1, harga: 5000, modal }];
    expect(rincianUntung([jual(5000, item(3000))])).toMatchObject({ untung: 2000, jualanTanpaModal: 0 });
    expect(rincianUntung([jual(5000, item(0))])).toMatchObject({ untung: 5000, jualanTanpaModal: 0 });
  });

  test("barang lama tanpa modal ikut terhitung, barang bermodal tidak", () => {
    const daftar = [
      jual(10000, [{ barang_id: "a", nama: "A", jumlah: 2, harga: 5000, modal: null }]),
      jual(7000, [{ barang_id: "b", nama: "B", jumlah: 1, harga: 7000, modal: 6000 }]),
    ];
    expect(rincianUntung(daftar)).toMatchObject({ hasil: 17000, modal: 6000, jualanTanpaModal: 10000 });
  });

  test("satu catatan campuran: hanya bagian Lainnya yang terhitung", () => {
    const c = jual(9000, [{ barang_id: "b", nama: "B", jumlah: 1, harga: 7000, modal: 6000 }]);
    expect(rincianUntung([c]).jualanTanpaModal).toBe(2000);
  });

  test("Lainnya tidak ikut peringkat paling laku", () => {
    const c = jual(5000, [{ barang_id: null, nama: "Gorengan", jumlah: 50, harga: 100, modal: 50 }]);
    expect(palingLaku([c])).toBeNull();
  });
});

describe("arusWarung: kapsul Hari ini", () => {
  const WAKTU = new Date(2026, 10, 5, 9, 0).getTime();
  const c = (dari, ke, nominal, lain = {}) => ({ dari, ke, nominal, waktu: WAKTU, ...lain });

  test("masuk: pembeli → laci dan bon → laci", () => {
    expect(arusWarung([c("pembeli", "laci", 20000), c("bon", "laci", 5000)])).toEqual({ masuk: 25000, keluar: 0 });
  });

  test("keluar: laci → agen, biaya, dan bon (pinjaman)", () => {
    expect(arusWarung([c("laci", "agen", 50000), c("laci", "biaya", 10000), c("laci", "bon", 3000)])).toEqual({ masuk: 0, keluar: 63000 });
  });

  test("uang pemilik dan selisih tidak dihitung, ke arah mana pun", () => {
    const daftar = [c("pemilik", "laci", 100000), c("laci", "pemilik", 40000), c("selisih", "laci", 2000), c("laci", "selisih", 6000)];
    expect(arusWarung(daftar)).toEqual({ masuk: 0, keluar: 0 });
  });

  test("yang tidak menyentuh laci tidak dihitung: jual bon, stok", () => {
    expect(arusWarung([c("pembeli", "bon", 28000), c("pemilik", "stok", 9000), c("stok", "biaya", 1000), c("pemilik", "bon", 7000)])).toEqual({ masuk: 0, keluar: 0 });
  });

  test("hari pertama: uang awal bukan pemasukan, isi laci tetap memakainya", () => {
    const daftar = [c("pemilik", "laci", 350000), c("pembeli", "laci", 28500)];
    expect(arusWarung(daftar)).toEqual({ masuk: 28500, keluar: 0 });
    expect(isiTempat(daftar, "laci")).toBe(378500);
  });

  test("belanja melebihi laci: keluar sebesar belanjanya, uang pribadi tidak dihitung masuk", () => {
    const daftar = [c("pemilik", "laci", 100000), ...catatanBelanja(150000, 100000).map((x) => ({ ...x, waktu: WAKTU }))];
    expect(arusWarung(daftar)).toEqual({ masuk: 0, keluar: 150000 });
    expect(isiTempat(daftar, "laci")).toBe(0);
  });

  test("laporan tetap memakai semua arus laci", () => {
    const daftar = [c("pemilik", "laci", 100000), c("laci", "pemilik", 40000), c("pembeli", "laci", 20000)];
    expect(arusLaci(daftar)).toEqual({ masuk: 120000, keluar: 40000 });
  });

  test("catatan terhapus dan hari lain tidak dihitung", () => {
    const daftar = [c("pembeli", "laci", 20000, { deleted: true }), c("pembeli", "laci", 7000), c("pembeli", "laci", 9000, { waktu: new Date(2026, 10, 4, 9, 0).getTime() })];
    expect(arusWarung(daftar, { dari: HARI_INI, sampai: HARI_INI })).toEqual({ masuk: 7000, keluar: 0 });
  });
});

describe("catatanBelanja", () => {
  test("cukup: satu catatan", () => {
    expect(catatanBelanja(50000, 80000)).toEqual([{ dari: "laci", ke: "agen", nominal: 50000 }]);
    expect(catatanBelanja(80000, 80000)).toHaveLength(1);
  });

  test("melebihi laci: pemilik → laci dulu, lalu laci → agen", () => {
    const [masuk, keluar] = catatanBelanja(100000, 30000);
    expect(masuk).toMatchObject({ dari: "pemilik", ke: "laci", nominal: 70000 });
    expect(keluar).toEqual({ dari: "laci", ke: "agen", nominal: 100000 });
    expect(30000 + masuk.nominal - keluar.nominal).toBe(0);
  });

  test("laci yang sudah minus tidak menambah kekurangan yang keliru", () => {
    expect(catatanBelanja(100000, -5000)[0].nominal).toBe(100000);
  });
});

describe("harga beli setelah belanja dihapus", () => {
  const belanja = (id, waktu, harga, modal) => ({ id, waktu, dari: "laci", ke: "agen", nominal: harga, item: [{ barang_id: "g", jumlah: 1, harga, modal }] });

  test("belanja terbaru: kembali ke harga sebelumnya", () => {
    const a = belanja("a", 1, 50000, 15000);
    expect(hargaBeliSetelahHapus(a, [a], 50000)).toEqual({ hargaBeli: 15000 });
  });

  test("harga beli sudah diubah tangan: tidak disentuh", () => {
    const a = belanja("a", 1, 16000, 15000);
    expect(hargaBeliSetelahHapus(a, [a], 17000)).toEqual({});
  });

  test("belanja lama: harga tetap, belanja berikut mewarisi", () => {
    const a = belanja("a", 1, 20000, 15000);
    const b = belanja("b", 2, 30000, 20000);
    const { hargaBeli, belanjaBerikut } = hargaBeliSetelahHapus(a, [a, b], 30000);
    expect(hargaBeli).toBeUndefined();
    expect(belanjaBerikut.item[0].modal).toBe(15000);
    expect(hargaBeliSetelahHapus(belanjaBerikut, [belanjaBerikut], 30000)).toEqual({ hargaBeli: 15000 });
  });

  test("bukan belanja: tidak ada efek", () => {
    expect(hargaBeliSetelahHapus({ id: "j", waktu: 1, ke: "laci", item: [] }, [], 100)).toEqual({});
  });
});

test("semuaBon mencakup semua pelanggan", () => {
  expect([...semuaBon(catatan).values()].reduce((a, b) => a + b, 0)).toBe(265000);
});
