import { describe, test, expect } from "vitest";
import { catatan, barang, pelanggan, HARI_INI } from "./fixture.js";
import { isiTempat, persenPerubahan, ringkasanBulan, ringkasanHari, ringkasanMinggu, rincianUntung, selisihLaci, sampaiTanggal } from "../src/data/hitung.js";
import { alamatSah, bagiBlok, barangRusakHilang, bonPerPelanggan, judulDokumen, kalenderBulan, labelRentang, rentangLaporan, rincianArusLaci, ringkasanBarang, stokDiBawahBatas, tingkatKalender } from "../src/data/laporan.js";

const namaDari = (id) => pelanggan.find((p) => p.id === id)?.nama || "pelanggan";
const RENTANG = [
  ["hari", { dari: HARI_INI, sampai: HARI_INI }],
  ["minggu", { dari: "2026-11-02", sampai: "2026-11-08" }],
  ["oktober", { dari: "2026-10-01", sampai: "2026-10-31" }],
  ["september", { dari: "2026-09-01", sampai: "2026-09-30" }],
];

describe.each(RENTANG)("periode %s", (_, rentang) => {
  const hariSebelum = new Date(new Date(`${rentang.dari}T00:00:00`).getTime() - 1);
  const sebelum = `${hariSebelum.getFullYear()}-${String(hariSebelum.getMonth() + 1).padStart(2, "0")}-${String(hariSebelum.getDate()).padStart(2, "0")}`;
  const isiPada = (t, tempat) => isiTempat(sampaiTanggal(catatan, t), tempat);

  test("total barang terlaris = hasil jualan, dan untungnya = hasil − modal", () => {
    const r = rincianUntung(catatan, rentang);
    const b = ringkasanBarang(catatan, rentang);
    expect(b.total.jualan).toBe(r.hasil);
    expect(b.total.untung).toBe(r.hasil - r.modal);
    const baris = [...b.teratas, b.lain, b.tanpaBarang];
    expect(baris.reduce((n, x) => n + x.jualan, 0)).toBe(r.hasil);
    expect(baris.reduce((n, x) => n + x.untung, 0)).toBe(b.total.untung);
  });

  test("bon per pelanggan: total cocok dengan bon awal dan akhir", () => {
    const bon = bonPerPelanggan(catatan, rentang, namaDari);
    expect(bon.total.awal).toBe(isiPada(sebelum, "bon"));
    expect(bon.total.sisa).toBe(isiPada(rentang.sampai, "bon"));
    expect(bon.total.awal + bon.total.tambah - bon.total.bayar).toBe(bon.total.sisa);
    for (const b of bon.daftar) expect(b.awal + b.tambah - b.bayar).toBe(b.sisa);
  });

  test("arus laci: awal + masuk − keluar = akhir, dan rinciannya utuh", () => {
    const a = rincianArusLaci(catatan, rentang);
    expect(isiPada(sebelum, "laci") + a.masuk - a.keluar).toBe(isiPada(rentang.sampai, "laci"));
    expect(a.jualanTunai + a.bonDibayar + a.uangPribadi + a.selisihMasuk + a.lainMasuk).toBe(a.masuk);
    expect(a.belanjaAgen + a.biaya + a.pinjaman + a.ambilPribadi + a.selisihKeluar + a.lainKeluar).toBe(a.keluar);
    expect(a.selisihMasuk - a.selisihKeluar).toBe(selisihLaci(catatan, rentang));
  });
});

describe("cocok dengan layar Laporan", () => {
  test("hari, minggu, bulan memakai masuk dan keluar yang sama", () => {
    const h = ringkasanHari(catatan, HARI_INI);
    expect(rincianArusLaci(catatan, { dari: HARI_INI, sampai: HARI_INI })).toMatchObject({ masuk: h.masuk, keluar: h.keluar });
    const m = ringkasanMinggu(catatan, HARI_INI, HARI_INI);
    expect(rincianArusLaci(catatan, m)).toMatchObject({ masuk: m.masuk, keluar: m.keluar });
    const b = ringkasanBulan(catatan, "2026-10-15", HARI_INI);
    expect(rincianArusLaci(catatan, b)).toMatchObject({ masuk: b.masuk, keluar: b.keluar });
    expect(b.laciAwal + b.masuk - b.keluar).toBe(b.laciAkhir);
    expect(bonPerPelanggan(catatan, b).total).toMatchObject({ awal: b.bonAwal, sisa: b.bonAkhir });
  });

  test("hasil jualan per hari ikut di grafik minggu", () => {
    const m = ringkasanMinggu(catatan, HARI_INI, HARI_INI);
    expect(m.perHari[0].hasil).toBe(400000);
    expect(m.perHari[6].hasil).toBeNull();
  });
});

describe("ringkasanBarang", () => {
  const OKTOBER = { dari: "2026-10-01", sampai: "2026-10-31" };

  test("urut menurut jualan, sisanya jadi Barang lain", () => {
    const b = ringkasanBarang(catatan, { dari: "2026-11-01", sampai: "2026-11-30" }, 2);
    expect(b.teratas).toHaveLength(2);
    expect(b.teratas[0].nama).toBe("Beras karung");
    expect(b.lain.jenis).toBe(b.daftar.length - 2);
  });

  test("jualan tanpa barang jadi baris sendiri, bukan hilang", () => {
    expect(ringkasanBarang(catatan, OKTOBER).tanpaBarang.jualan).toBeGreaterThan(0);
  });
});

