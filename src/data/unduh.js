// unduh.js: membuat file Excel dan PDF di HP. Library-nya besar, jadi baru dimuat saat tombol ditekan.

import { tanggalCatatan } from "./hitung.js";
import { uraiCatatan } from "./uraian.js";
import { jamDariMs } from "./tanggal.js";
import { ribuan } from "./format.js";

const NAMA_TEMPAT = { laci: "Laci", bon: "Bon", stok: "Stok", pembeli: "Pembeli", agen: "Agen", biaya: "Biaya", pemilik: "Pemilik", selisih: "Selisih" };

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

// Font bawaan PDF tidak punya tanda minus khusus, jadi di sini memakai "-"
const rupiahPdf = (n) => `${n < 0 ? "-" : ""}Rp ${ribuan(Math.abs(n))}`;

// Isi ringkasan PDF: [[label, nilai]], baris kosong untuk jarak
export function barisPdf(r) {
  const baris = [
    ["Untung", rupiahPdf(r.untung)],
    ["Hasil jualan", rupiahPdf(r.hasil)],
    ["Modal barang yang terjual", rupiahPdf(-r.modal)],
    ["Biaya warung", rupiahPdf(-r.biaya)],
  ];
  if (r.jualanTanpaModal > 0) baris.push(["Termasuk jualan tanpa modal", rupiahPdf(r.jualanTanpaModal)]);
  baris.push([]);
  if (r.laciAwal !== undefined) {
    baris.push(["Isi laci awal", rupiahPdf(r.laciAwal)], ["Isi laci akhir", rupiahPdf(r.laciAkhir)]);
  }
  if (r.masuk !== undefined) baris.push(["Laci masuk", rupiahPdf(r.masuk)], ["Laci keluar", rupiahPdf(-r.keluar)]);
  if (r.bonAwal !== undefined) baris.push(["Bon awal", rupiahPdf(r.bonAwal)], ["Bon akhir", rupiahPdf(r.bonAkhir)]);
  if (r.diambilPribadi !== undefined) baris.push(["Diambil pribadi", rupiahPdf(-r.diambilPribadi)], ["Selisih laci (hitung ulang)", rupiahPdf(r.selisihLaci)]);
  if (r.palingLaku) baris.push([], ["Paling laku", `${r.palingLaku.nama} (${ribuan(r.palingLaku.jumlah)})`]);
  if (r.palingUntung) baris.push(["Paling untung", `${r.palingUntung.nama} (${rupiahPdf(r.palingUntung.untung)})`]);
  return baris;
}

export async function buatPdf({ namaWarung, judul, ringkasan }) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text(namaWarung, 20, 25);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(12);
  pdf.text(judul, 20, 33);
  let y = 48;
  for (const [label, nilai] of barisPdf(ringkasan)) {
    if (label) {
      pdf.text(label, 20, y);
      pdf.text(nilai, 190, y, { align: "right" });
    }
    y += label ? 8 : 5;
  }
  return pdf.output("blob");
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
