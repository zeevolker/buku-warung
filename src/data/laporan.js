// laporan.js: angka tambahan untuk halaman cetak (fungsi murni), dan pembagian isi ke halaman A4.
// Angka dasarnya memakai fungsi di hitung.js yang sama dengan layar Laporan, supaya selalu cocok.

import { dalamRentang, hampirHabis, penjualanBarang, rincianUntung, sampaiTanggal, semuaStok, tanggalCatatan } from "./hitung.js";
import { akhirBulan, awalBulan, awalMinggu, geserTanggal, labelBulan, labelTanggal, labelTanggalPendek } from "./tanggal.js";

// ---------- Arus laci ----------

// Rincian uang masuk dan keluar laci. awal + masuk − keluar = akhir.
export function rincianArusLaci(catatan, rentang) {
  const r = { jualanTunai: 0, bonDibayar: 0, uangPribadi: 0, selisihMasuk: 0, lainMasuk: 0, belanjaAgen: 0, biaya: 0, pinjaman: 0, ambilPribadi: 0, selisihKeluar: 0, lainKeluar: 0, masuk: 0, keluar: 0 };
  const MASUK = { pembeli: "jualanTunai", bon: "bonDibayar", pemilik: "uangPribadi", selisih: "selisihMasuk" };
  const KELUAR = { agen: "belanjaAgen", biaya: "biaya", bon: "pinjaman", pemilik: "ambilPribadi", selisih: "selisihKeluar" };
  for (const c of dalamRentang(catatan, rentang)) {
    if (c.ke === "laci") {
      r[MASUK[c.dari] || "lainMasuk"] += c.nominal;
      r.masuk += c.nominal;
    }
    if (c.dari === "laci") {
      r[KELUAR[c.ke] || "lainKeluar"] += c.nominal;
      r.keluar += c.nominal;
    }
  }
  return r;
}

// ---------- Barang ----------

// Barang terlaris. total = hasil jualan dan untung kotor yang sama dengan layar Laporan,
// karena jualan tanpa barang (Lainnya) dihitung sebagai baris sendiri.
export function ringkasanBarang(catatan, rentang, jumlahTeratas = 5) {
  const daftar = penjualanBarang(catatan, rentang).sort((a, b) => b.jualan - a.jualan);
  const rincian = rincianUntung(catatan, rentang);
  const jumlahkan = (baris, kolom) => baris.reduce((n, b) => n + b[kolom], 0);
  const sisa = daftar.slice(jumlahTeratas);
  const total = { terjual: jumlahkan(daftar, "jumlah"), jualan: rincian.hasil, untung: rincian.hasil - rincian.modal };
  return {
    daftar,
    teratas: daftar.slice(0, jumlahTeratas),
    lain: { jenis: sisa.length, terjual: jumlahkan(sisa, "jumlah"), jualan: jumlahkan(sisa, "jualan"), untung: jumlahkan(sisa, "untung") },
    tanpaBarang: { jualan: total.jualan - jumlahkan(daftar, "jualan"), untung: total.untung - jumlahkan(daftar, "untung") },
    total,
  };
}

export function barangRusakHilang(catatan, rentang) {
  return dalamRentang(catatan, rentang)
    .filter((c) => c.dari === "stok" && c.ke === "biaya")
    .reduce((n, c) => n + c.nominal, 0);
}

// Barang yang stoknya hampir habis, memakai aturan yang sama dengan layar Barang. Paling sedikit di atas.
export function stokDiBawahBatas(barang, catatan) {
  const stok = semuaStok(catatan);
  return barang
    .filter((b) => !b.deleted && hampirHabis(stok.get(b.id) || 0, b))
    .map((b) => ({ id: b.id, nama: b.nama, stok: stok.get(b.id) || 0 }))
    .sort((a, b) => a.stok - b.stok);
}

// ---------- Bon per pelanggan ----------

