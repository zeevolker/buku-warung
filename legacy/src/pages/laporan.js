// laporan.js: ringkasan per hari, minggu, atau bulan, plus semua catatan di periode itu.
import { mulaiAplikasi } from "../app.js";
import { semua, semuaMentah } from "../data/db.js";
import { hitungUang, hitungUntung, hitungArusUtang, dalamRentang } from "../data/hitung.js";
import { formatRupiah } from "../lib/format.js";
import { hariIni, geserTanggal, awalMinggu, awalBulan, akhirBulan, geserBulan, formatTanggalLengkap, formatTanggalPendek, formatBulan } from "../lib/tanggal.js";
import { el, itemCatatan, kosong, bagikanTeks, saatDataBerubah, ribuan } from "../ui/komponen.js";
import { bukaRincian } from "../ui/rincian.js";

await mulaiAplikasi();

const $ = (id) => document.getElementById(id);
const NAMA_HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

let periode = "minggu";
let patokan = hariIni(); // tanggal di dalam periode yang sedang dilihat
let teksBagikan = "";

// Rentang tanggal periode yang sedang dilihat
function rentang() {
  if (periode === "hari") return { dari: patokan, sampai: patokan };
  if (periode === "minggu") {
    const dari = awalMinggu(patokan);
    return { dari, sampai: geserTanggal(dari, 6) };
  }
  return { dari: awalBulan(patokan), sampai: akhirBulan(patokan) };
}

function judulPeriode({ dari, sampai }) {
  const kini = hariIni();
  if (periode === "hari") return dari === kini ? "Hari ini" : formatTanggalLengkap(dari);
  if (periode === "minggu") return `${formatTanggalPendek(dari)} – ${formatTanggalPendek(sampai)}`;
  return formatBulan(dari);
}

function labelSelisih({ dari, sampai }) {
  const kini = hariIni();
  const sedangBerjalan = dari <= kini && kini <= sampai;
  const nama = { hari: "hari ini", minggu: "minggu ini", bulan: "bulan ini" }[periode];
  return sedangBerjalan ? `Selisih uang ${nama}` : "Selisih uang";
}

function geser(arah) {
  if (periode === "hari") patokan = geserTanggal(patokan, arah);
  else if (periode === "minggu") patokan = geserTanggal(patokan, arah * 7);
  else patokan = geserBulan(patokan, arah);
  if (patokan > hariIni()) patokan = hariIni();
  tampilkan();
}

// Grafik batang: selisih uang per hari dalam periode
function gambarGrafik(catatan, { dari, sampai }) {
  const grafik = $("grafik");
  grafik.hidden = periode === "hari";
  if (periode === "hari") return;
  const hari = [];
  for (let t = dari; t <= sampai; t = geserTanggal(t, 1)) hari.push(t);
  const nilai = hari.map((t) => hitungUang(catatan.filter((c) => c.tanggal === t)).selisih);
  const terbesar = Math.max(1, ...nilai.map(Math.abs));
  const kini = hariIni();
  grafik.replaceChildren(
    ...hari.map((t, i) => {
      const tgl = Number(t.slice(8));
      const label = periode === "minggu" ? NAMA_HARI[new Date(t + "T00:00").getDay()] : tgl === 1 || tgl % 7 === 1 ? String(tgl) : "";
      const tinggi = t > kini ? 4 : Math.max(4, Math.round((Math.abs(nilai[i]) / terbesar) * 80));
      return el(
        "span",
        { className: "batang" + (t === kini ? " ini" : "") + (nilai[i] < 0 ? " minus" : "") },
        el("span", { style: `height:${tinggi}px` }),
        el("small", { textContent: label || " " })
      );
    })
  );
}

async function tampilkan() {
  const r = rentang();
  const kini = hariIni();
  $("judul-periode").textContent = judulPeriode(r);
  $("label-selisih").textContent = labelSelisih(r);
  $("berikut").disabled = r.sampai >= kini;

  const catatan = dalamRentang(await semua("catatan"), r.dari, r.sampai);
  const uang = hitungUang(catatan);
  const untung = hitungUntung(catatan);
  const utang = hitungArusUtang(catatan);

  $("selisih").textContent = formatRupiah(uang.selisih);
  $("masuk").textContent = formatRupiah(uang.masuk);
  $("keluar").textContent = formatRupiah(uang.keluar);
  $("untung").textContent = formatRupiah(untung);
  const bersih = utang.baru - utang.dibayar;
  $("utang-bersih").textContent = (bersih > 0 ? "+" : bersih < 0 ? "−" : "") + formatRupiah(Math.abs(bersih));
  $("utang-rincian").textContent = `Baru ${ribuan(utang.baru)} · dibayar ${ribuan(utang.dibayar)}`;
  gambarGrafik(catatan, r);

  teksBagikan = [
    `Buku Warung · ${judulPeriode(r)}`,
    `Uang masuk: ${formatRupiah(uang.masuk)}`,
    `Uang keluar: ${formatRupiah(uang.keluar)}`,
    `Selisih: ${formatRupiah(uang.selisih)}`,
    `Untung barang: ${formatRupiah(untung)}`,
  ].join("\n");
  $("bagikan").disabled = !catatan.length;

  const nama = new Map((await semuaMentah("pelanggan")).map((p) => [p.id, p.nama]));
  const urut = [...catatan].sort((a, b) => b.created_at - a.created_at);
  $("daftar-catatan").replaceChildren(
    ...(urut.length
      ? urut.map((c) => itemCatatan(c, nama.get(c.pelanggan_id) || "pelanggan", (x) => bukaRincian(x, nama.get(x.pelanggan_id) || "pelanggan", tampilkan), periode !== "hari"))
      : [kosong("Tidak ada catatan di periode ini.")])
  );
}

document.querySelectorAll('input[name="periode"]').forEach((r) =>
  r.addEventListener("change", () => {
    periode = r.value;
    tampilkan();
  })
);
$("sebelum").addEventListener("click", () => geser(-1));
$("berikut").addEventListener("click", () => geser(1));
$("bagikan").addEventListener("click", () => bagikanTeks(teksBagikan));
saatDataBerubah(tampilkan);
tampilkan();
