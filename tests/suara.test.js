import { describe, test, expect } from "vitest";
import { uraikanKalimat, bacaAngka } from "../src/data/suara.js";
// Pembanding: parser v3 yang sudah dipakai sungguhan
import { uraikanKalimat as uraikanV3 } from "../legacy/src/data/suara.js";

const barang = [
  { id: "indomie", nama: "Indomie" },
  { id: "teh", nama: "Teh botol" },
  { id: "kopi", nama: "Kopi" },
  { id: "gula", nama: "Gula" },
  { id: "minyak", nama: "Minyak Goreng" },
];
const pelanggan = [
  { id: "budi", nama: "Budi" },
  { id: "sari", nama: "Sari" },
];
const urai = (teks) => uraikanKalimat(teks, { barang, pelanggan });
const nama = (h) => h.item.map((b) => `${b.nama} ${b.jumlah}`);

describe("contoh di mockup", () => {
  test("jual dua indomie, satu teh botol", () => {
    const h = urai("jual dua indomie, satu teh botol");
    expect(h).toMatchObject({ jenis: "jual", bayar: "tunai", nominal: null, pelanggan_id: null, keterangan: "" });
    expect(nama(h)).toEqual(["Indomie 2", "Teh botol 1"]);
  });

  test("Budi bayar 20 ribu", () => {
    expect(urai("Budi bayar 20 ribu")).toMatchObject({ jenis: "terimaBon", bayar: null, nominal: 20000, pelanggan_id: "budi" });
  });

  test("belanja gula 65 ribu", () => {
    const h = urai("belanja gula 65 ribu");
    expect(h).toMatchObject({ jenis: "belanja", nominal: 65000 });
    expect(nama(h)).toEqual(["Gula 1"]);
  });

  test("Sari ngebon kopi", () => {
    const h = urai("Sari ngebon kopi");
    expect(h).toMatchObject({ jenis: "jual", bayar: "bon", pelanggan_id: "sari" });
    expect(nama(h)).toEqual(["Kopi 1"]);
  });

  test("jual 2 indomie", () => {
    expect(nama(urai("jual 2 indomie"))).toEqual(["Indomie 2"]);
  });

  test("eh yang biru tadi berapa ya: tidak dimengerti", () => {
    expect(urai("eh yang biru tadi berapa ya")).toMatchObject({ jenis: null, item: [], nominal: null, keterangan: "eh yang biru tadi berapa ya" });
  });
});

describe("kata kunci jenis", () => {
  test.each([
    ["laku kopi dua", "jual"],
    ["kopi dua terjual", "jual"],
    ["uang masuk 10 ribu", "jual"],
    ["beli gula 50 ribu", "belanja"],
    ["kulakan gula 50 ribu", "belanja"],
    ["bayar listrik 100 ribu", "biaya"],
    ["bayar air 30 ribu", "biaya"],
    ["bayar gas 20 ribu", "biaya"],
    ["bayar plastik 5 ribu", "biaya"],
    ["bayar sampah 10 ribu", "biaya"],
    ["Budi pinjam uang 50 ribu", "pinjaman"],
    ["bayar utang 20 ribu", "terimaBon"],
    ["bayar bon 20 ribu", "terimaBon"],
    ["Budi nyicil 20 ribu", "terimaBon"],
    ["Budi lunas", "terimaBon"],
    ["terima 10 ribu dari Budi", "terimaBon"],
    ["gorengan 5 ribu", "jual"],
    ["kopi tiga", "jual"],
  ])("%s → %s", (teks, jenis) => {
    expect(urai(teks).jenis).toBe(jenis);
  });

  test.each(["utang", "kasbon", "bon", "ngutang", "nanti"])("jual kopi %s → bayar bon", (kata) => {
    expect(urai(`jual kopi ${kata}`).bayar).toBe("bon");
  });

  test("jual biasa tunai, juga kalau bilang bayar sekarang", () => {
    expect(urai("jual kopi").bayar).toBe("tunai");
    expect(urai("jual kopi bayar sekarang")).toMatchObject({ jenis: "jual", bayar: "tunai", keterangan: "" });
  });

  test("pelanggan yang membeli adalah penjualan, bukan belanja warung", () => {
    expect(urai("Budi beli kopi dua")).toMatchObject({ jenis: "jual", pelanggan_id: "budi" });
  });
});

