import { beforeEach, afterEach, describe, test, expect, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { catatan as contoh, barang, pelanggan, HARI_INI } from "./fixture.js";
import Cetak, { HalamanCetak } from "../src/layar/Cetak/Cetak.jsx";
import { db, aturMeta } from "../src/data/db.js";

const namaDari = (id) => pelanggan.find((p) => p.id === id)?.nama || "pelanggan";
const data = (catatan = contoh) => ({ catatan, barang, namaWarung: "Warung Uji", namaDari });
const tampil = (periode, tanggal, isi = data()) => render(<HalamanCetak periode={periode} tanggal={tanggal} data={isi} kini={HARI_INI} dicetak="5 Nov 2026" />);
const halaman = () => screen.getAllByRole("region", { name: /^Halaman \d+$/ });

const banyakCatatan = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: `x${i}`,
    waktu: new Date(2026, 10, 5, 6, i).getTime(),
    dari: "pembeli",
    ke: "laci",
    nominal: 1000 + i,
    pelanggan_id: null,
    item: [],
    keterangan: `Jualan nomor ${i}`,
    deleted: false,
  }));

describe("laporan harian", () => {
  test("60 catatan terbagi ke beberapa halaman, tidak ada yang hilang, nomor halaman benar", () => {
    tampil("hari", HARI_INI, data(banyakCatatan(60)));
    const semua = halaman();
    expect(semua.length).toBeGreaterThan(2);
    semua.forEach((h, i) => expect(within(h).getByText(`Halaman ${i + 1} dari ${semua.length}`)).toBeTruthy());
    for (let i = 0; i < 60; i++) expect(screen.getAllByText(`Jualan nomor ${i}`)).toHaveLength(1);
    // Halaman 1 ringkasan; catatan mulai di halaman 2, dan judul tabel lanjutannya jelas
    expect(within(semua[0]).queryByText("Jualan nomor 0")).toBeNull();
    expect(within(semua[1]).getByText("Jualan nomor 0")).toBeTruthy();
    expect(within(semua[2]).getByText("Semua catatan (lanjutan)")).toBeTruthy();
    // Kop lengkap hanya di halaman pertama
    expect(within(semua[0]).getByRole("heading", { level: 1, name: "Warung Uji" })).toBeTruthy();
    expect(within(semua[1]).queryByRole("heading", { level: 1 })).toBeNull();
    expect(within(semua[1]).getByText("Warung Uji · Laporan Harian")).toBeTruthy();
  });

  test("urut lama ke baru, baris bon ditandai", () => {
    tampil("hari", HARI_INI);
    const baris = within(halaman()[1]).getAllByRole("row").slice(1);
    expect(baris[0].textContent).toContain("07.00");
    const bon = baris.find((b) => b.textContent.includes("Budi bayar bon"));
    expect(bon.textContent).toContain("Bon → Laci");
    expect(bon.className).toMatch(/barisBon/);
    expect(baris.find((b) => b.textContent.includes("Bayar plastik")).textContent).toContain("−20.000");
  });

  test("angka kartu sama dengan ringkasan layar", () => {
    tampil("hari", HARI_INI);
    const satu = within(halaman()[0]);
    expect(satu.getByText("Untung bersih").parentElement.textContent).toContain("56.000");
    expect(satu.getAllByText("Hasil jualan")[0].parentElement.textContent).toContain("412.000");
    expect(satu.getByText(/Hitung uang di laci sekarang/)).toBeTruthy();
  });

  test("tanpa catatan: cukup satu halaman", () => {
    tampil("hari", "2026-08-01", data([]));
    expect(halaman()).toHaveLength(1);
  });
});

