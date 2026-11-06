// suara.js: mengubah kalimat ucapan menjadi isian lembar Jual, Keluar, atau Terima bayar.
//
// Fungsi di sini "murni": hanya menerima teks dan daftar nama lalu mengembalikan objek,
// tanpa DOM dan tanpa database. Tidak ada yang tersimpan dari sini; pengguna selalu
// memeriksa lembarnya dan menekan Simpan sendiri (lihat tests/suara.test.js).

// ---------- Daftar kata ----------

const kumpulan = (teks) => new Set(teks.split(" "));

// Kata yang menentukan jenis catatan: nama ciri -> kata-katanya
const KATA_KUNCI = {
  jual: "jual jualan menjual dijual terjual kejual laku",
  masuk: "masuk",
  beli: "beli membeli",
  belanja: "belanja belanjaan kulakan",
  cicil: "cicil nyicil mencicil cicilan lunas lunasi melunasi",
  utang: "utang ngutang berutang kasbon ngebon",
  pinjam: "pinjam minjam meminjam dipinjam pinjaman",
  bayar: "bayar membayar dibayar",
  terima: "terima menerima",
  keluar: "keluar pengeluaran",
  biaya: "biaya",
  nanti: "nanti besok lusa",
};
const CIRI = new Map(Object.entries(KATA_KUNCI).flatMap(([ciri, daftar]) => daftar.split(" ").map((k) => [k, ciri])));

// Kata setelah "bayar" yang berarti cara bayar, bukan membayar sesuatu ("bayar nanti")
const CARA_BAYAR = kumpulan("nanti besok lusa sekarang tunai cash kontan");
// Hal yang biasanya berarti biaya warung
const KATA_BIAYA = kumpulan("listrik air gas plastik sewa token wifi internet sampah");
// Kata pengisi: tidak punya arti di sini, dan tidak boleh dicocokkan ke nama
const KATA_PENGISI = kumpulan(
  "uang duit rp rupiah dan sama dari ke di untuk buat yang tadi hari ini itu ya dong nih sih lagi sudah udah mau saya aku pak bu bapak ibu mas mbak bang kak tolong catat sekarang tunai cash kontan"
);
// Satuan di antara jumlah dan nama barang ("dua bungkus indomie")
const SATUAN = kumpulan("bungkus botol biji buah kilo kg liter sachet saset pak dus renceng gelas butir batang papan ikat kaleng");
const adalahSatuan = (k) => SATUAN.has(k) || SATUAN.has(String(k).replace(/^se/, ""));

// ---------- Memecah kalimat ----------

const GANTI = new Map([
  ["rb", "ribu"],
  ["jt", "juta"],
  ["hutang", "utang"],
  ["seratus", "satu ratus"],
  ["seribu", "satu ribu"],
  ["sejuta", "satu juta"],
  ["sepuluh", "satu puluh"],
  ["sebelas", "satu belas"],
]);

// "Rp10.000, Budi" -> ["10.000", "budi"]; "15k" -> ["15", "ribu"]
function pecahKata(teks) {
  const bersih = String(teks ?? "")
    .toLowerCase()
    .replace(/[.,](?!\d)/g, " ") // titik atau koma yang bukan bagian dari angka
    .replace(/(^|\D)[.,]/g, "$1 ")
    .replace(/[^a-z0-9.,]+/g, " ");
  const hasil = [];
  for (const asli of bersih.split(" ").filter(Boolean)) {
    const k = asli.replace(/^rp(?=\d)/, "");
    const singkatan = k.match(/^(\d[\d.,]*)(rb|ribu|k|jt|juta)$/);
    if (singkatan) hasil.push(singkatan[1], singkatan[2] === "k" ? "ribu" : GANTI.get(singkatan[2]) || singkatan[2]);
    else if (k === "k" && /\d$/.test(hasil[hasil.length - 1] || "")) hasil.push("ribu");
    else hasil.push(...(GANTI.get(k) || k).split(" "));
  }
  return hasil;
}

