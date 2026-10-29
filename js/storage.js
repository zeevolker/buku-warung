// storage.js: semua urusan baca/tulis data ada di sini.
const KEY_TRANSAKSI = "bw_transaksi";

function ambilData(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch (e) {
    return []; // kalau data rusak, mulai dari kosong
  }
}

// Mengembalikan true kalau berhasil, false kalau gagal (penyimpanan penuh,
// mode penyamaran, dsb.). Kalau gagal, pengguna diberi tahu lewat banner merah.
function simpanData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (e) {
    tampilkanGagalSimpan();
    return false;
  }
}

function tampilkanGagalSimpan() {
  if (document.getElementById("gagal-simpan")) return;
  const el = document.createElement("div");
  el.id = "gagal-simpan";
  el.className = "gagal-simpan";
  el.setAttribute("role", "alert");
  el.textContent =
    "Data gagal disimpan, jadi catatan terakhir belum tersimpan. Penyimpanan HP mungkin penuh, atau browser sedang dalam mode penyamaran.";
  document.body.prepend(el);
}

// Tanggal lokal format YYYY-MM-DD.
// Jangan pakai toISOString(): itu waktu UTC, jadi dini hari di Indonesia tanggalnya bisa mundur sehari.
function formatTanggal(d) {
  const bulan = String(d.getMonth() + 1).padStart(2, "0");
  const tgl = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${bulan}-${tgl}`;
}

function hariIni() {
  return formatTanggal(new Date());
}

function tambahTransaksi(tipe, nominal, catatan) {
  const data = ambilData(KEY_TRANSAKSI);
  data.push({
    id: Date.now(),
    tipe, // "masuk" atau "keluar"
    nominal: Number(nominal),
    catatan: catatan.trim(),
    tanggal: hariIni(),
    dibuat: Date.now(), // waktu persis pencatatan
  });
  return simpanData(KEY_TRANSAKSI, data);
}

function hapusTransaksi(id) {
  const semua = ambilData(KEY_TRANSAKSI);
  const t = semua.find((x) => x.id === id);
  if (!simpanData(KEY_TRANSAKSI, semua.filter((x) => x.id !== id))) return false;
  // Penjualan barang yang dihapus: kembalikan stoknya (kalau barangnya masih ada)
  if (t && t.barangId) ubahStok(t.barangId, t.jumlah);
  return true;
}

function ubahTransaksi(id, tipe, nominal, catatan) {
  const data = ambilData(KEY_TRANSAKSI).map((t) =>
    t.id === id
      ? { ...t, tipe, nominal: Number(nominal), catatan: catatan.trim() }
      : t,
  );
  return simpanData(KEY_TRANSAKSI, data);
}

function formatRupiah(angka) {
  return "Rp " + angka.toLocaleString("id-ID");
}

// ---- Stok barang ----
const KEY_BARANG = "bw_barang";
const BATAS_MENIPIS = 5; // stok di bawah atau sama dengan angka ini ditandai merah

// harga = harga jual, hargaBeli = modal per barang (0 kalau belum diisi)
function tambahBarang(nama, stok, harga, hargaBeli) {
  const data = ambilData(KEY_BARANG);
  data.push({
    id: Date.now(),
    nama: nama.trim(),
    stok: Number(stok),
    harga: Number(harga) || 0,
    hargaBeli: Number(hargaBeli) || 0,
    diubah: Date.now(),
  });
  return simpanData(KEY_BARANG, data);
}

function ubahHargaBarang(id, harga, hargaBeli) {
  const data = ambilData(KEY_BARANG).map((b) =>
    b.id === id ? { ...b, harga: Number(harga) || 0, hargaBeli: Number(hargaBeli) || 0 } : b
  );
  return simpanData(KEY_BARANG, data);
}

// Jual barang: stok berkurang dan uang masuk tercatat sekaligus.
// Mengembalikan "" kalau berhasil, atau pesan kesalahan.
function jualBarang(id, jumlah) {
  const barang = ambilData(KEY_BARANG);
  const b = barang.find((x) => x.id === id);
  if (!b) return "Barang tidak ditemukan.";
  if (!b.harga) return "Isi harga jual dulu lewat Ubah harga.";
  if (jumlah > b.stok) return `Stok tinggal ${b.stok}.`;

  const sekarang = Date.now();
  const transaksi = ambilData(KEY_TRANSAKSI);
  transaksi.push({
    id: sekarang,
    tipe: "masuk",
    nominal: b.harga * jumlah,
    catatan: `Jual ${jumlah} ${b.nama}`,
    tanggal: hariIni(),
    dibuat: sekarang,
    barangId: b.id,
    jumlah,
    // modal hanya dicatat kalau harga beli diisi, supaya untung tidak terlihat lebih besar
    modal: b.hargaBeli ? b.hargaBeli * jumlah : null,
  });
  b.stok -= jumlah;
  b.diubah = sekarang;

  if (!simpanData(KEY_TRANSAKSI, transaksi)) return "Gagal menyimpan.";
  if (!simpanData(KEY_BARANG, barang)) return "Gagal menyimpan.";
  return "";
}

// Untung dari penjualan barang yang harga belinya diketahui
function hitungUntungBarang(daftar) {
  const jual = daftar.filter((t) => t.tipe === "masuk" && Number.isFinite(t.modal));
  return {
    untung: jual.reduce((jml, t) => jml + t.nominal - t.modal, 0),
    jumlah: jual.length,
  };
}

// selisih bisa +1 atau -1. Stok tidak boleh di bawah 0.
function ubahStok(id, selisih) {
  const data = ambilData(KEY_BARANG).map((b) =>
    b.id === id
      ? { ...b, stok: Math.max(0, b.stok + selisih), diubah: Date.now() }
      : b,
  );
  return simpanData(KEY_BARANG, data);
}

function hapusBarang(id) {
  const data = ambilData(KEY_BARANG).filter((b) => b.id !== id);
  return simpanData(KEY_BARANG, data);
}

// ---- Format tanggal dan waktu (bahasa Indonesia) ----
function formatWaktuLengkap(ms) {
  return new Date(ms).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// "2026-10-29" -> "29 Okt 2026"
function formatTanggalPanjang(teks) {
  const [tahun, bulan, tgl] = teks.split("-").map(Number);
  return new Date(tahun, bulan - 1, tgl).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Catatan lama (sebelum ada jam) hanya punya tanggal, jadi tampilkan tanggalnya saja.
function labelWaktuTransaksi(t) {
  return t.dibuat
    ? formatWaktuLengkap(t.dibuat)
    : formatTanggalPanjang(t.tanggal);
}

// ---- Riwayat: bantuan untuk tanggal "YYYY-MM-DD" ----
function bagiTanggal(teks) {
  const [tahun, bulan, tgl] = teks.split("-").map(Number);
  return { tahun, bulan, tgl };
}

// Geser tanggal sebanyak `selisih` hari (boleh negatif).
function geserTanggal(teks, selisih) {
  const { tahun, bulan, tgl } = bagiTanggal(teks);
  return formatTanggal(new Date(tahun, bulan - 1, tgl + selisih));
}

// "2026-10-28" -> "Rabu, 28 Oktober 2026"
function formatTanggalLengkap(teks) {
  const { tahun, bulan, tgl } = bagiTanggal(teks);
  return new Date(tahun, bulan - 1, tgl).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Transaksi pada satu tanggal, yang terbaru di atas.
function transaksiPadaTanggal(teks) {
  return ambilData(KEY_TRANSAKSI)
    .filter((t) => t.tanggal === teks)
    .sort((a, b) => (b.dibuat || b.id) - (a.dibuat || a.id));
}

// Total = uang masuk dikurangi uang keluar (selisih kas, bukan laba).
function hitungTotal(daftar) {
  const masuk = daftar
    .filter((t) => t.tipe === "masuk")
    .reduce((jumlah, t) => jumlah + t.nominal, 0);
  const keluar = daftar
    .filter((t) => t.tipe === "keluar")
    .reduce((jumlah, t) => jumlah + t.nominal, 0);
  return { masuk, keluar, total: masuk - keluar };
}

// Kapan terakhir kali data dicadangkan (dipakai cadangan.js dan pengingat.js).
const KEY_CADANGAN_TERAKHIR = "bw_cadangan_terakhir";


// ---- Kasbon (utang pelanggan) ----
// Satu pelanggan = {id, nama, telepon, mutasi:[{id, tipe:"utang"|"bayar", nominal, catatan, dibuat}]}
const KEY_KASBON = "bw_kasbon";

function sisaKasbon(p) {
  return p.mutasi.reduce((sisa, m) => sisa + (m.tipe === "utang" ? m.nominal : -m.nominal), 0);
}

function cariPelanggan(data, nama) {
  const kunci = nama.trim().toLowerCase();
  return data.find((p) => p.nama.toLowerCase() === kunci);
}

// Catat utang/bayar. Kalau nama belum ada, pelanggan baru dibuat.
// Mengembalikan true kalau tersimpan.
function catatKasbon(nama, tipe, nominal, catatan, telepon) {
  const data = ambilData(KEY_KASBON);
  let p = cariPelanggan(data, nama);
  if (!p) {
    p = { id: Date.now(), nama: nama.trim(), telepon: "", mutasi: [] };
    data.push(p);
  }
  if (telepon && !p.telepon) p.telepon = telepon.trim();
  p.mutasi.push({
    id: Date.now() + p.mutasi.length,
    tipe,
    nominal: Number(nominal),
    catatan: (catatan || "").trim(),
    dibuat: Date.now(),
  });
  return simpanData(KEY_KASBON, data);
}

function hapusMutasiKasbon(idPelanggan, idMutasi) {
  const data = ambilData(KEY_KASBON).map((p) =>
    p.id === idPelanggan ? { ...p, mutasi: p.mutasi.filter((m) => m.id !== idMutasi) } : p
  );
  return simpanData(KEY_KASBON, data);
}

function hapusPelanggan(id) {
  return simpanData(KEY_KASBON, ambilData(KEY_KASBON).filter((p) => p.id !== id));
}

// Nomor HP Indonesia untuk wa.me: "0812-3456" -> "628123456"
function nomorWhatsApp(telepon) {
  let n = (telepon || "").replace(/\D/g, "");
  if (n.startsWith("0")) n = "62" + n.slice(1);
  else if (n.startsWith("8")) n = "62" + n;
  return n;
}