// tambah termasuk pinjaman dan bon lama. awal + tambah − bayar = sisa.
export function bonPerPelanggan(catatan, { dari, sampai }, namaDari = () => "pelanggan") {
  const peta = new Map();
  const baris = (id) => {
    if (!peta.has(id)) peta.set(id, { pelanggan_id: id, nama: namaDari(id), awal: 0, tambah: 0, bayar: 0, sisa: 0 });
    return peta.get(id);
  };
  for (const c of sampaiTanggal(catatan, sampai)) {
    if (c.ke !== "bon" && c.dari !== "bon") continue;
    const b = baris(c.pelanggan_id);
    const arah = c.ke === "bon" ? 1 : -1;
    if (tanggalCatatan(c) < dari) b.awal += arah * c.nominal;
    else if (arah > 0) b.tambah += c.nominal;
    else b.bayar += c.nominal;
  }
  const daftar = [...peta.values()]
    .map((b) => ({ ...b, sisa: b.awal + b.tambah - b.bayar }))
    .filter((b) => b.awal || b.tambah || b.bayar)
    .sort((a, b) => b.sisa - a.sisa);
  const total = { awal: 0, tambah: 0, bayar: 0, sisa: 0 };
  for (const b of daftar) for (const k of Object.keys(total)) total[k] += b[k];
  return { daftar, total, orangBerutang: daftar.filter((b) => b.sisa > 0).length };
}

// ---------- Kalender untung ----------

function kuartil(urut, p) {
  const posisi = (urut.length - 1) * p;
  const bawah = Math.floor(posisi);
  const atas = Math.ceil(posisi);
  return urut[bawah] + (urut[atas] - urut[bawah]) * (posisi - bawah);
}

// Tingkat warna 0 sampai 3 dari kuartil. Kalau semua nilai sama, tidak ada yang lebih banyak.
export function tingkatKalender(nilai) {
  if (!nilai.length) return [];
  const urut = [...nilai].sort((a, b) => a - b);
  const [q1, q2, q3] = [0.25, 0.5, 0.75].map((p) => kuartil(urut, p));
  return nilai.map((n) => (n <= q1 ? 0 : n <= q2 ? 1 : n <= q3 ? 2 : 3));
}

// minggu = baris Senin sampai Minggu, sel kosong = null. Hari tanpa catatan dan hari depan: tingkat null.
export function kalenderBulan(catatan, tanggal, kini) {
  const dari = awalBulan(tanggal);
  const sampai = akhirBulan(tanggal);
  const ada = new Set(dalamRentang(catatan, { dari, sampai }).map(tanggalCatatan));
  const hari = [];
  for (let t = dari; t <= sampai; t = geserTanggal(t, 1)) {
    const aktif = t <= kini && ada.has(t);
    hari.push({ tanggal: t, angka: Number(t.slice(8)), aktif, untung: aktif ? rincianUntung(catatan, { dari: t, sampai: t }).untung : null, tingkat: null });
  }
  const aktif = hari.filter((h) => h.aktif);
  tingkatKalender(aktif.map((h) => h.untung)).forEach((t, i) => (aktif[i].tingkat = t));

  const hariPertama = (new Date(`${dari}T00:00:00`).getDay() + 6) % 7;
  const sel = [...Array(hariPertama).fill(null), ...hari];
  while (sel.length % 7) sel.push(null);
  const minggu = [];
  for (let i = 0; i < sel.length; i += 7) minggu.push(sel.slice(i, i + 7));
  const terbaik = aktif.reduce((a, b) => (a === null || b.untung > a.untung ? b : a), null);
  return { minggu, terbaik };
}

// ---------- Judul dan periode ----------

// "2026-11-02", "2026-11-08" -> "2–8 Nov 2026"
export function labelRentang(dari, sampai, pemisah = "–") {
  const tahun = (t) => t.slice(0, 4);
  const awal = labelTanggalPendek(dari);
  const akhir = `${labelTanggalPendek(sampai)} ${tahun(sampai)}`;
  if (tahun(dari) !== tahun(sampai)) return `${awal} ${tahun(dari)}${pemisah}${akhir}`;
  if (dari.slice(0, 7) === sampai.slice(0, 7)) return `${awal.split(" ")[0]}${pemisah}${akhir}`;
  return `${awal}${pemisah}${akhir}`;
}

