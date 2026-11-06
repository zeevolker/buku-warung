import { test } from "node:test";
import assert from "node:assert/strict";
import { uraikanKalimat, bacaAngka } from "../src/data/suara.js";

const barang = [
  { id: "indomie", nama: "Indomie" },
  { id: "kopi", nama: "Kopi" },
  { id: "gula", nama: "Gula" },
  { id: "minyak", nama: "Minyak Goreng" },
];
const pelanggan = [
  { id: "budi", nama: "Budi" },
  { id: "sari", nama: "Sari Wati" },
];
const urai = (teks, data = { barang, pelanggan }) => uraikanKalimat(teks, data);

// ---------- Semua contoh kalimat ----------

test("uang masuk 10 ribu: jual Lainnya", () => {
  assert.deepEqual(urai("uang masuk 10 ribu"), { jenis: "jual", dibayar: "sekarang", untuk: null, item: [], nominal: 10000, pelanggan_id: null, keterangan: "" });
});

test("jual dua indomie: jumlah di depan nama", () => {
  assert.deepEqual(urai("jual dua indomie"), {
    jenis: "jual",
    dibayar: "sekarang",
    untuk: null,
    item: [{ barang_id: "indomie", nama: "Indomie", jumlah: 2 }],
    nominal: null,
    pelanggan_id: null,
    keterangan: "",
  });
});

test("Budi utang kopi tiga: jual dibayar nanti, jumlah di belakang nama", () => {
  assert.deepEqual(urai("Budi utang kopi tiga"), {
    jenis: "jual",
    dibayar: "nanti",
    untuk: null,
    item: [{ barang_id: "kopi", nama: "Kopi", jumlah: 3 }],
    nominal: null,
    pelanggan_id: "budi",
    keterangan: "",
  });
});

test("belanja gula 50 ribu: keluar belanja, jumlah bawaan 1", () => {
  assert.deepEqual(urai("belanja gula 50 ribu"), {
    jenis: "keluar",
    dibayar: null,
    untuk: "belanja",
    item: [{ barang_id: "gula", nama: "Gula", jumlah: 1 }],
    nominal: 50000,
    pelanggan_id: null,
    keterangan: "",
  });
});

test("bayar listrik 100 ribu: keluar biaya, listrik jadi keterangan", () => {
  assert.deepEqual(urai("bayar listrik 100 ribu"), { jenis: "keluar", dibayar: null, untuk: "biaya", item: [], nominal: 100000, pelanggan_id: null, keterangan: "listrik" });
});

test("Budi bayar utang 20 ribu: terima bayar", () => {
  assert.deepEqual(urai("Budi bayar utang 20 ribu"), { jenis: "bayar", dibayar: null, untuk: null, item: [], nominal: 20000, pelanggan_id: "budi", keterangan: "" });
});

// ---------- Format angka ----------

const contohAngka = {
  10000: ["10000", "10.000", "10rb", "10 rb", "10 ribu", "10ribu", "10k", "10 k", "sepuluh ribu", "Rp10.000", "rp 10.000", "10,000"],
  15000: ["15k", "lima belas ribu"],
  25000: ["dua puluh lima ribu", "25 ribu"],
  1500: ["seribu lima ratus", "1.500", "satu ribu lima ratus"],
  100: ["seratus", "100"],
  1000000: ["sejuta", "1 juta", "satu juta", "1jt"],
  2000000: ["2 jt", "2jt", "dua juta"],
  1500000: ["1,5 juta", "1.5 juta", "satu setengah juta", "1.500.000", "1 juta 500 ribu", "sejuta lima ratus ribu"],
  500000: ["setengah juta", "lima ratus ribu"],
  250000: ["dua ratus lima puluh ribu", "2 ratus 50 ribu"],
  12000: ["dua belas ribu", "12 ribu"],
  11000: ["sebelas ribu"],
  10500: ["10 ribu 500", "sepuluh ribu lima ratus"],
  2500: ["dua setengah ribu"],
  3: ["tiga"],
};