describe("angka", () => {
  test.each([
    ["10000", 10000],
    ["10.000", 10000],
    ["10rb", 10000],
    ["10 ribu", 10000],
    ["15k", 15000],
    ["1,5 juta", 1500000],
    ["2 jt", 2000000],
    ["sepuluh ribu", 10000],
    ["dua puluh lima ribu", 25000],
    ["seribu lima ratus", 1500],
    ["seratus", 100],
    ["sejuta", 1000000],
    ["setengah juta", 500000],
    ["Rp10.000", 10000],
    ["seratus lima puluh ribu", 150000],
    ["tiga", 3],
  ])("%s = %d", (teks, nilai) => {
    expect(bacaAngka(teks)).toBe(nilai);
  });

  test("tanpa angka: null", () => {
    for (const teks of ["", "halo", "ribu", null, undefined]) expect(bacaAngka(teks)).toBeNull();
  });
});

describe("jumlah dan nama", () => {
  test("jumlah sebelum atau sesudah nama, bawaan 1", () => {
    expect(nama(urai("jual dua kopi"))).toEqual(["Kopi 2"]);
    expect(nama(urai("kopi tiga"))).toEqual(["Kopi 3"]);
    expect(nama(urai("jual kopi"))).toEqual(["Kopi 1"]);
    expect(nama(urai("jual dua bungkus indomie"))).toEqual(["Indomie 2"]);
  });

  test("jumlah dan uang dibedakan", () => {
    const h = urai("belanja gula dua 50 ribu");
    expect(nama(h)).toEqual(["Gula 2"]);
    expect(h.nominal).toBe(50000);
    expect(urai("jual kopi tiga ribu").nominal).toBe(3000);
  });

  test("salah dengar ringan cocok, huruf besar kecil tidak dibedakan", () => {
    expect(nama(urai("JUAL INDOMI"))).toEqual(["Indomie 1"]);
    expect(nama(urai("jual gulla"))).toEqual(["Gula 1"]);
    expect(urai("budhi bayar 5 ribu").pelanggan_id).toBe("budi");
  });

  test("kalau ragu tidak dicocokkan, kata yang tersisa jadi keterangan", () => {
    const data = { barang: [{ id: "g", nama: "Indomie Goreng" }, { id: "s", nama: "Indomie Soto" }], pelanggan };
    expect(uraikanKalimat("jual indomie", data)).toMatchObject({ item: [], keterangan: "indomie" });
    expect(urai("jual roti 5 ribu")).toMatchObject({ item: [], nominal: 5000, keterangan: "roti" });
  });

  test("tanpa daftar barang dan pelanggan tetap berjalan", () => {
    expect(uraikanKalimat("uang masuk 10 ribu").nominal).toBe(10000);
  });
});

// Jenis v4 harus sama artinya dengan parser v3 untuk kalimat yang sama
test("hasilnya setara dengan parser v3", () => {
  const JENIS = (h) => (h.jenis === "bayar" ? "terimaBon" : h.jenis === "keluar" ? h.untuk : h.jenis);
  const kalimat = ["uang masuk 10 ribu", "jual dua indomie", "Budi utang kopi tiga", "belanja gula 50 ribu", "bayar listrik 100 ribu", "Budi bayar utang 20 ribu", "Budi minjam uang 50 ribu", "jual kopi dua indomie tiga", "halo apa kabar", "gorengan 5 ribu", "jual kopi nanti"];
  for (const teks of kalimat) {
    const baru = urai(teks);
    const lama = uraikanV3(teks, { barang, pelanggan });
    expect(baru.jenis, teks).toBe(JENIS(lama));
    expect(baru.item, teks).toEqual(lama.item);
    expect(baru.nominal, teks).toBe(lama.nominal);
    expect(baru.pelanggan_id, teks).toBe(lama.pelanggan_id);
    expect(baru.keterangan, teks).toBe(lama.keterangan);
    if (lama.jenis === "jual") expect(baru.bayar, teks).toBe(lama.dibayar === "nanti" ? "bon" : "tunai");
  }
});
