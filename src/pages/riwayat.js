// riwayat.js: lihat, ubah, dan hapus catatan dari tanggal mana pun.
import { mulaiAplikasi } from "../app.js";
import { pasangKepala } from "../ui/kepala.js";
import { semua } from "../data/db.js";
import { hapusTransaksi, hapusKasbon } from "../data/repo.js";
import { hitungKas, jenisKasbon } from "../data/hitung.js";
import { formatRupiah } from "../lib/format.js";
import { hariIni, geserTanggal, formatTanggalLengkap, POLA_TANGGAL } from "../lib/tanggal.js";
import { buatItemTransaksi, buatItemKasbon, buatKosong, bagikanTeks, aman, saatDataBerubah, kabar } from "../ui/komponen.js";

// Tunggu pemindahan data lama selesai sebelum menampilkan apa pun
await mulaiAplikasi();
pasangKepala();

const $ = (id) => document.getElementById(id);
const pilihEl = $("pilih-tanggal");

let tanggal = hariIni();
let ringkas = { masuk: 0, keluar: 0, total: 0, jumlah: 0, kasbon: 0 };

const dariAlamat = new URLSearchParams(location.search).get("tanggal");
if (dariAlamat && POLA_TANGGAL.test(dariAlamat) && dariAlamat <= hariIni()) tanggal = dariAlamat;

function pindahKe(baru) {
  // Tanggal tidak valid atau di masa depan ditolak; tampilkan() mengembalikan kolomnya
  if (POLA_TANGGAL.test(baru) && baru <= hariIni()) {
    tanggal = baru;
    history.replaceState(null, "", tanggal === hariIni() ? location.pathname : "?tanggal=" + tanggal);
  }
  tampilkan();
}

function teksBagikan() {
  const baris = [
    "Buku Warung: " + formatTanggalLengkap(tanggal),
    "Uang masuk: " + formatRupiah(ringkas.masuk),
    "Uang keluar: " + formatRupiah(ringkas.keluar),
    "Total: " + formatRupiah(ringkas.total),
  ];
  if (ringkas.kasbon) baris.push("Kasbon baru: " + formatRupiah(ringkas.kasbon));
  baris.push(ringkas.jumlah + " catatan");
  return baris.join("\n");
}

async function hapusKasbonIni(k) {
  const h = await aman(() => hapusKasbon(k.id));
  if (h.galat) kabar(h.galat);
  tampilkan();
}

async function tampilkan() {
  const hari = hariIni();
  pilihEl.value = tanggal;
  pilihEl.max = hari;
  $("judul-tanggal").textContent = formatTanggalLengkap(tanggal) + (tanggal === hari ? " (hari ini)" : "");
  $("btn-berikut").disabled = tanggal >= hari;
  $("btn-hari-ini").hidden = tanggal === hari;

  const [transaksi, kasbon, pelanggan] = await Promise.all([semua("transaksi"), semua("kasbon"), semua("pelanggan")]);
  const daftarT = transaksi.filter((t) => t.tanggal === tanggal);
  // Kasbon dari pelanggan yang sudah dihapus tidak ditampilkan lagi
  const nama = new Map(pelanggan.map((p) => [p.id, p.nama]));
  const daftarK = kasbon.filter((k) => k.tanggal === tanggal && k.tipe === "utang" && jenisKasbon(k) !== "tunai" && nama.has(k.pelanggan_id));

  const kas = hitungKas(daftarT);
  ringkas = { ...kas, jumlah: daftarT.length, kasbon: daftarK.reduce((n, k) => n + k.nominal, 0) };
  $("r-masuk").textContent = formatRupiah(kas.masuk);
  $("r-keluar").textContent = formatRupiah(kas.keluar);
  $("r-total").textContent = formatRupiah(kas.total);
  $("btn-bagikan").disabled = daftarT.length + daftarK.length === 0;

  const onUbah = (t) => (location.href = `index.html?ubah=${t.id}&kembali=riwayat`);
  const onHapus = async (t) => {
    const h = await aman(() => hapusTransaksi(t.id));
    if (h.galat) kabar(h.galat);
    tampilkan();
  };
  const daftar = [
    ...daftarT.map((t) => ({ waktu: t.created_at, li: buatItemTransaksi(t, { onUbah, onHapus }) })),
    ...daftarK.map((k) => ({ waktu: k.created_at, li: buatItemKasbon(k, nama.get(k.pelanggan_id), hapusKasbonIni) })),
  ].sort((a, b) => b.waktu - a.waktu);

  $("daftar-riwayat").replaceChildren(...(daftar.length ? daftar.map((d) => d.li) : [buatKosong("Tidak ada catatan pada tanggal ini.")]));
}

$("btn-sebelum").addEventListener("click", () => pindahKe(geserTanggal(tanggal, -1)));
$("btn-berikut").addEventListener("click", () => pindahKe(geserTanggal(tanggal, 1)));
$("btn-hari-ini").addEventListener("click", () => pindahKe(hariIni()));
pilihEl.addEventListener("change", () => pindahKe(pilihEl.value));
$("btn-bagikan").addEventListener("click", () => bagikanTeks(teksBagikan()));
saatDataBerubah(tampilkan);

tampilkan();
