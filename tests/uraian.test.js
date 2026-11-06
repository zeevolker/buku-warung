import { test, expect } from "vitest";
import { uraiCatatan, akibatCatatan, labelWaktu } from "../src/data/uraian.js";

const barang = (nama, jumlah = 1, harga = 1000, modal = 800) => ({ barang_id: nama, nama, jumlah, harga, modal });

test("judul dan tanda setiap kejadian (contoh mockup)", () => {
  const kasus = [
    [{ dari: "pembeli", ke: "laci", nominal: 36000, item: [barang("Minyak goreng", 2)] }, "Minyak goreng ×2", "masuk", "+36.000"],
    [{ dari: "pembeli", ke: "laci", nominal: 11000, item: [barang("Indomie"), barang("Teh")] }, "Indomie, Teh", "masuk", "+11.000"],
    [{ dari: "pembeli", ke: "bon", nominal: 28000, item: [barang("Rokok")] }, "Rokok · bon Budi", "netral", "28.000"],
    [{ dari: "pembeli", ke: "laci", nominal: 5000, keterangan: "Gorengan", item: [] }, "Gorengan", "masuk", "+5.000"],
    [{ dari: "pembeli", ke: "laci", nominal: 5000, item: [] }, "Penjualan lain", "masuk", "+5.000"],
    [{ dari: "bon", ke: "laci", nominal: 20000 }, "Budi bayar bon", "masuk", "+20.000"],
    [{ dari: "laci", ke: "bon", nominal: 20000 }, "Budi pinjam uang", "keluar", "−20.000"],
    [{ dari: "laci", ke: "agen", nominal: 65000, item: [barang("Gula", 5)] }, "Belanja Gula ×5", "keluar", "−65.000"],
    [{ dari: "laci", ke: "biaya", nominal: 20000, keterangan: "Bayar plastik" }, "Bayar plastik", "keluar", "−20.000"],
    [{ dari: "laci", ke: "biaya", nominal: 20000 }, "Biaya warung", "keluar", "−20.000"],
    [{ dari: "pemilik", ke: "laci", nominal: 500000 }, "Uang awal", "masuk", "+500.000"],
    [{ dari: "laci", ke: "pemilik", nominal: 100000 }, "Ambil pribadi", "keluar", "−100.000"],
    [{ dari: "laci", ke: "selisih", nominal: 6000 }, "Hitung ulang laci", "keluar", "−6.000"],
    [{ dari: "selisih", ke: "laci", nominal: 6000 }, "Hitung ulang laci", "masuk", "+6.000"],
    [{ dari: "pemilik", ke: "stok", nominal: 3000, item: [barang("Kopi", 2)] }, "Tambah stok Kopi ×2", "netral", "3.000"],
    [{ dari: "stok", ke: "biaya", nominal: 3000, item: [barang("Kopi", 2)] }, "Koreksi stok Kopi ×2", "netral", "3.000"],
    [{ dari: "pemilik", ke: "bon", nominal: 50000 }, "Bon lama Budi", "netral", "50.000"],
  ];
  for (const [c, judul, tanda, angka] of kasus) expect(uraiCatatan(c, "Budi")).toEqual({ judul, tanda, angka });
});

test("akibat jual bon sesuai mockup Rincian", () => {
  const c = { dari: "pembeli", ke: "bon", nominal: 28000, item: [barang("Rokok", 1, 28000, 25000)] };
  expect(akibatCatatan(c, "Budi")).toEqual([
    { label: "Bon Budi", nilai: "+28.000" },
    { label: "Stok Rokok", nilai: "−1" },
    { label: "Untung", nilai: "+3.000" },
  ]);
});

test("akibat lainnya", () => {
  expect(akibatCatatan({ dari: "laci", ke: "agen", nominal: 65000, item: [barang("Gula", 5)] })).toEqual([
    { label: "Laci", nilai: "−65.000" },
    { label: "Stok Gula", nilai: "+5" },
  ]);
  expect(akibatCatatan({ dari: "bon", ke: "laci", nominal: 20000 }, "Budi")).toEqual([
    { label: "Laci", nilai: "+20.000" },
    { label: "Bon Budi", nilai: "−20.000" },
  ]);
  expect(akibatCatatan({ dari: "laci", ke: "biaya", nominal: 20000 })).toEqual([
    { label: "Laci", nilai: "−20.000" },
    { label: "Untung", nilai: "−20.000" },
  ]);
  expect(akibatCatatan({ dari: "pemilik", ke: "laci", nominal: 1000 })).toEqual([{ label: "Laci", nilai: "+1.000" }]);
});

test("label waktu", () => {
  const c = { waktu: new Date(2026, 10, 5, 9, 30).getTime() };
  expect(labelWaktu(c, "2026-11-05")).toBe("Hari ini, 09.30");
  expect(labelWaktu({ waktu: new Date(2026, 10, 4, 10, 5).getTime() }, "2026-11-05")).toBe("Rabu, 4 Nov, 10.05");
});
