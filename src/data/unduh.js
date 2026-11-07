// unduh.js: membuat file Excel di HP. Library-nya besar, jadi baru dimuat saat tombol ditekan.
// PDF dibuat lewat halaman cetak, lihat src/layar/Cetak.

import { tanggalCatatan } from "./hitung.js";
import { uraiCatatan } from "./uraian.js";
import { jamDariMs } from "./tanggal.js";

export const NAMA_TEMPAT = { laci: "Laci", bon: "Bon", stok: "Stok", pembeli: "Pembeli", agen: "Agen", biaya: "Biaya", pemilik: "Pemilik", selisih: "Selisih" };

// Baris tabel Excel: baris pertama judul kolom, lalu satu baris per catatan (lama ke baru)
export function barisExcel(catatan, namaPelanggan = () => "") {
  const urut = catatan.filter((c) => !c.deleted).sort((a, b) => a.waktu - b.waktu);
  return [
    ["Tanggal", "Jam", "Catatan", "Dari", "Ke", "Pelanggan", "Barang", "Nominal", "Keterangan"],
    ...urut.map((c) => {
      const nama = c.pelanggan_id ? namaPelanggan(c.pelanggan_id) : "";
      return [
        tanggalCatatan(c),
        jamDariMs(c.waktu),
        uraiCatatan(c, nama).judul,
        NAMA_TEMPAT[c.dari] || c.dari,
        NAMA_TEMPAT[c.ke] || c.ke,
        nama,
        (c.item || []).map((b) => `${b.nama} ×${b.jumlah}`).join(", "),
        c.nominal,
        c.keterangan || "",
      ];
    }),
  ];
}

export async function buatExcel(catatan, namaPelanggan) {
  const XLSX = await import("xlsx");
  const lembar = XLSX.utils.aoa_to_sheet(barisExcel(catatan, namaPelanggan));
  const buku = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(buku, lembar, "Catatan");
  const isi = XLSX.write(buku, { type: "array", bookType: "xlsx" });
  return new Blob([isi], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function simpanFile(blob, namaFile) {
  const alamat = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = alamat;
  a.download = namaFile;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(alamat), 10_000);
}