for (const [nilai, daftar] of Object.entries(contohAngka)) {
  for (const teks of daftar) {
    test(`bacaAngka("${teks}") = ${nilai}`, () => assert.equal(bacaAngka(teks), Number(nilai)));
  }
}

test("bacaAngka: teks tanpa angka menghasilkan null", () => {
  for (const teks of ["", "halo", "ribu", "setengah", null, undefined]) assert.equal(bacaAngka(teks), null);
});

test("bacaAngka: dua angka berdampingan tidak digabung", () => {
  assert.equal(bacaAngka("dua tiga"), 2);
  assert.equal(bacaAngka("dua 5000"), 2);
  assert.equal(bacaAngka("50 ribu 20 ribu"), 50000);
});

// ---------- Jenis catatan ----------

test("kata kunci jual: laku, terjual, masuk", () => {
  for (const teks of ["laku kopi dua", "kopi dua terjual", "kopi dua masuk"]) {
    const h = urai(teks);
    assert.equal(h.jenis, "jual", teks);
    assert.deepEqual(h.item, [{ barang_id: "kopi", nama: "Kopi", jumlah: 2 }], teks);
  }
});

test("kata kunci belanja: beli, kulakan", () => {
  for (const teks of ["beli gula 50 ribu", "kulakan gula 50 ribu"]) {
    const h = urai(teks);
    assert.equal(h.untuk, "belanja", teks);
    assert.equal(h.nominal, 50000, teks);
  }
});

test("kata biaya: air, gas, plastik, dan kata biaya sendiri", () => {
  for (const [teks, ket] of [["bayar air 30 ribu", "air"], ["bayar gas 20 ribu", "gas"], ["bayar plastik 5 ribu", "plastik"], ["biaya sewa 1 juta", "sewa"], ["bayar biaya parkir 2 ribu", "parkir"]]) {
    const h = urai(teks);
    assert.equal(h.jenis, "keluar", teks);
    assert.equal(h.untuk, "biaya", teks);
    assert.equal(h.keterangan, ket, teks);
  }
});

test("bayar hal lain yang bukan pelanggan tetap uang keluar, bukan penjualan", () => {
  const h = urai("bayar sampah 10 ribu");
  assert.equal(h.untuk, "biaya");
  assert.equal(h.keterangan, "sampah");
});

test("uang keluar tanpa rincian menjadi biaya", () => {
  assert.equal(urai("uang keluar 20 ribu").untuk, "biaya");
});

test("pinjam dan minjam uang: keluar pinjaman", () => {
  for (const teks of ["Budi pinjam uang 50 ribu", "budi minjam uang 50 ribu"]) {
    const h = urai(teks);
    assert.equal(h.untuk, "pinjaman", teks);
    assert.equal(h.pelanggan_id, "budi", teks);
    assert.equal(h.nominal, 50000, teks);
  }
});

test("nyicil, cicil, lunas, dan nama + bayar: terima bayar", () => {
  for (const teks of ["Budi nyicil 20 ribu", "budi cicil 20 ribu", "Budi lunas 20 ribu", "Budi bayar 20 ribu", "terima bayar 20 ribu dari Budi", "budi bayar hutang 20 ribu"]) {
    const h = urai(teks);
    assert.equal(h.jenis, "bayar", teks);
    assert.equal(h.pelanggan_id, "budi", teks);
    assert.equal(h.nominal, 20000, teks);
  }
});

test("terima uang dari pelanggan: terima bayar, bukan penjualan", () => {
  const h = urai("terima 10 ribu dari Budi");
  assert.equal(h.jenis, "bayar");
  assert.equal(h.pelanggan_id, "budi");
  assert.equal(h.nominal, 10000);
});

test("bayar tanpa nama: terima bayar dengan pelanggan kosong", () => {
  const h = urai("bayar utang 20 ribu");
  assert.equal(h.jenis, "bayar");
  assert.equal(h.pelanggan_id, null);
});