describe("laporan mingguan dan bulanan", () => {
  test("mingguan: grafik, barang terlaris, bon per orang, dua halaman", () => {
    tampil("minggu", HARI_INI);
    expect(halaman()).toHaveLength(2);
    const [satu, dua] = halaman().map((h) => within(h));
    expect(satu.getByRole("heading", { name: "Untung per hari" })).toBeTruthy();
    expect(satu.getByRole("heading", { name: "Arus uang laci" })).toBeTruthy();
    expect(satu.getByText("Sen")).toBeTruthy();
    expect(satu.getByText("58.000")).toBeTruthy();
    expect(dua.getByRole("heading", { name: "Barang terlaris" })).toBeTruthy();
    expect(dua.getByRole("heading", { name: "Bon pelanggan" })).toBeTruthy();
    expect(dua.getByText("Stok perlu dibeli")).toBeTruthy();
    expect(dua.getByText("Cara membaca")).toBeTruthy();
    expect(dua.getByText("Budi")).toBeTruthy();
  });

  test("bon pelanggan yang banyak lanjut ke halaman berikutnya, tidak terpotong", () => {
    const orang = Array.from({ length: 50 }, (_, i) => ({ id: `o${i}`, waktu: new Date(2026, 10, 3, 9, i).getTime(), dari: "pembeli", ke: "bon", nominal: 1000, pelanggan_id: `p${i}`, item: [], keterangan: "", deleted: false }));
    tampil("minggu", HARI_INI, { ...data(orang), namaDari: (id) => `Orang ${id}` });
    expect(halaman().length).toBeGreaterThan(2);
    for (let i = 0; i < 50; i++) expect(screen.getAllByText(`Orang p${i}`)).toHaveLength(1);
  });

  test("bulanan: perbandingan bulan lalu, kalender, dan Lunas", () => {
    tampil("bulan", "2026-10-15");
    expect(halaman()).toHaveLength(2);
    const [satu, dua] = halaman().map((h) => within(h));
    expect(satu.getByText("↑ 13% dari bulan lalu")).toBeTruthy();
    expect(satu.getByText("Bulan sudah selesai")).toBeTruthy();
    expect(satu.getByText("Oktober 2026")).toBeTruthy();
    expect(satu.getByText("22–31")).toBeTruthy();
    expect(dua.getByRole("heading", { name: "Kalender untung" })).toBeTruthy();
    expect(dua.getByText("Perlu diperhatikan")).toBeTruthy();
  });
});

describe("rute cetak", () => {
  const judulLama = "Buku Warung";
  const buka = (alamat) =>
    render(
      <MemoryRouter initialEntries={[alamat]}>
        <Routes>
          <Route path="/cetak/:periode/:tanggal" element={<Cetak />} />
          <Route path="/laporan" element={<p>Layar laporan</p>} />
        </Routes>
      </MemoryRouter>
    );

  beforeEach(async () => {
    await db.delete();
    await db.open();
    await aturMeta("nama_warung", "Warung Budi");
    await db.catatan.bulkPut(contoh.map((c) => ({ ...c, dirty: 0 })));
    // Pelanggan yang sudah dihapus tetap disebut namanya di riwayat lama
    await db.pelanggan.bulkPut(pelanggan.map((p) => ({ ...p, deleted: p.id === "budi" })));
    window.print = vi.fn();
    document.title = judulLama;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.classList.remove("sedang-cetak");
  });

  test("mencetak sekali setelah data siap, judul jadi nama file, dan dikembalikan saat keluar", async () => {
    const { unmount } = buka("/cetak/minggu/2026-11-05");
    await waitFor(() => expect(window.print).toHaveBeenCalledTimes(1), { timeout: 8000 });
    expect(document.title).toBe("Buku Warung - Mingguan 2-8 Nov 2026");
    expect(document.body.classList.contains("sedang-cetak")).toBe(true);
    // Cetak terjadi sesudah halaman berisi data
    expect(screen.getByRole("heading", { level: 1, name: "Warung Budi" })).toBeTruthy();
    expect(screen.getByText("Budi")).toBeTruthy();
    unmount();
    expect(document.title).toBe(judulLama);
    expect(document.body.classList.contains("sedang-cetak")).toBe(false);
  });

  test("alamat salah: tidak mencetak", async () => {
    buka("/cetak/tahun/2026-11-05");
    expect(await screen.findByText("Alamat laporan ini tidak dikenali.")).toBeTruthy();
    expect(window.print).not.toHaveBeenCalled();
  });
});