export const NAMA_LAPORAN = { hari: "Harian", minggu: "Mingguan", bulan: "Bulanan" };

export function rentangLaporan(periode, tanggal) {
  if (periode === "hari") return { dari: tanggal, sampai: tanggal };
  if (periode === "minggu") return { dari: awalMinggu(tanggal), sampai: geserTanggal(awalMinggu(tanggal), 6) };
  return { dari: awalBulan(tanggal), sampai: akhirBulan(tanggal) };
}

export const labelHariPanjang = (t) => `${labelTanggal(t)} ${t.slice(0, 4)}`;

// Dipakai browser sebagai nama file PDF
export function judulDokumen(periode, { dari, sampai }) {
  const isi = periode === "hari" ? `${labelTanggalPendek(dari)} ${dari.slice(0, 4)}` : periode === "minggu" ? labelRentang(dari, sampai, "-") : labelBulan(dari);
  return `Buku Warung - ${NAMA_LAPORAN[periode]} ${isi}`;
}

export function alamatSah(periode, tanggal) {
  if (!NAMA_LAPORAN[periode] || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal || "")) return false;
  const d = new Date(`${tanggal}T00:00:00`);
  return !Number.isNaN(d.getTime()) && Number(tanggal.slice(8)) === d.getDate();
}

// ---------- Pembagian halaman ----------

// Perkiraan tinggi teks yang bisa turun baris: jumlah baris x tinggi baris tambahan
export const tinggiTeks = (teks, hurufPerBaris, tinggiDasar, tinggiTambah = 18) => tinggiDasar + tinggiTambah * Math.max(0, Math.ceil(String(teks || "").length / hurufPerBaris) - 1);

// daftar berisi blok. Tiga jenisnya:
//   { halamanBaru: true }                             mulai di halaman baru
//   { tinggi, ... }                                   utuh, tidak boleh terbelah
//   { baris: [{ tinggi }], tinggiKepala, tinggiAkhir } tabel: boleh lanjut ke halaman berikutnya,
//       kepala ikut di setiap potongan, dan baris total (akhir) tidak pernah sendirian
// Hasilnya daftar halaman, tiap halaman berisi { blok, baris, lanjutan, selesai }.
export function bagiBlok(daftar, { ruangPertama, ruang }) {
  const halaman = [[]];
  let sisa = ruangPertama;
  const kosong = () => !halaman[halaman.length - 1].length;
  const baru = () => {
    halaman.push([]);
    sisa = ruang;
  };

  for (const blok of daftar) {
    if (blok.halamanBaru) {
      if (!kosong()) baru();
      continue;
    }
    if (!blok.baris) {
      if (blok.tinggi > sisa && !kosong()) baru();
      halaman[halaman.length - 1].push({ blok });
      sisa -= blok.tinggi;
      continue;
    }

    const akhir = blok.tinggiAkhir || 0;
    let i = 0;
    while (i < blok.baris.length) {
      if (blok.tinggiKepala + blok.baris[i].tinggi > sisa && !kosong()) baru();
      const mulai = i;
      let muat = sisa - blok.tinggiKepala;
      while (i < blok.baris.length && (i === mulai || blok.baris[i].tinggi <= muat)) muat -= blok.baris[i++].tinggi;
      if (i === blok.baris.length && akhir > muat) {
        // Baris total tidak muat: bawa baris terakhir ke halaman berikutnya bersamanya
        if (i - mulai > 1) {
          muat += blok.baris[--i].tinggi;
        } else if (!kosong()) {
          i = mulai;
          baru();
          continue;
        }
      }
      const selesai = i === blok.baris.length;
      halaman[halaman.length - 1].push({ blok, baris: blok.baris.slice(mulai, i), lanjutan: mulai > 0, selesai });
      sisa = muat - (selesai ? akhir : 0);
      if (!selesai) baru();
    }
  }
  return halaman;
}