test("Budi bayar listrik: biaya warung, nama masuk keterangan", () => {
  const h = urai("Budi bayar listrik 100 ribu");
  assert.equal(h.untuk, "biaya");
  assert.equal(h.pelanggan_id, null);
  assert.equal(h.keterangan, "budi listrik");
});

// ---------- Dibayar nanti ----------

test("utang, ngutang, kasbon, nanti pada penjualan berarti dibayar nanti", () => {
  for (const teks of ["jual kopi utang", "jual kopi ngutang", "jual kopi kasbon", "jual kopi nanti", "jual kopi bayar nanti"]) {
    const h = urai(teks);
    assert.equal(h.jenis, "jual", teks);
    assert.equal(h.dibayar, "nanti", teks);
  }
});

test("jual kopi bayar sekarang: tetap jual dibayar sekarang", () => {
  const h = urai("jual kopi bayar sekarang");
  assert.equal(h.jenis, "jual");
  assert.equal(h.dibayar, "sekarang");
  assert.equal(h.keterangan, "");
});

test("pelanggan yang membeli adalah penjualan, bukan belanja warung", () => {
  const h = urai("Budi beli kopi dua");
  assert.equal(h.jenis, "jual");
  assert.equal(h.pelanggan_id, "budi");
  assert.equal(h.item[0].jumlah, 2);
  assert.equal(urai("beli kopi dua utang").dibayar, "nanti");
});

// ---------- Jumlah barang ----------

test("jumlah dan nominal dibedakan", () => {
  const h = urai("belanja gula dua 50 ribu");
  assert.equal(h.item[0].jumlah, 2);
  assert.equal(h.nominal, 50000);
  const h2 = urai("jual kopi tiga ribu");
  assert.equal(h2.item[0].jumlah, 1);
  assert.equal(h2.nominal, 3000);
});

test("angka biasa dan kata satuan sebagai jumlah", () => {
  assert.equal(urai("jual 2 indomie").item[0].jumlah, 2);
  assert.equal(urai("jual indomie 5").item[0].jumlah, 5);
  assert.equal(urai("jual dua bungkus indomie").item[0].jumlah, 2);
  assert.equal(urai("jual kopi tiga gelas").item[0].jumlah, 3);
  assert.equal(urai("jual sebungkus indomie").item[0].jumlah, 1);
  assert.equal(urai("jual dua puluh indomie").item[0].jumlah, 20);
});

test("beberapa barang dalam satu kalimat, jumlah di depan atau di belakang", () => {
  const harap = [
    { barang_id: "kopi", nama: "Kopi", jumlah: 2 },
    { barang_id: "indomie", nama: "Indomie", jumlah: 3 },
  ];
  assert.deepEqual(urai("jual dua kopi tiga indomie").item, harap);
  assert.deepEqual(urai("jual kopi dua indomie tiga").item, harap);
  assert.deepEqual(urai("jual dua kopi dan tiga indomie").item, harap);
});

test("angka di dalam nama barang bukan jumlah", () => {
  const data = { barang: [{ id: "gas", nama: "Gas 3 kg" }, { id: "beras", nama: "Beras 5kg" }], pelanggan: [] };
  assert.deepEqual(urai("jual gas 3 kg dua", data).item, [{ barang_id: "gas", nama: "Gas 3 kg", jumlah: 2 }]);
  assert.deepEqual(urai("jual dua beras 5kg", data).item, [{ barang_id: "beras", nama: "Beras 5kg", jumlah: 2 }]);
});

// ---------- Salah dengar dan ragu ----------

test("salah dengar ringan tetap cocok", () => {
  assert.equal(urai("jual indomi").item[0]?.barang_id, "indomie");
  assert.equal(urai("jual idomie").item[0]?.barang_id, "indomie");
  assert.equal(urai("jual indomei").item[0]?.barang_id, "indomie");
  assert.equal(urai("jual gulla").item[0]?.barang_id, "gula");
  assert.equal(urai("budhi bayar utang 5 ribu").pelanggan_id, "budi");
});

