// ringkasan.js: total per hari, minggu, dan bulan, plus untung barang dan kasbon.
import { mulaiAplikasi } from "../app.js";
import { pasangKepala } from "../ui/kepala.js";
import { semua } from "../data/db.js";
import { hitungKas, hitungUntungBarang, hitungArusKasbon, hitungSisaKasbon, dalamRentang } from "../data/hitung.js";
import { formatRupiah } from "../lib/format.js";
import { hariIni, awalMinggu, awalBulan } from "../lib/tanggal.js";
import { saatDataBerubah } from "../ui/komponen.js";

// Tunggu pemindahan data lama selesai sebelum menampilkan apa pun
await mulaiAplikasi();
pasangKepala();

function isi(kartu, nama, nilai, tandai = false) {
  const dd = kartu.querySelector(`[data-isi="${nama}"]`);
  dd.textContent = formatRupiah(nilai);
  if (tandai) dd.className = nilai < 0 ? "negatif" : "positif";
}

async function tampilkan() {
  const [transaksi, kasbon, pelanggan] = await Promise.all([semua("transaksi"), semua("kasbon"), semua("pelanggan")]);
  const hari = hariIni();
  const awal = { hari, minggu: awalMinggu(hari), bulan: awalBulan(hari) };

  document.querySelectorAll(".periode").forEach((kartu) => {
    const dari = awal[kartu.dataset.periode];
    const t = dalamRentang(transaksi, dari, hari);
    const k = dalamRentang(kasbon, dari, hari);

    const kas = hitungKas(t);
    isi(kartu, "masuk", kas.masuk);
    isi(kartu, "keluar", kas.keluar);
    isi(kartu, "total", kas.total, true);

    // Untung = harga jual - modal; hanya dari penjualan yang modalnya diketahui
    const u = hitungUntungBarang(t, k);
    kartu.querySelector(".baris.untung").hidden = u.jumlah === 0;
    isi(kartu, "untung", u.untung, true);

    const arus = hitungArusKasbon(k);
    kartu.querySelector(".baris.kasbon-baru").hidden = arus.utangBaru === 0;
    kartu.querySelector(".baris.kasbon-bayar").hidden = arus.dibayar === 0;
    isi(kartu, "kasbon-baru", arus.utangBaru);
    isi(kartu, "kasbon-bayar", arus.dibayar);

    kartu.querySelector('[data-isi="catatan"]').textContent = u.jumlah
      ? `Untung dihitung dari ${u.jumlah} penjualan barang (tunai dan kasbon) yang harga belinya diisi.`
      : "";
  });

  // Kasbon yang belum dibayar sampai hari ini (tidak tergantung periode)
  const aktif = new Set(pelanggan.map((p) => p.id));
  const sisa = [...hitungSisaKasbon(kasbon)].filter(([id, n]) => aktif.has(id) && n > 0);
  const totalSisa = sisa.reduce((n, [, s]) => n + s, 0);
  document.getElementById("piutang").hidden = totalSisa === 0;
  document.getElementById("piutang-total").textContent = formatRupiah(totalSisa);
  document.getElementById("piutang-jumlah").textContent = `dari ${sisa.length} pelanggan`;
}

saatDataBerubah(tampilkan);
tampilkan();