test("persenPerubahan: naik, turun, dan periode lalu tidak positif", () => {
  expect(persenPerubahan(150, 100)).toBe(50);
  expect(persenPerubahan(50, 100)).toBe(-50);
  expect(persenPerubahan(50, 0)).toBeNull();
  expect(persenPerubahan(50, -10)).toBeNull();
  expect(ringkasanBulan(catatan, "2026-10-15", HARI_INI).persenDariBulanLalu).toBe(persenPerubahan(2050000, 1814000));
});

describe("kalender", () => {
  test("tingkat dari kuartil", () => {
    expect(tingkatKalender([10, 20, 30, 40, 50, 60, 70, 80])).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect(tingkatKalender([])).toEqual([]);
  });

  test("semua sama: tingkat paling rendah", () => {
    expect(tingkatKalender([5, 5, 5])).toEqual([0, 0, 0]);
  });

  test("susunan Senin sampai Minggu, hari depan dan hari tanpa catatan kosong", () => {
    const k = kalenderBulan(catatan, HARI_INI, HARI_INI);
    expect(k.minggu[0].slice(0, 6)).toEqual([null, null, null, null, null, null]); // 1 Nov 2026 hari Minggu
    expect(k.minggu[0][6]).toMatchObject({ angka: 1, tingkat: null });
    expect(k.minggu[1][0]).toMatchObject({ tanggal: "2026-11-02", untung: 58000 });
    expect(k.minggu.flat().filter(Boolean)).toHaveLength(30);
    expect(k.minggu.flat().filter(Boolean).find((h) => h.angka === 6).tingkat).toBeNull();
    expect(k.terbaik.tanggal).toBe("2026-11-03");
  });
});

test("barang rusak atau hilang dan stok di bawah batas", () => {
  const rusak = [{ id: "r", waktu: new Date(2026, 10, 5, 9).getTime(), dari: "stok", ke: "biaya", nominal: 3000, item: [] }];
  expect(barangRusakHilang([...catatan, ...rusak], { dari: HARI_INI, sampai: HARI_INI })).toBe(3000);
  const daftar = stokDiBawahBatas([{ id: "indomie", nama: "Indomie", batas_hampir_habis: 100000 }, { id: "hapus", nama: "Dihapus", deleted: true }, { id: "beras", nama: "Beras", batas_hampir_habis: 0 }], catatan);
  expect(daftar.map((b) => b.nama)).toEqual(["Indomie"]);
  expect(barang.length).toBeGreaterThan(0);
});

test("judul file dan label periode", () => {
  expect(judulDokumen("minggu", rentangLaporan("minggu", "2026-11-05"))).toBe("Buku Warung - Mingguan 2-8 Nov 2026");
  expect(judulDokumen("hari", rentangLaporan("hari", "2026-11-05"))).toBe("Buku Warung - Harian 5 Nov 2026");
  expect(judulDokumen("bulan", rentangLaporan("bulan", "2026-11-05"))).toBe("Buku Warung - Bulanan November 2026");
  expect(labelRentang("2026-11-30", "2026-12-06")).toBe("30 Nov–6 Des 2026");
  expect(labelRentang("2026-12-28", "2027-01-03")).toBe("28 Des 2026–3 Jan 2027");
});

test("alamat cetak yang sah", () => {
  expect(alamatSah("hari", "2026-11-05")).toBe(true);
  expect(alamatSah("tahun", "2026-11-05")).toBe(false);
  expect(alamatSah("hari", "kemarin")).toBe(false);
  expect(alamatSah("hari", "2026-02-31")).toBe(false);
});

describe("bagiBlok", () => {
  const RUANG = { ruangPertama: 100, ruang: 200 };
  const utuh = (tinggi) => ({ tinggi });
  const tabel = (n, isi = {}) => ({ baris: Array.from({ length: n }, (_, i) => ({ kunci: i, tinggi: 30 })), tinggiKepala: 40, ...isi });
  const barisDari = (hal) => hal.flat().flatMap((b) => b.baris || []).map((b) => b.kunci);

  test("blok utuh pindah kalau tidak muat, halamanBaru memaksa pindah", () => {
    expect(bagiBlok([utuh(60), utuh(60)], RUANG).map((h) => h.length)).toEqual([1, 1]);
    expect(bagiBlok([utuh(10), { halamanBaru: true }, utuh(10)], RUANG)).toHaveLength(2);
    expect(bagiBlok([{ halamanBaru: true }, utuh(10)], RUANG)).toHaveLength(1);
  });

  test("tabel panjang terbagi tanpa baris hilang atau ganda, kepala di tiap potongan", () => {
    const hal = bagiBlok([tabel(20)], RUANG);
    expect(barisDari(hal)).toEqual(Array.from({ length: 20 }, (_, i) => i));
    hal.forEach((h, i) => {
      const dipakai = h.reduce((n, b) => n + 40 + b.baris.length * 30, 0);
      expect(dipakai).toBeLessThanOrEqual(i === 0 ? 100 : 200);
    });
    expect(hal[0][0].lanjutan).toBe(false);
    expect(hal[1][0].lanjutan).toBe(true);
    expect(hal.at(-1)[0].selesai).toBe(true);
  });

  test("baris total selalu punya teman di halaman yang sama", () => {
    // 2 baris pas memenuhi halaman pertama (40 + 60), jadi total tidak muat
    const hal = bagiBlok([tabel(2, { tinggiAkhir: 20 })], { ruangPertama: 100, ruang: 200 });
    expect(hal).toHaveLength(2);
    expect(hal[1][0].baris).toHaveLength(1);
    expect(hal[1][0].selesai).toBe(true);
  });

  test("tabel kosong tidak menghasilkan apa-apa", () => {
    expect(bagiBlok([tabel(0)], RUANG)).toEqual([[]]);
  });
});
