import { afterEach, beforeAll, beforeEach, describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { LazyMotion, domMax, MotionGlobalConfig } from "motion/react";
import * as XLSX from "xlsx";
import Laporan from "../src/layar/Laporan/Laporan.jsx";
import Barang from "../src/layar/Barang/Barang.jsx";
import Pelanggan from "../src/layar/Pelanggan/Pelanggan.jsx";
import DetailPelanggan from "../src/layar/DetailPelanggan/DetailPelanggan.jsx";
import Riwayat from "../src/layar/Riwayat/Riwayat.jsx";
import Catatan from "../src/layar/Catatan/Catatan.jsx";
import { db, semuaAda } from "../src/data/db.js";
import { isiTempat, stokBarang } from "../src/data/hitung.js";
import { uangAwal, tambahBarang, tambahPelanggan, jual, terimaBon, tambahPengingat, hapusPelanggan, ubahBarang } from "../src/data/aksi.js";
import { buatExcel, barisExcel, barisPdf } from "../src/data/unduh.js";
import { saringRiwayat, kelompokPerTanggal, rincianBon, pesanBon } from "../src/data/uraian.js";
import { nomorWhatsApp } from "../src/data/format.js";
import { ringkasanBulan } from "../src/data/hitung.js";
import * as contoh from "./fixture.js";

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterEach(() => vi.useRealTimers());

const buka = (elemen, alamat = "/", pola = "/") =>
  render(
    <MemoryRouter initialEntries={[alamat]}>
      <LazyMotion features={domMax} strict>
        <Routes>
          <Route path={pola} element={elemen} />
          <Route path="*" element={<p>layar lain</p>} />
        </Routes>
      </LazyMotion>
    </MemoryRouter>
  );

const klik = (nama) => fireEvent.click(screen.getByRole("button", { name: nama }));
const lembarTertutup = () => waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
const catatan = () => semuaAda(db.catatan);

async function isiFixture() {
  vi.useFakeTimers({ toFake: ["Date"], now: contoh.WAKTU_SEKARANG });
  await db.pelanggan.bulkAdd(contoh.pelanggan.map((p) => ({ ...p, deleted: false })));
  await db.barang.bulkAdd(contoh.barang.map((b) => ({ ...b, deleted: false })));
  await db.catatan.bulkAdd(contoh.catatan);
}

describe("Laporan dengan data contoh rancangan", () => {
  beforeEach(isiFixture);

  test("Hari", async () => {
    buka(<Laporan />);
    const kartu = await screen.findByRole("region", { name: "Untung hari ini" });
    await within(kartu).findByText("Rp 56.000");
    expect(within(kartu).getByText("412.000")).toBeTruthy();
    expect(within(kartu).getByText("−336.000")).toBeTruthy();
    expect(within(kartu).getByText("−20.000")).toBeTruthy();
    const laci = screen.getByRole("region", { name: "Isi laci" });
    expect(laci.textContent).toContain("Pagi 827.000");
    expect(laci.textContent).toContain("1.146.000");
    expect(screen.getByRole("button", { name: /Bayar plastik/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Rokok Surya · bon Budi/ })).toBeTruthy();
  });

  test("Minggu", async () => {
    buka(<Laporan />);
    await screen.findByRole("region", { name: "Untung hari ini" });
    klik("Minggu");
    const kartu = await screen.findByRole("region", { name: "Untung minggu ini" });
    await within(kartu).findByText("Rp 224.000");
    expect(within(kartu).getByText("1.613.000")).toBeTruthy();
    expect(within(kartu).getByText("−1.329.000")).toBeTruthy();
    expect(within(kartu).getByText("−60.000")).toBeTruthy();
    expect(screen.getByText("Terbaik: Selasa")).toBeTruthy();
    const laci = screen.getByRole("region", { name: "Isi laci" });
    expect(laci.textContent).toContain("Naik Rp 190.000");
    expect(laci.textContent).toContain("Rp 956.000");
    expect(laci.textContent).toContain("+1.600.000");
    expect(laci.textContent).toContain("−1.410.000");
    expect(screen.getByRole("link", { name: /Bon pelanggan/ }).textContent).toContain("252.000 → 265.000");
    const grafik = screen.getByRole("img", { name: /Untung per hari/ });
    expect(grafik.getAttribute("aria-label")).toContain("Sen: Rp 58.000");
    expect(grafik.getAttribute("aria-label")).toContain("Jum: belum ada");
  });

  test("Bulan: pindah ke Oktober, tidak bisa ke bulan depan", async () => {
    buka(<Laporan />);
    await screen.findByRole("region", { name: "Untung hari ini" });
    klik("Bulan");
    expect(screen.getByRole("button", { name: "Bulan berikutnya" }).disabled).toBe(true);
    klik("Bulan sebelumnya");
    expect(screen.getByText("Oktober 2026")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bulan berikutnya" }).disabled).toBe(false);
    const kartu = await screen.findByRole("region", { name: "Untung bulan ini" });
    await within(kartu).findByText("Rp 2.050.000");
    expect(within(kartu).getByText("↑ 13% dari Sep")).toBeTruthy();
    expect(within(kartu).getByText("termasuk Rp 2.426.000 jualan tanpa modal")).toBeTruthy();
    expect(within(kartu).getByText("22–31")).toBeTruthy();
    const barang = screen.getByRole("region", { name: "Barang terbaik" });
    expect(barang.textContent).toContain("Indomie 312");
    expect(barang.textContent).toContain("Rokok Surya +288.000");
    const uang = screen.getByRole("region", { name: "Uang bulan ini" });
    expect(uang.textContent).toContain("−820.000");
    expect(uang.textContent).toContain("−1.200.000");
    expect(uang.textContent).toContain("Selisih laci (hitung ulang)−12.000");
    expect(uang.textContent).toContain("190.000 → 252.000");
  });

  test("Unduh: lembar menampilkan periode", async () => {
    buka(<Laporan />);
    await screen.findByRole("region", { name: "Untung hari ini" });
    klik("Minggu");
    klik("Unduh");
    const lembar = await screen.findByRole("dialog", { name: "Unduh laporan" });
    expect(lembar.textContent).toContain("Minggu ini · 2 Nov – 8 Nov");
    expect(within(lembar).getByRole("button", { name: /Excel/ })).toBeTruthy();
    expect(within(lembar).getByRole("button", { name: /PDF/ })).toBeTruthy();
  });
});

describe("file unduhan", () => {
  test("Excel punya satu baris per catatan ditambah judul", async () => {
    const nama = (id) => contoh.pelanggan.find((p) => p.id === id)?.nama;
    const blob = await buatExcel(contoh.catatan, nama);
    const buku = XLSX.read(await blob.arrayBuffer(), { type: "array" });
    const baris = XLSX.utils.sheet_to_json(buku.Sheets.Catatan, { header: 1 });
    expect(baris).toHaveLength(contoh.catatan.length + 1);
    expect(baris[0]).toEqual(["Tanggal", "Jam", "Catatan", "Dari", "Ke", "Pelanggan", "Barang", "Nominal", "Keterangan"]);
    const plastik = baris.find((b) => b[2] === "Bayar plastik");
    expect(plastik.slice(3, 5)).toEqual(["Laci", "Biaya"]);
    expect(plastik[7]).toBe(20000);
  });

  test("Excel mengabaikan catatan terhapus dan urut lama ke baru", () => {
    const baris = barisExcel([
      { id: "2", waktu: 2000, dari: "pembeli", ke: "laci", nominal: 2 },
      { id: "1", waktu: 1000, dari: "pembeli", ke: "laci", nominal: 1 },
      { id: "3", waktu: 3000, dari: "pembeli", ke: "laci", nominal: 3, deleted: true },
    ]);
    expect(baris.slice(1).map((b) => b[7])).toEqual([1, 2]);
  });

  test("PDF: isi ringkasan memakai tanda minus biasa", () => {
    const r = ringkasanBulan(contoh.catatan, "2026-10-15", contoh.HARI_INI);
    const peta = Object.fromEntries(barisPdf(r).filter((b) => b.length));
    expect(peta.Untung).toBe("Rp 2.050.000");
    expect(peta["Biaya warung"]).toBe("-Rp 820.000");
    expect(peta["Termasuk jualan tanpa modal"]).toBe("Rp 2.426.000");
    expect(peta["Paling laku"]).toBe("Indomie (312)");
    expect(JSON.stringify(barisPdf(r))).not.toContain("−");
  });
});

describe("Barang", () => {
  beforeEach(() => uangAwal(100000));

  const isiForm = async ({ nama, jual: hargaJual, beli, stok }) => {
    klik("+ Tambah");
    const lembar = await screen.findByRole("dialog", { name: "Tambah barang" });
    fireEvent.change(await within(lembar).findByRole("textbox", { name: "Nama" }), { target: { value: nama } });
    fireEvent.change(within(lembar).getByRole("textbox", { name: "Harga jual" }), { target: { value: String(hargaJual) } });
    if (beli) fireEvent.change(within(lembar).getByRole("textbox", { name: "Harga beli" }), { target: { value: String(beli) } });
    fireEvent.change(within(lembar).getByRole("spinbutton", { name: "Stok sekarang" }), { target: { value: String(stok) } });
    return lembar;
  };

  test("tambah barang sudah di rak: pemilik → stok, laci tetap", async () => {
    buka(<Barang />);
    const lembar = await isiForm({ nama: "Sabun", jual: 5000, beli: 4000, stok: 12 });
    expect(within(lembar).getByText("Rp 48.000")).toBeTruthy();
    expect(within(lembar).getByText("Pemilik")).toBeTruthy();
    klik("Simpan");
    await lembarTertutup();
    const b = (await semuaAda(db.barang))[0];
    expect(stokBarang(await catatan(), b.id)).toBe(12);
    expect(isiTempat(await catatan(), "laci")).toBe(100000);
    expect(await screen.findByRole("button", { name: /Sabun/ })).toBeTruthy();
  });

  test("tambah barang baru dibeli melebihi laci: minta persetujuan", async () => {
    buka(<Barang />);
    const lembar = await isiForm({ nama: "Rokok", jual: 30000, beli: 25000, stok: 10 });
    klik("Baru dibeli");
    expect(await within(lembar).findByText("Laci cuma Rp 100.000")).toBeTruthy();
    expect(within(lembar).getByRole("button", { name: "Simpan" }).disabled).toBe(true);
    klik("Ya, pakai");
    klik("Simpan");
    await lembarTertutup();
    expect(isiTempat(await catatan(), "laci")).toBe(0);
    expect((await catatan()).some((c) => c.dari === "pemilik" && c.ke === "laci" && c.nominal === 150000)).toBe(true);
  });

  test("harga beli kosong ditolak", async () => {
    buka(<Barang />);
    await isiForm({ nama: "Sabun", jual: 5000, stok: 1 });
    klik("Simpan");
    expect(await screen.findByText("Isi harga belinya dulu.")).toBeTruthy();
    expect(await db.barang.count()).toBe(0);
  });

  test("cari, filter hampir habis, dan tanda hampir habis", async () => {
    await tambahBarang({ nama: "Kopi", harga_jual: 2000, harga_beli: 1500, stok: 3 });
    await tambahBarang({ nama: "Gula", harga_jual: 17000, harga_beli: 15000, stok: 20 });
    buka(<Barang />);
    expect(await screen.findByLabelText("Stok 3, hampir habis")).toBeTruthy();
    expect(await screen.findByLabelText("Stok 20")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "Hampir habis · 1" }));
    expect(screen.queryByRole("button", { name: /Gula/ })).toBeNull();
    klik("Semua");
    fireEvent.change(screen.getByRole("searchbox", { name: "Cari barang" }), { target: { value: "gul" } });
    expect(screen.queryByRole("button", { name: /Kopi/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Gula/ })).toBeTruthy();
  });

  test("batas hampir habis mengikuti pengaturan barang", async () => {
    const { barang } = await tambahBarang({ nama: "Kopi", harga_jual: 2000, harga_beli: 1500, stok: 3, batas_hampir_habis: 2 });
    buka(<Barang />);
    expect(await screen.findByLabelText("Stok 3")).toBeTruthy();
    await ubahBarang(barang.id, { nama: "Kopi", harga_jual: 2000, harga_beli: 1500, batas_hampir_habis: 3 });
    expect(await screen.findByLabelText("Stok 3, hampir habis")).toBeTruthy();
  });

  test("ubah barang: stok tidak berubah, nama ganda ditolak", async () => {
    await tambahBarang({ nama: "Teh", harga_jual: 3000, harga_beli: 2000, stok: 1 });
    const { barang } = await tambahBarang({ nama: "Kopi", harga_jual: 2000, harga_beli: 1500, stok: 3 });
    buka(<Barang />);
    fireEvent.click(await screen.findByRole("button", { name: /Kopi/ }));
    const lembar = await screen.findByRole("dialog", { name: "Ubah barang" });
    const nama = await within(lembar).findByRole("textbox", { name: "Nama" });
    fireEvent.change(nama, { target: { value: "teh" } });
    klik("Simpan");
    expect(await within(lembar).findByText(/sudah ada/)).toBeTruthy();
    fireEvent.change(nama, { target: { value: "Kopi Hitam" } });
    fireEvent.change(within(lembar).getByRole("textbox", { name: "Harga jual" }), { target: { value: "2500" } });
    klik("Simpan");
    await lembarTertutup();
    expect(await db.barang.get(barang.id)).toMatchObject({ nama: "Kopi Hitam", harga_jual: 2500 });
    expect(stokBarang(await catatan(), barang.id)).toBe(3);
  });

  test("koreksi stok berkurang: rute stok → biaya dengan nilai, alasan tersimpan", async () => {
    const { barang } = await tambahBarang({ nama: "Indomie", harga_jual: 3500, harga_beli: 3000, stok: 22 });
    buka(<Barang />);
    fireEvent.click(await screen.findByRole("button", { name: /Indomie/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Jumlah di rak beda (rusak/hilang)? Koreksi stok" }));
    const lembar = await screen.findByRole("dialog", { name: "Koreksi stok" });
    fireEvent.change(within(lembar).getByRole("spinbutton", { name: "Jumlah di rak sebenarnya" }), { target: { value: "20" } });
    expect(within(lembar).getByText("−Rp 6.000")).toBeTruthy();
    expect(within(lembar).getByText("2 × Rp 3.000")).toBeTruthy();
    fireEvent.click(within(lembar).getByRole("button", { name: "Hilang" }));
    fireEvent.click(within(lembar).getByRole("button", { name: "Simpan" }));
    await lembarTertutup();
    expect(stokBarang(await catatan(), barang.id)).toBe(20);
    expect((await catatan()).find((c) => c.dari === "stok")).toMatchObject({ ke: "biaya", nominal: 6000, keterangan: "Hilang" });
  });

  test("alur 1: Ubah barang → + Tambah stok membuka Belanja dengan barang terpilih", async () => {
    const { barang } = await tambahBarang({ nama: "Bensin", harga_jual: 12000, harga_beli: 9500, stok: 3 });
    buka(<Barang />);
    fireEvent.click(await screen.findByRole("button", { name: /Bensin/ }));
    fireEvent.click(await screen.findByRole("button", { name: "+ Tambah stok" }));
    const lembar = await screen.findByRole("dialog", { name: "Belanja" });
    await waitFor(() => expect(within(lembar).getByRole("combobox", { name: "Barang" }).value).toBe(barang.id));
    expect(screen.queryByRole("dialog", { name: "Ubah barang" })).toBeNull();

    fireEvent.change(within(lembar).getByRole("spinbutton", { name: "Jumlah" }), { target: { value: "5" } });
    fireEvent.change(within(lembar).getByRole("textbox", { name: "Total" }), { target: { value: "50000" } });
    expect(within(lembar).getByText("Rp 10.000 per unit, sebelumnya Rp 9.500")).toBeTruthy();
    fireEvent.click(within(lembar).getByRole("button", { name: "Simpan" }));
    await lembarTertutup();
    expect(stokBarang(await catatan(), barang.id)).toBe(8);
    expect((await db.barang.get(barang.id)).harga_beli).toBe(10000);
    await waitFor(() => expect(document.body.style.overflow).toBe(""));
  });

  test("alur 2: nama sudah ada menawarkan tambah stok, tanpa membuat barang baru", async () => {
    const { barang } = await tambahBarang({ nama: "Bensin", harga_jual: 12000, harga_beli: 9500, stok: 3 });
    buka(<Barang />);
    klik("+ Tambah");
    const lembar = await screen.findByRole("dialog", { name: "Tambah barang" });
    const nama = await within(lembar).findByRole("textbox", { name: "Nama" });
    fireEvent.change(nama, { target: { value: "bensin " } });
    expect(await within(lembar).findByText("Bensin sudah ada. Mau tambah stoknya?")).toBeTruthy();
    expect(within(lembar).getByRole("button", { name: "Simpan" }).disabled).toBe(true);

    fireEvent.change(nama, { target: { value: "Bensin Super" } });
    expect(within(lembar).queryByText(/sudah ada/)).toBeNull();
    expect(within(lembar).getByRole("button", { name: "Simpan" }).disabled).toBe(false);
    fireEvent.change(nama, { target: { value: "BENSIN" } });

    fireEvent.click(await within(lembar).findByRole("button", { name: "Tambah stok" }));
    const belanja = await screen.findByRole("dialog", { name: "Belanja" });
    await waitFor(() => expect(within(belanja).getByRole("combobox", { name: "Barang" }).value).toBe(barang.id));
    expect(await db.barang.count()).toBe(1);
  });

  test("Belanja: + Barang baru membuka Tambah barang dengan Baru dibeli terpilih", async () => {
    buka(<Barang />);
    await tambahBarang({ nama: "Bensin", harga_jual: 12000, harga_beli: 9500, stok: 3 });
    fireEvent.click(await screen.findByRole("button", { name: /Bensin/ }));
    fireEvent.click(await screen.findByRole("button", { name: "+ Tambah stok" }));
    const belanja = await screen.findByRole("dialog", { name: "Belanja" });
    fireEvent.change(await within(belanja).findByRole("combobox", { name: "Barang" }), { target: { value: "barang-baru" } });
    const tambah = await screen.findByRole("dialog", { name: "Tambah barang" });
    expect((await within(tambah).findByRole("button", { name: "Baru dibeli" })).getAttribute("aria-pressed")).toBe("true");
  });

  test("Belanja: harga per unit, tanpa harga sebelumnya kalau sama", async () => {
    await tambahBarang({ nama: "Bensin", harga_jual: 12000, harga_beli: 10000, stok: 3 });
    buka(<Barang />);
    fireEvent.click(await screen.findByRole("button", { name: /Bensin/ }));
    fireEvent.click(await screen.findByRole("button", { name: "+ Tambah stok" }));
    const lembar = await screen.findByRole("dialog", { name: "Belanja" });
    const total = await within(lembar).findByRole("textbox", { name: "Total" });
    fireEvent.change(total, { target: { value: "50000" } });
    expect(within(lembar).queryByText(/per unit/)).toBeNull();
    fireEvent.change(within(lembar).getByRole("spinbutton", { name: "Jumlah" }), { target: { value: "5" } });
    expect(within(lembar).getByText("Rp 10.000 per unit")).toBeTruthy();
  });

  test("koreksi dari lembar Rincian langsung membuka barangnya", async () => {
    const { barang } = await tambahBarang({ nama: "Indomie", harga_jual: 3500, harga_beli: 3000, stok: 22 });
    render(
      <MemoryRouter initialEntries={[{ pathname: "/", state: { koreksi: barang.id } }]}>
        <LazyMotion features={domMax} strict>
          <Barang />
        </LazyMotion>
      </MemoryRouter>
    );
    const lembar = await screen.findByRole("dialog", { name: "Koreksi stok" });
    expect(lembar.textContent).toContain("Indomie");
  });
});

describe("Pelanggan", () => {
  test("daftar: total bon, yang lunas di bawah", async () => {
    const { pelanggan: andi } = await tambahPelanggan({ nama: "Andi" });
    await tambahPelanggan({ nama: "Sari", bonLama: 120000 });
    await tambahPelanggan({ nama: "Budi", bonLama: 53000 });
    buka(<Pelanggan />);
    const kartu = await screen.findByRole("region", { name: "Total bon" });
    await within(kartu).findByText("Rp 173.000");
    expect(kartu.textContent).toContain("2 orang belum lunas");
    const baris = (await screen.findAllByRole("link")).map((a) => a.textContent);
    expect(baris[0]).toContain("Sari");
    expect(baris[1]).toContain("Budi");
    expect(baris[2]).toContain("Andi");
    expect(baris[2]).toContain("Lunas");
    expect(screen.getByRole("link", { name: /Andi/ }).getAttribute("href")).toBe(`/pelanggan/${andi.id}`);
  });

  test("tambah pelanggan dengan bon lama", async () => {
    buka(<Pelanggan />);
    klik("+ Tambah");
    const lembar = await screen.findByRole("dialog", { name: "Tambah pelanggan" });
    fireEvent.change(within(lembar).getByRole("textbox", { name: "Nama" }), { target: { value: "Pak Joko" } });
    fireEvent.change(within(lembar).getByRole("textbox", { name: "Nomor WhatsApp (boleh kosong)" }), { target: { value: "0813 1234" } });
    fireEvent.change(within(lembar).getByRole("textbox", { name: "Bon lama yang belum dicatat" }), { target: { value: "15000" } });
    expect(within(lembar).getByText("Bon: Pak Joko")).toBeTruthy();
    klik("Simpan");
    await lembarTertutup();
    const p = (await semuaAda(db.pelanggan))[0];
    expect(p.no_wa).toBe("0813 1234");
    expect(isiTempat(await catatan(), "bon", p.id)).toBe(15000);
    expect(isiTempat(await catatan(), "laci")).toBe(0);
  });

  const siapkanBudi = async () => {
    await uangAwal(100000);
    const { pelanggan } = await tambahPelanggan({ nama: "Budi", no_wa: "0812-3456" });
    await jual({ lainnya: 45000, keterangan: "Kopi, gula", bayar: "bon", pelangganId: pelanggan.id });
    await jual({ lainnya: 28000, keterangan: "Rokok", bayar: "bon", pelangganId: pelanggan.id });
    await terimaBon({ pelangganId: pelanggan.id, nominal: 20000 });
    return pelanggan;
  };
  const bukaDetail = (id) => buka(<DetailPelanggan />, `/pelanggan/${id}`, "/pelanggan/:id");

  test("detail: bon, riwayat, Terima bon", async () => {
    const p = await siapkanBudi();
    bukaDetail(p.id);
    const kartu = await screen.findByRole("region", { name: "Bon Budi" });
    await within(kartu).findByText("Rp 53.000");
    expect(await screen.findByRole("button", { name: /Budi bayar bon/ })).toBeTruthy();
    klik("Terima bon");
    const lembar = await screen.findByRole("dialog", { name: "Terima bon" });
    const budi = await within(lembar).findByRole("button", { name: /Budi/ });
    expect(budi.getAttribute("aria-pressed")).toBe("true");
    klik("Lunas");
    fireEvent.click(within(lembar).getByRole("button", { name: "Simpan" }));
    await lembarTertutup();
    expect(await within(kartu).findByText("Lunas")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ingatkan via WA" })).toBeNull();
  });

  test("pengingat WA: pesan berisi rincian, tautan wa.me benar, bisa diubah", async () => {
    const p = await siapkanBudi();
    bukaDetail(p.id);
    fireEvent.click(await screen.findByRole("button", { name: "Ingatkan via WA" }));
    const lembar = await screen.findByRole("dialog", { name: "Ingatkan Budi" });
    expect(lembar.textContent).toContain("Bon kamu sekarang *Rp 53.000*");
    expect(lembar.textContent).toContain("Kopi, gula");
    const tautan = within(lembar).getByRole("link", { name: "Kirim lewat WhatsApp" });
    expect(tautan.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/628123456\?text=/);
    expect(decodeURIComponent(tautan.getAttribute("href").split("text=")[1])).toContain("Halo Budi");
    fireEvent.click(within(lembar).getByRole("button", { name: "Ubah pesan" }));
    fireEvent.change(within(lembar).getByRole("textbox", { name: "Isi pesan" }), { target: { value: "Halo, tolong dibayar" } });
    expect(tautan.getAttribute("href")).toContain(encodeURIComponent("Halo, tolong dibayar"));
  });

  test("pelanggan berbon tidak bisa dihapus, yang lunas bisa", async () => {
    const p = await siapkanBudi();
    expect((await hapusPelanggan(p.id)).galat).toContain("masih punya bon");
    await terimaBon({ pelangganId: p.id, nominal: 53000 });
    expect(await hapusPelanggan(p.id)).toEqual({});
    expect((await db.pelanggan.get(p.id)).deleted).toBe(true);
  });
});

describe("Semua riwayat", () => {
  beforeEach(isiFixture);

  test("dikelompokkan per tanggal dengan jumlah catatan", async () => {
    buka(<Riwayat />);
    expect(await screen.findByRole("heading", { name: "Kamis, 5 Nov · 7 catatan" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Rabu, 4 Nov · 4 catatan" })).toBeTruthy();
  });

  test("filter dan pencarian", async () => {
    buka(<Riwayat />);
    await screen.findByRole("heading", { name: "Kamis, 5 Nov · 7 catatan" });
    klik("Belanja");
    expect(await screen.findByRole("heading", { name: "Kamis, 5 Nov · 2 catatan" })).toBeTruthy();
    klik("Semua");
    fireEvent.change(screen.getByRole("searchbox", { name: "Cari catatan" }), { target: { value: "budi" } });
    expect(await screen.findByRole("button", { name: /Budi bayar bon/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Bayar plastik/ })).toBeNull();
    fireEvent.change(screen.getByRole("searchbox", { name: "Cari catatan" }), { target: { value: "tidak ada" } });
    expect(await screen.findByText("Tidak ada catatan yang cocok.")).toBeTruthy();
  });

  test("tampil bertahap: daftar panjang dimulai dari 50 baris", async () => {
    const banyak = Array.from({ length: 180 }, (_, i) => ({ id: `b${i}`, waktu: new Date(2026, 10, 5, 8, 0).getTime() + i * 1000, dari: "pembeli", ke: "laci", nominal: 1000, item: [], keterangan: `Banyak ${i}`, deleted: false }));
    await db.catatan.bulkAdd(banyak);
    buka(<Riwayat />);
    await screen.findByRole("heading", { name: "Kamis, 5 Nov · 187 catatan" });
    expect(screen.getAllByRole("listitem")).toHaveLength(50);
    klik("Tampilkan lagi");
    expect(screen.getAllByRole("listitem")).toHaveLength(100);
  });

  test("baris membuka Rincian", async () => {
    buka(<Riwayat />);
    fireEvent.click(await screen.findByRole("button", { name: /Bayar plastik/ }));
    expect(await screen.findByRole("dialog", { name: "Bayar plastik" })).toBeTruthy();
  });
});

describe("fungsi riwayat dan WA", () => {
  test("saringRiwayat setiap filter", () => {
    const hitung = (filter) => saringRiwayat(contoh.catatan, { filter }).length;
    expect(hitung("semua")).toBe(contoh.catatan.length);
    expect(hitung("jual")).toBe(contoh.catatan.filter((c) => c.dari === "pembeli").length);
    expect(hitung("belanja")).toBe(contoh.catatan.filter((c) => c.ke === "agen" || c.ke === "biaya").length);
    expect(hitung("bon")).toBe(contoh.catatan.filter((c) => c.dari === "bon" || c.ke === "bon").length);
    expect(hitung("laci")).toBe(3); // uang awal, selisih, ambil pribadi
  });

  test("kelompok menghitung semua catatan walau yang tampil sebagian", () => {
    const daftar = saringRiwayat(contoh.catatan, {});
    expect(kelompokPerTanggal(daftar.slice(0, 2), daftar)[0]).toMatchObject({ label: "Kamis, 5 Nov", jumlah: 7 });
    expect(kelompokPerTanggal(daftar.slice(0, 2), daftar)[0].catatan).toHaveLength(2);
  });

  test("rincian bon mulai sejak terakhir lunas dan menjumlah tepat ke sisa", () => {
    const b = (waktu, nominal, keBon = true) => ({ id: String(waktu), waktu, pelanggan_id: "x", nominal, ...(keBon ? { dari: "pembeli", ke: "bon" } : { dari: "bon", ke: "laci" }) });
    const daftar = [b(1, 10000), b(2, 10000, false), b(3, 5000), b(4, 2000, false)];
    const rincian = rincianBon(daftar, "x");
    expect(rincian.map((c) => c.waktu)).toEqual([3, 4]);
    expect(rincian.reduce((n, c) => n + (c.ke === "bon" ? c.nominal : -c.nominal), 0)).toBe(3000);
  });

  test("pesan bon", () => {
    const rincian = [
      { waktu: new Date(2026, 10, 2).getTime(), dari: "pembeli", ke: "bon", nominal: 45000, item: [{ nama: "Kopi" }, { nama: "Gula" }] },
      { waktu: new Date(2026, 10, 5).getTime(), dari: "bon", ke: "laci", nominal: 20000 },
      { waktu: new Date(2026, 10, 5).getTime(), dari: "pemilik", ke: "bon", nominal: 5000 },
    ];
    const pesan = pesanBon({ namaWarung: "Warung Sari", nama: "Budi", bon: 30000, rincian });
    expect(pesan).toContain("Halo Budi, ini dari Warung Sari.");
    expect(pesan).toContain("*Rp 30.000*");
    expect(pesan).toContain("2 Nov  Kopi, Gula  Rp 45.000");
    expect(pesan).toContain("5 Nov  Bayar  −Rp 20.000");
    expect(pesan).toContain("5 Nov  Bon lama  Rp 5.000");
  });

  test("nomor WhatsApp", () => {
    expect(nomorWhatsApp("0812-3456")).toBe("628123456");
    expect(nomorWhatsApp("812 3456")).toBe("628123456");
    expect(nomorWhatsApp("+62 812")).toBe("62812");
    expect(nomorWhatsApp("")).toBe("");
  });
});

describe("Catatan", () => {
  test("tambah pengingat, centang pindah ke Selesai, hapus lunak", async () => {
    buka(<Catatan />);
    fireEvent.change(await screen.findByRole("textbox", { name: "Pengingat baru" }), { target: { value: "Beli gas" } });
    fireEvent.click(screen.getByRole("button", { name: "Tambah pengingat" }));
    const centang = await screen.findByRole("checkbox", { name: /Beli gas/ });
    expect(screen.getByRole("button", { name: "Pengingat · 1" })).toBeTruthy();
    fireEvent.click(centang);
    expect(await screen.findByRole("heading", { name: "Selesai" })).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("button", { name: "Pengingat" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Hapus Beli gas" }));
    await waitFor(() => expect(screen.queryByRole("checkbox", { name: /Beli gas/ })).toBeNull());
    expect((await db.pengingat.toArray())[0].deleted).toBe(true);
  });

  test("pengingat yang lewat waktu ditandai, yang belum tidak", async () => {
    await tambahPengingat({ teks: "Lewat", waktu_ingat: Date.now() - 60000 });
    await tambahPengingat({ teks: "Nanti", waktu_ingat: Date.now() + 3600000 });
    buka(<Catatan />);
    const lewat = (await screen.findByRole("checkbox", { name: /Lewat/ })).closest("label").querySelector("small");
    const nanti = (await screen.findByRole("checkbox", { name: /Nanti/ })).closest("label").querySelector("small");
    expect(lewat.className).toContain("lewat");
    expect(nanti.className).not.toContain("lewat");
  });

  test("catatan saya: tambah, ubah, hapus, tidak memengaruhi catatan uang", async () => {
    buka(<Catatan />);
    fireEvent.click(await screen.findByRole("button", { name: "Catatan saya" }));
    fireEvent.click(await screen.findByRole("button", { name: "Catatan baru" }));
    let lembar = await screen.findByRole("dialog", { name: "Catatan baru" });
    fireEvent.change(within(lembar).getByRole("textbox", { name: "Judul" }), { target: { value: "Nomor agen" } });
    fireEvent.change(within(lembar).getByRole("textbox", { name: "Isi" }), { target: { value: "Pak Udin 0812" } });
    fireEvent.click(within(lembar).getByRole("button", { name: "Kuning" }));
    fireEvent.click(within(lembar).getByRole("button", { name: "Simpan" }));
    await lembarTertutup();
    fireEvent.click(await screen.findByRole("button", { name: /Nomor agen/ }));
    lembar = await screen.findByRole("dialog", { name: "Ubah catatan" });
    expect(within(lembar).getByRole("textbox", { name: "Judul" }).value).toBe("Nomor agen");
    fireEvent.click(within(lembar).getByRole("button", { name: "Hapus catatan" }));
    fireEvent.click(within(lembar).getByRole("button", { name: "Tekan lagi untuk menghapus" }));
    await lembarTertutup();
    expect(screen.queryByRole("button", { name: /Nomor agen/ })).toBeNull();
    expect(await db.catatan.count()).toBe(0);
  });

  test("catatan kosong ditolak", async () => {
    buka(<Catatan />);
    fireEvent.click(await screen.findByRole("button", { name: "Catatan saya" }));
    fireEvent.click(await screen.findByRole("button", { name: "Catatan baru" }));
    const lembar = await screen.findByRole("dialog", { name: "Catatan baru" });
    fireEvent.click(within(lembar).getByRole("button", { name: "Simpan" }));
    expect(await within(lembar).findByText("Tulis catatannya dulu.")).toBeTruthy();
  });
});