// ---------- Membaca angka ----------

const SKALA = new Map([["ribu", 1000], ["juta", 1000000]]);
const ANGKA_KATA = new Map(["nol", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan"].map((k, i) => [k, i]));

// "dua" -> 2, "10.000" -> 10000, "1,5" -> 1.5, selain itu undefined
function angkaDasar(k) {
  if (ANGKA_KATA.has(k)) return ANGKA_KATA.get(k);
  if (/^\d{1,3}([.,]\d{3})+$/.test(k)) return Number(k.replace(/[.,]/g, ""));
  if (/^\d+$/.test(k)) return Number(k);
  if (/^\d+[.,]\d+$/.test(k)) return Number(k.replace(",", "."));
  return undefined;
}

// Membaca bagian sebelum "ribu" atau "juta": "dua ratus lima puluh" -> 250.
// Setiap kata berikutnya harus lebih kecil dari sebelumnya, jadi "dua tiga" berhenti di "dua".
function bacaBagian(kata, mulai) {
  let i = mulai;
  let nilai = 0;
  let batas = Infinity;
  while (i < kata.length) {
    const n = angkaDasar(kata[i]);
    if (n === undefined) break;
    let tambah = n;
    let batasBaru = 0;
    let langkah = 1;
    if (kata[i + 1] === "ratus") [tambah, batasBaru, langkah] = [n * 100, 100, 2];
    else if (kata[i + 1] === "puluh") [tambah, batasBaru, langkah] = [n * 10, 10, 2];
    else if (kata[i + 1] === "belas") [tambah, batasBaru, langkah] = [n + 10, 1, 2];
    if (tambah >= batas) break;
    nilai += tambah;
    batas = batasBaru;
    i += langkah;
  }
  // "setengah" hanya berarti angka kalau diikuti ribu/juta: "setengah juta", "satu setengah juta"
  if (kata[i] === "setengah" && SKALA.has(kata[i + 1])) return { nilai: nilai + 0.5, akhir: i + 1 };
  return i === mulai ? null : { nilai, akhir: i };
}

// Membaca satu angka utuh mulai dari posisi tertentu: "seribu lima ratus" -> 1500
function bacaAngkaDari(kata, mulai) {
  let total = 0;
  let i = mulai;
  let batasSkala = Infinity;
  let adaSkala = false;
  while (i < kata.length) {
    const bagian = bacaBagian(kata, i);
    if (!bagian) break;
    const skala = SKALA.get(kata[bagian.akhir]);
    if (skala && skala < batasSkala) {
      total += bagian.nilai * skala;
      batasSkala = skala;
      adaSkala = true;
      i = bagian.akhir + 1;
      continue;
    }
    // Sisa setelah ribu/juta harus ratusan: "10 ribu 500" satu angka, tapi "5 ribu dua" tidak
    if (!adaSkala) {
      total = bagian.nilai;
      i = bagian.akhir;
    } else if (!skala && bagian.nilai >= 100 && bagian.nilai < batasSkala) {
      total += bagian.nilai;
      i = bagian.akhir;
    }
    break;
  }
  if (i === mulai) return null;
  return { mulai, akhir: i, nilai: adaSkala ? Math.round(total) : total, adaSkala, dipakai: false };
}

// Angka pertama di dalam teks, atau null kalau tidak ada
export function bacaAngka(teks) {
  const kata = pecahKata(teks);
  for (let i = 0; i < kata.length; i++) {
    const hasil = bacaAngkaDari(kata, i);
    if (hasil) return hasil.nilai;
  }
  return null;
}

function cariSemuaAngka(kata) {
  const hasil = [];
  for (let i = 0; i < kata.length; i++) {
    const a = bacaAngkaDari(kata, i);
    if (a) {
      hasil.push(a);
      i = a.akhir - 1;
    }
  }
  return hasil;
}

const bisaJadiJumlah = (a) => !a.dipakai && !a.adaSkala && Number.isInteger(a.nilai) && a.nilai > 0 && a.nilai < 1000;
// Rp 2 tidak masuk akal, jadi angka kecil tidak dianggap uang
const bisaJadiNominal = (a) => !a.dipakai && Number.isInteger(a.nilai) && a.nilai >= 100;

// ---------- Mencocokkan nama ----------

function jarakLevenshtein(a, b) {
  let baris = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const baru = [i];
    for (let j = 1; j <= b.length; j++) {
      baru[j] = Math.min(baris[j] + 1, baru[j - 1] + 1, baris[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    baris = baru;
  }
  return baris[b.length];
}

// Seberapa cocok satu kata dengan sebuah nama: 4 sama persis dengan salah satu katanya,
// 3 mengandung, 2-1 salah dengar ringan, 0 tidak cocok.
function skorCocok(k, nama) {
  const kataNama = pecahKata(nama);
  if (k.length >= 2 && kataNama.includes(k)) return 4;
  if (k.length < 4) return 0;
  if (kataNama.join(" ").includes(k) || kataNama.includes(k.replace(/nya$/, ""))) return 3;
  // Salah dengar hanya dibandingkan dengan kata pertama nama, supaya "gorengan" tidak dianggap
  // "Minyak Goreng". Kata pendek hanya boleh beda satu huruf, supaya "roti" tidak dianggap "kopi".
  const n = kataNama[0];
  if (n.length < 4) return 0;
  const jarak = jarakLevenshtein(k, n);
  const batas = Math.min(k.length, n.length) >= 6 ? 2 : 1;
  return jarak <= batas ? 3 - jarak : 0;
}

// Baris dengan skor tertinggi untuk satu kata. Kalau beberapa baris seri, itu ragu: baris = null.
function cariNama(k, daftar) {
  let terbaik = 0;
  let cocok = [];
  for (const baris of daftar) {
    const skor = skorCocok(k, baris.nama);
    if (skor > terbaik) [terbaik, cocok] = [skor, [baris]];
    else if (skor === terbaik && skor > 0) cocok.push(baris);
  }
  if (!terbaik) return null;
  return { baris: cocok.length === 1 ? cocok[0] : null, skor: terbaik };
}

// Nama yang tersebut utuh di kalimat ("gas 3 kg"). Yang lebih panjang didahulukan.
// Posisinya dicatat di "terlindung", supaya angka di dalam nama tidak dibaca sebagai jumlah.
function cariNamaUtuh(kata, daftar, terlindung) {
  const hasil = [];
  const urut = daftar.map((baris) => ({ baris, kataNama: pecahKata(baris.nama) })).sort((a, b) => b.kataNama.length - a.kataNama.length);
  for (const { baris, kataNama } of urut) {
    if (!kataNama.length) continue;
    for (let i = 0; i + kataNama.length <= kata.length; i++) {
      const sama = kataNama.every((n, j) => kata[i + j] === n && !terlindung.has(i + j));
      if (!sama) continue;
      kataNama.forEach((_, j) => terlindung.add(i + j));
      hasil.push({ baris, mulai: i, akhir: i + kataNama.length });
    }
  }
  return hasil;
}

// ---------- Jenis catatan ----------

// ada = kumpulan ciri yang muncul. Urutannya penting: yang paling jelas diperiksa lebih dulu.
function tentukanJenis({ ada, adaPelanggan, adaBarang, adaNominal, adaKataBiaya, adaKataLain }) {
  const jual = { jenis: "jual" };
  const biaya = { jenis: "keluar", untuk: "biaya" };
  const bayar = { jenis: "bayar" };
  if (ada.has("jual")) return jual;
  if (ada.has("cicil") || (ada.has("bayar") && (ada.has("utang") || ada.has("pinjam")))) return bayar;
  if (ada.has("pinjam")) return { jenis: "keluar", untuk: "pinjaman" };
  if (ada.has("bayar")) {
    if (adaKataBiaya || ada.has("biaya")) return biaya;
    if (adaPelanggan || ada.has("terima")) return bayar;
    return adaKataLain ? biaya : bayar; // "bayar sampah 10 ribu" atau "bayar 10 ribu"
  }
  if (ada.has("terima") && adaPelanggan) return bayar; // "terima 10 ribu dari Budi"
  if (ada.has("masuk")) return jual;
  // Hanya pembeli yang bisa "beli" sambil utang: warung sendiri selalu bayar saat belanja
  if (ada.has("beli") && (adaPelanggan || ada.has("utang") || ada.has("nanti"))) return jual;
  if (ada.has("beli") || ada.has("belanja")) return adaKataBiaya && !adaBarang ? biaya : { jenis: "keluar", untuk: "belanja" };
  if (ada.has("keluar") || ada.has("biaya")) return biaya;
  if (ada.has("utang") && (adaPelanggan || adaBarang || adaNominal)) return jual;
  if (adaKataBiaya && !adaBarang && adaNominal) return biaya;
  if (adaBarang || adaNominal) return jual;
  return { jenis: null };
}

// ---------- Jumlah barang ----------

// Pasangkan setiap barang dengan angka di dekatnya. Kalimat "kopi dua indomie tiga" menaruh
// jumlah di belakang, "dua kopi tiga indomie" di depan. Barang pertama menentukan polanya.
function isiJumlah(cocok, kata, angka) {
  const sebelum = ({ mulai }) => {
    const posisi = adalahSatuan(kata[mulai - 1]) ? mulai - 1 : mulai;
    return angka.find((a) => a.akhir === posisi && bisaJadiJumlah(a));
  };
  const sesudah = ({ akhir }) => {
    const posisi = adalahSatuan(kata[akhir]) ? akhir + 1 : akhir;
    return angka.find((a) => a.mulai === posisi && bisaJadiJumlah(a));
  };
  const depanDulu = cocok.length > 0 && Boolean(sebelum(cocok[0]));
  const item = [];
  for (const c of cocok) {
    const a = depanDulu ? sebelum(c) || sesudah(c) : sesudah(c) || sebelum(c);
    if (a) a.dipakai = true;
    const jumlah = a ? a.nilai : 1;
    const sama = item.find((x) => x.barang_id === c.baris.id);
    if (sama) sama.jumlah += jumlah;
    else item.push({ barang_id: c.baris.id, nama: c.baris.nama, jumlah });
  }
  return item;
}

// ---------- Fungsi utama ----------

export function uraikanKalimat(teks, { barang = [], pelanggan = [] } = {}) {
  const tidakDikenali = { jenis: null, dibayar: null, untuk: null, item: [], nominal: null, pelanggan_id: null, keterangan: String(teks ?? "").trim() };
  const kata = pecahKata(teks);
  if (!kata.length) return tidakDikenali;

  // 1. Nama yang tersebut utuh, lalu semua angka di luar nama itu
  const terlindung = new Set();
  const pelangganUtuh = cariNamaUtuh(kata, pelanggan, terlindung);
  const barangUtuh = cariNamaUtuh(kata, barang, terlindung);
  const angka = cariSemuaAngka(kata.map((k, i) => (terlindung.has(i) ? null : k)));
  const posisiAngka = new Set(angka.flatMap((a) => Array.from({ length: a.akhir - a.mulai }, (_, j) => a.mulai + j)));

  // 2. Kata kunci dan kata pengisi. Sisanya kata "bebas" yang mungkin nama atau keterangan.
  const terpakai = new Set();
  const ada = new Set();
  kata.forEach((k, i) => {
    if (terlindung.has(i) || posisiAngka.has(i)) return;
    const ciri = CIRI.get(k);
    if (ciri === "bayar" && CARA_BAYAR.has(kata[i + 1])) terpakai.add(i);
    else if (ciri) {
      ada.add(ciri);
      terpakai.add(i);
    } else if (KATA_PENGISI.has(k) || adalahSatuan(k)) terpakai.add(i);
  });
  const adalahBebas = (i) => !terlindung.has(i) && !posisiAngka.has(i) && !terpakai.has(i);

  // 3. Pelanggan: nama utuh, atau kata yang cocok dan bukan lebih cocok ke barang
  let cocokPelanggan = pelangganUtuh[0]?.baris || null;
  const posisiPelanggan = new Set();
  if (pelangganUtuh[0]) for (let i = pelangganUtuh[0].mulai; i < pelangganUtuh[0].akhir; i++) posisiPelanggan.add(i);
  if (!cocokPelanggan) {
    let skorTerbaik = 0;
    kata.forEach((k, i) => {
      if (!adalahBebas(i)) return;
      const hasil = cariNama(k, pelanggan);
      if (!hasil?.baris || hasil.skor <= skorTerbaik) return;
      if ((cariNama(k, barang)?.skor || 0) > hasil.skor) return;
      skorTerbaik = hasil.skor;
      cocokPelanggan = hasil.baris;
    });
    kata.forEach((k, i) => {
      if (cocokPelanggan && adalahBebas(i) && cariNama(k, pelanggan)?.baris === cocokPelanggan) posisiPelanggan.add(i);
    });
  }

  // 4. Barang: nama utuh, lalu kata bebas yang cocok ke satu barang saja
  const cocokBarang = [...barangUtuh];
  kata.forEach((k, i) => {
    if (!adalahBebas(i) || posisiPelanggan.has(i)) return;
    const b = cariNama(k, barang)?.baris;
    if (!b) return;
    const sebelumnya = cocokBarang.find((c) => c.baris === b && c.akhir === i);
    if (sebelumnya) sebelumnya.akhir = i + 1; // "kopi kapal" dua kata untuk satu barang
    else cocokBarang.push({ baris: b, mulai: i, akhir: i + 1 });
  });
  cocokBarang.sort((a, b) => a.mulai - b.mulai);

  // 5. Jenis catatan
  const bebas = kata.filter((_, i) => adalahBebas(i) && !posisiPelanggan.has(i));
  const { jenis, untuk = null } = tentukanJenis({
    ada,
    adaPelanggan: Boolean(cocokPelanggan),
    adaBarang: cocokBarang.length > 0,
    adaNominal: angka.some(bisaJadiNominal),
    adaKataBiaya: bebas.some((k) => KATA_BIAYA.has(k)),
    adaKataLain: bebas.length > 0,
  });
  if (!jenis) return tidakDikenali;

  // 6. Hanya jenis yang memang memakai barang atau pelanggan yang mengambilnya.
  // Kata yang tidak terpakai akan masuk ke keterangan.
  const pakaiBarang = jenis === "jual" || untuk === "belanja";
  const pakaiPelanggan = jenis === "jual" || jenis === "bayar" || untuk === "pinjaman";
  const item = pakaiBarang ? isiJumlah(cocokBarang, kata, angka) : [];
  if (pakaiBarang) for (const c of cocokBarang) for (let i = c.mulai; i < c.akhir; i++) terpakai.add(i);
  if (pakaiPelanggan) for (const i of posisiPelanggan) terpakai.add(i);

  const uang = angka.find(bisaJadiNominal);
  if (uang) uang.dipakai = true;
  for (const a of angka) if (a.dipakai) for (let i = a.mulai; i < a.akhir; i++) terpakai.add(i);

  return {
    jenis,
    dibayar: jenis === "jual" ? (ada.has("utang") || ada.has("nanti") ? "nanti" : "sekarang") : null,
    untuk,
    item,
    nominal: uang ? uang.nilai : null,
    pelanggan_id: pakaiPelanggan && cocokPelanggan ? cocokPelanggan.id : null,
    keterangan: kata.filter((_, i) => !terpakai.has(i)).join(" "),
  };
}
