// rincian.js: lembar rincian satu catatan, dengan tombol hapus.
// Dipakai di Beranda, Laporan, dan Detail pelanggan.

import { el, ikon, ribuan, uraikanCatatan, pasangLembar, pasangHapusDuaKali, aman, kabar } from "./komponen.js";
import { hapusCatatan } from "../data/aksi.js";
import { formatWaktuLengkap } from "../lib/tanggal.js";

// Kalimat sederhana tentang apa akibat catatan ini
function akibat(c, namaPelanggan) {
  const hasil = [];
  if (c.jenis === "jual" && c.dibayar === "sekarang") hasil.push(`Uang di laci +${ribuan(c.nominal)}`);
  if (c.jenis === "jual" && c.dibayar === "nanti") hasil.push(`Utang ${namaPelanggan} +${ribuan(c.nominal)}`);
  if (c.jenis === "keluar") hasil.push(`Uang di laci −${ribuan(c.nominal)}`);
  if (c.jenis === "keluar" && c.untuk === "pinjaman") hasil.push(`Utang ${namaPelanggan} +${ribuan(c.nominal)}`);
  if (c.jenis === "bayar") hasil.push(`Uang di laci +${ribuan(c.nominal)}`, `Utang ${namaPelanggan} −${ribuan(c.nominal)}`);
  for (const b of c.barang || []) {
    const n = c.jenis === "jual" ? -b.jumlah : b.jumlah;
    if (b.barang_id) hasil.push(`Stok ${b.nama} ${n > 0 ? "+" : ""}${n}`);
  }
  return hasil;
}

export function bukaRincian(c, namaPelanggan, setelahHapus) {
  const u = uraikanCatatan(c, namaPelanggan);
  const tombolHapus = el("button", { type: "button", className: "tombol-garis penuh tombol-bahaya", textContent: "Hapus catatan ini" });
  const pesan = el("p", { className: "pesan-galat", role: "alert" });

  const dialog = pasangLembar(
    el(
      "dialog",
      { className: "lembar pendek", "aria-labelledby": "judul-rincian" },
      el(
        "div",
        { className: "atas" },
        el("h2", { id: "judul-rincian", textContent: "Rincian" }),
        el("button", { type: "button", className: "tombol-bulat", "aria-label": "Tutup", "data-tutup": "" }, ikon("tutup"))
      ),
      el(
        "div",
        { className: "isi" },
        el(
          "div",
          { className: "angka-besar" },
          el("span", { className: "label", textContent: u.judul }),
          el("span", { className: "nilai", textContent: u.angka || "–" }),
          el("span", { className: "kecil", textContent: formatWaktuLengkap(c.created_at) + (c.keterangan && !u.judul.includes(c.keterangan) ? " · " + c.keterangan : "") })
        ),
        el("div", { className: "kotak-abu" }, el("span", { className: "label", textContent: "Yang terjadi" }), ...akibat(c, namaPelanggan).map((t) => el("span", { textContent: t }))),
        el("p", { className: "petunjuk", textContent: "Salah catat? Hapus catatan ini lalu catat ulang. Semua angka (uang, stok, utang) otomatis kembali." }),
        pesan
      ),
      el("div", { className: "bawah" }, tombolHapus)
    )
  );

  pasangHapusDuaKali(tombolHapus, async () => {
    const h = await aman(() => hapusCatatan(c.id));
    if (h.galat) {
      pesan.textContent = h.galat;
      return;
    }
    dialog.close();
    kabar("Catatan dihapus.");
    setelahHapus?.();
  });
  dialog.addEventListener("close", () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}