test("huruf besar kecil tidak dibedakan", () => {
  assert.equal(urai("JUAL INDOMIE").item[0]?.barang_id, "indomie");
  assert.equal(urai("BUDI BAYAR 5 RIBU").pelanggan_id, "budi");
});

test("sebagian nama cukup, kalau hanya cocok ke satu baris", () => {
  assert.equal(urai("jual minyak").item[0]?.barang_id, "minyak");
  assert.equal(urai("sari bayar utang 5 ribu").pelanggan_id, "sari");
});

test("nama yang kata pendeknya jauh berbeda tidak dicocokkan", () => {
  const h = urai("jual roti 5 ribu");
  assert.deepEqual(h.item, []);
  assert.equal(h.nominal, 5000);
  assert.equal(h.keterangan, "roti");
});

test("kata yang hanya mirip bagian belakang nama tidak dicocokkan", () => {
  assert.deepEqual(urai("jual gorengan 5 ribu").item, []);
});

test("akhiran -nya tetap cocok", () => {
  assert.equal(urai("jual kopinya dua").item[0]?.jumlah, 2);
});

test("kalau ragu antara dua nama, tidak dicocokkan", () => {
  const data = { barang: [{ id: "g", nama: "Indomie Goreng" }, { id: "s", nama: "Indomie Soto" }], pelanggan: [{ id: "a", nama: "Budi Santoso" }, { id: "b", nama: "Budi Hartono" }] };
  const h = urai("jual indomie", data);
  assert.deepEqual(h.item, []);
  assert.equal(h.keterangan, "indomie");
  assert.equal(urai("jual dua indomie soto", data).item[0].barang_id, "s");
  assert.equal(urai("budi bayar utang 5 ribu", data).pelanggan_id, null);
  assert.equal(urai("budi hartono bayar utang 5 ribu", data).pelanggan_id, "b");
});

test("kata umum tidak dicocokkan ke nama pelanggan yang mirip", () => {
  const data = { barang, pelanggan: [{ id: "x", nama: "Hara" }] };
  assert.equal(urai("uang masuk hari ini 5 ribu", data).pelanggan_id, null);
});

// ---------- Tidak dikenali ----------

test("bagian yang tidak dikenali masuk ke keterangan", () => {
  const h = urai("jual kopi dua buat acara rt");
  assert.equal(h.item[0].jumlah, 2);
  assert.equal(h.keterangan, "acara rt");
});

test("jenis tidak terdeteksi tapi ada nominal: jual Lainnya", () => {
  const h = urai("gorengan 5 ribu");
  assert.equal(h.jenis, "jual");
  assert.equal(h.dibayar, "sekarang");
  assert.deepEqual(h.item, []);
  assert.equal(h.nominal, 5000);
  assert.equal(h.keterangan, "gorengan");
});

test("barang tanpa kata kunci dianggap jual", () => {
  assert.equal(urai("kopi tiga").jenis, "jual");
});

test("kalimat yang tidak dikenali: jenis null tanpa error", () => {
  for (const teks of ["halo apa kabar", "cuaca hari ini bagus", "dua", "utang", "", "   ", "!!!", null, undefined]) {
    const h = urai(teks);
    assert.equal(h.jenis, null, String(teks));
    assert.deepEqual(h.item, []);
    assert.equal(h.nominal, null);
  }
  assert.equal(urai("halo apa kabar").keterangan, "halo apa kabar");
});

test("tanpa daftar barang dan pelanggan tetap berjalan", () => {
  assert.equal(uraikanKalimat("uang masuk 10 ribu", { barang: [], pelanggan: [] }).nominal, 10000);
  assert.equal(uraikanKalimat("jual kopi").jenis, "jual");
});
