import { afterEach, beforeAll, beforeEach, describe, test, expect } from "vitest";
import { act, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { LazyMotion, domMax, MotionGlobalConfig } from "motion/react";
import Beranda from "../src/layar/Beranda/Beranda.jsx";
import { db, semuaAda } from "../src/data/db.js";
import { isiTempat, stokBarang } from "../src/data/hitung.js";
import { uangAwal, tambahBarang, tambahPelanggan, jual, belanja, terimaBon } from "../src/data/aksi.js";

let kopi;
let budi;

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(async () => {
  await db.delete();
  await db.open();
  await uangAwal(100000);
  kopi = (await tambahBarang({ nama: "Kopi", harga_jual: 2000, harga_beli: 1500, stok: 5 })).barang;
  budi = (await tambahPelanggan({ nama: "Budi" })).pelanggan;
});

const buka = () =>
  render(
    <MemoryRouter>
      <LazyMotion features={domMax} strict>
        <Beranda />
      </LazyMotion>
    </MemoryRouter>
  );

const catatan = () => semuaAda(db.catatan);
const klik = (nama) => fireEvent.click(screen.getByRole("button", { name: nama }));
const laciTampil = (teks) => waitFor(() => expect(within(screen.getByRole("region", { name: "Isi laci" })).getByText(teks)).toBeTruthy());
const lembarTertutup = () => waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
const tampilkanLembar = async (nama, tombol) => {
  await screen.findByRole("button", { name: nama });
  klik(nama);
  return screen.findByRole("dialog", { name: tombol || nama });
};

describe("Beranda", () => {
  test("menampilkan isi laci dan bon dari data", async () => {
    await jual({ lainnya: 28000, bayar: "bon", pelangganId: budi.id });
    buka();
    await laciTampil("Rp 100.000");
    expect((await screen.findByText("Bon pelanggan")).closest("a").textContent).toContain("Rp 28.000");
    // Uang awal dan jual bon bukan uang masuk dari kegiatan warung
    expect(await screen.findByText("Belum ada uang masuk atau keluar hari ini")).toBeTruthy();
    expect(screen.queryByText("+Rp 100.000")).toBeNull();
  });

  test("kapsul Hari ini hanya menghitung kegiatan warung", async () => {
    await jual({ lainnya: 28000 });
    buka();
    await laciTampil("Rp 128.000");
    expect(await screen.findByText("+Rp 28.000")).toBeTruthy();
    expect(screen.queryByText("+Rp 128.000")).toBeNull();
  });

  test("pengguna baru: tampilan kosong dengan ajakan tambah barang", async () => {
    await db.delete();
    await db.open();
    buka();
    expect(await screen.findByText("Belum ada catatan")).toBeTruthy();
    expect(screen.getByRole("link", { name: "+ Tambah barang" }).getAttribute("href")).toBe("/barang");
    expect(screen.queryByText("Bon pelanggan")).toBeNull();
  });

  test("daftar hari ini hanya 4 terakhir, terbaru di atas", async () => {
    for (const n of [1000, 2000, 3000, 4000, 5000]) {
      await jual({ lainnya: n, keterangan: `Jualan ${n}` });
      await new Promise((r) => setTimeout(r, 3)); // supaya waktunya tidak ada yang sama
    }
    buka();
    await screen.findByText("Jualan 5000");
    expect(screen.queryByText("Jualan 1000")).toBeNull();
    expect(screen.getByRole("link", { name: "Semua riwayat" }).getAttribute("href")).toBe("/riwayat");
  });
});

describe("alur Jual", () => {
  test("jual tunai: laci dan stok berubah, tidak ada yang tersimpan sebelum Simpan", async () => {
    buka();
    await laciTampil("Rp 100.000");
    await tampilkanLembar("Jual");
    fireEvent.click(await screen.findByRole("button", { name: "Tambah Kopi" }));
    fireEvent.click(screen.getByRole("button", { name: "Tambah Kopi" }));
    expect(within(screen.getByRole("dialog")).getByText("Rp 4.000")).toBeTruthy();
    expect(await catatan()).toHaveLength(2);

    klik("Simpan");
    await lembarTertutup();
    await laciTampil("Rp 104.000");
    const daftar = await catatan();
    expect(daftar).toHaveLength(3);
    expect(stokBarang(daftar, kopi.id)).toBe(3);
    expect(await screen.findByText("Tersimpan: jual Rp 4.000")).toBeTruthy();
    expect(await screen.findByText("Kopi ×2")).toBeTruthy();
  });

  test("jual bon: laci tetap, bon pelanggan bertambah, rute berganti", async () => {
    buka();
    await laciTampil("Rp 100.000");
    await tampilkanLembar("Jual");
    fireEvent.click(await screen.findByRole("button", { name: "Tambah Kopi" }));
    klik("Bon");
    fireEvent.click(await screen.findByRole("button", { name: "Budi" }));
    expect(within(screen.getByRole("dialog")).getByText("Bon: Budi")).toBeTruthy();

    klik("Simpan");
    await lembarTertutup();
    const daftar = await catatan();
    expect(isiTempat(daftar, "laci")).toBe(100000);
    expect(isiTempat(daftar, "bon", budi.id)).toBe(2000);
    expect(await screen.findByText("Kopi · bon Budi")).toBeTruthy();
    await laciTampil("Rp 100.000");
  });

  test("jual bon tanpa pelanggan ditolak dengan pesan, lembar tetap terbuka", async () => {
    buka();
    await tampilkanLembar("Jual");
    fireEvent.click(await screen.findByRole("button", { name: "Tambah Kopi" }));
    klik("Bon");
    klik("Simpan");
    expect(await screen.findByText("Pilih pelanggan yang ngebon.")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(await catatan()).toHaveLength(2);
  });

  test("jual bon ke pelanggan baru", async () => {
    buka();
    await tampilkanLembar("Jual");
    fireEvent.click(await screen.findByRole("button", { name: "Tambah Kopi" }));
    klik("Bon");
    klik("+ Baru");
    fireEvent.change(await screen.findByRole("textbox", { name: "Nama pelanggan baru" }), { target: { value: "Sari" } });
    klik("Simpan");
    await lembarTertutup();
    const sari = (await semuaAda(db.pelanggan)).find((p) => p.nama === "Sari");
    expect(isiTempat(await catatan(), "bon", sari.id)).toBe(2000);
  });

  test("tombol tambah berhenti di batas stok", async () => {
    buka();
    await tampilkanLembar("Jual");
    const tambah = await screen.findByRole("button", { name: "Tambah Kopi" });
    await waitFor(() => expect(tambah.disabled).toBe(false));
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByRole("button", { name: "Tambah Kopi" }));
    expect(screen.getByRole("button", { name: "Tambah Kopi" }).disabled).toBe(true);
  });

  test("jualan Lainnya dengan modal", async () => {
    buka();
    await tampilkanLembar("Jual");
    fireEvent.click(await screen.findByRole("button", { name: "+ Lainnya" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nominal jualan lainnya" }), { target: { value: "5000" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Modal jualan lainnya" }), { target: { value: "3000" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Keterangan jualan lainnya" }), { target: { value: "Gorengan" } });
    klik("Simpan");
    await lembarTertutup();
    const c = (await catatan()).find((x) => x.keterangan === "Gorengan");
    expect(c.item[0]).toMatchObject({ barang_id: null, harga: 5000, modal: 3000 });
  });
});

describe("alur Belanja", () => {
  const isiStok = async (total) => {
    await tampilkanLembar("Belanja");
    await screen.findByRole("option", { name: "Kopi" });
    fireEvent.change(screen.getByRole("combobox", { name: "Barang" }), { target: { value: kopi.id } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Jumlah" }), { target: { value: "10" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Total" }), { target: { value: String(total) } });
  };

  test("belanja stok biasa", async () => {
    buka();
    await laciTampil("Rp 100.000");
    await isiStok(16000);
    expect(screen.getByText("Stok Kopi +10")).toBeTruthy();
    klik("Simpan");
    await lembarTertutup();
    await laciTampil("Rp 84.000");
    expect(stokBarang(await catatan(), kopi.id)).toBe(15);
  });

  test("melebihi laci: Simpan mati sampai setuju, lalu dua catatan dan laci nol", async () => {
    buka();
    await laciTampil("Rp 100.000");
    await isiStok(150000);
    expect(await screen.findByText("Laci cuma Rp 100.000")).toBeTruthy();
    expect(screen.getByText(/Sisanya Rp 50.000 pakai uang pribadi/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Simpan" }).disabled).toBe(true);

    klik("Ya, pakai");
    expect(screen.queryByText("Laci cuma Rp 100.000")).toBeNull();
    klik("Simpan");
    await lembarTertutup();
    await laciTampil("Rp 0");
    expect((await catatan()).filter((c) => c.dari === "pemilik" && c.ke === "laci" && c.nominal === 50000)).toHaveLength(1);
  });

  test("lembar tidak sempat menampilkan peringatan keliru selagi memuat", async () => {
    buka();
    await tampilkanLembar("Belanja");
    fireEvent.change(await screen.findByRole("textbox", { name: "Total" }), { target: { value: "20000" } });
    expect(screen.queryByText(/Laci cuma/)).toBeNull();
    expect(screen.getByRole("button", { name: "Simpan" }).disabled).toBe(false);
  });

  test("mengubah total membatalkan persetujuan", async () => {
    buka();
    await laciTampil("Rp 100.000");
    await isiStok(150000);
    await screen.findByText("Laci cuma Rp 100.000");
    klik("Ya, pakai");
    fireEvent.change(screen.getByRole("textbox", { name: "Total" }), { target: { value: "160000" } });
    expect(screen.getByRole("button", { name: "Simpan" }).disabled).toBe(true);
  });

  test("biaya dengan keterangan", async () => {
    buka();
    await laciTampil("Rp 100.000");
    await tampilkanLembar("Belanja");
    fireEvent.click(await screen.findByRole("button", { name: "Biaya" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Keterangan" }), { target: { value: "Bayar plastik" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Total" }), { target: { value: "20000" } });
    klik("Simpan");
    await lembarTertutup();
    expect(await screen.findByText("Bayar plastik")).toBeTruthy();
    await laciTampil("Rp 80.000");
  });

  test("pinjaman: laci → bon", async () => {
    buka();
    await laciTampil("Rp 100.000");
    await tampilkanLembar("Belanja");
    fireEvent.click(await screen.findByRole("button", { name: "Pinjaman" }));
    fireEvent.click(await screen.findByRole("button", { name: "Budi" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Total" }), { target: { value: "30000" } });
    klik("Simpan");
    await lembarTertutup();
    expect(isiTempat(await catatan(), "bon", budi.id)).toBe(30000);
    expect(await screen.findByText("Budi pinjam uang")).toBeTruthy();
  });
});

describe("catat dengan suara", () => {
  // Pengenal suara tiruan: tes yang menentukan apa yang "terdengar"
  let sesi;
  beforeEach(() => {
    globalThis.SpeechRecognition = class {
      start() {
        sesi = this;
      }
      stop() {
        this.onend();
      }
      abort() {
        this.dibatalkan = true;
      }
    };
  });
  afterEach(() => {
    delete globalThis.SpeechRecognition;
  });

  const ucapkan = async (teks) => {
    await tampilkanLembar("Catat dengan suara", "Mendengarkan…");
    act(() => sesi.onresult({ results: [[{ transcript: teks }]] }));
    fireEvent.click(screen.getByRole("button", { name: "Selesai" }));
  };

  test("tombol tidak ada kalau browser tidak mendukung", async () => {
    delete globalThis.SpeechRecognition;
    buka();
    await screen.findByRole("button", { name: "Jual" });
    expect(screen.queryByRole("button", { name: "Catat dengan suara" })).toBeNull();
  });

  test("bahasa Indonesia, dan teks tampil selagi berbicara", async () => {
    buka();
    await tampilkanLembar("Catat dengan suara", "Mendengarkan…");
    expect(sesi.lang).toBe("id-ID");
    expect(sesi.interimResults).toBe(true);
    act(() => sesi.onresult({ results: [[{ transcript: "jual dua" }]] }));
    expect(screen.getByText("“jual dua”")).toBeTruthy();
  });

  test("jual: lembar terisi, tidak ada yang tersimpan sebelum Simpan", async () => {
    buka();
    await laciTampil("Rp 100.000");
    await ucapkan("jual dua kopi");
    const lembar = await screen.findByRole("dialog", { name: "Jual" });
    expect(await within(lembar).findByText("Rp 4.000")).toBeTruthy();
    expect(screen.getByText("Periksa dulu, lalu Simpan")).toBeTruthy();
    expect(await catatan()).toHaveLength(2);
    fireEvent.click(within(lembar).getByRole("button", { name: "Simpan" }));
    await lembarTertutup();
    expect(await catatan()).toHaveLength(3);
  });

  test("jual bon ke pelanggan yang dikenal", async () => {
    buka();
    await screen.findByText("Belum ada catatan hari ini");
    await ucapkan("Budi ngebon kopi");
    const lembar = await screen.findByRole("dialog", { name: "Jual" });
    expect(await within(lembar).findByText("Bon: Budi")).toBeTruthy();
    expect(within(lembar).getByRole("button", { name: "Bon" }).getAttribute("aria-pressed")).toBe("true");
  });

  test("jumlah melebihi stok: dibatasi dan diberi tahu", async () => {
    buka();
    await screen.findByText("Belum ada catatan hari ini");
    await ucapkan("jual sembilan kopi");
    const lembar = await screen.findByRole("dialog", { name: "Jual" });
    expect(await within(lembar).findByText("Stok Kopi tinggal 5.")).toBeTruthy();
    expect(within(lembar).getByText("Rp 10.000")).toBeTruthy();
  });

  test("jualan tanpa barang masuk Lainnya", async () => {
    buka();
    await screen.findByText("Belum ada catatan hari ini");
    await ucapkan("uang masuk 10 ribu");
    const lembar = await screen.findByRole("dialog", { name: "Jual" });
    expect((await within(lembar).findByRole("textbox", { name: "Nominal jualan lainnya" })).value).toBe("Rp 10.000");
  });

  test("belanja, biaya, pinjaman membuka lembar Belanja terisi", async () => {
    buka();
    await screen.findByText("Belum ada catatan hari ini");
    await ucapkan("belanja kopi 5 10 ribu");
    let lembar = await screen.findByRole("dialog", { name: "Belanja" });
    await within(lembar).findByRole("combobox", { name: "Barang" });
    await waitFor(() => expect(within(lembar).getByRole("combobox", { name: "Barang" }).value).toBe(kopi.id));
    expect(within(lembar).getByRole("spinbutton", { name: "Jumlah" }).value).toBe("5");
    expect(within(lembar).getByRole("textbox", { name: "Total" }).value).toBe("Rp 10.000");
    fireEvent.keyDown(lembar, { key: "Escape" });
    await lembarTertutup();

    await ucapkan("bayar listrik 20 ribu");
    lembar = await screen.findByRole("dialog", { name: "Belanja" });
    expect((await within(lembar).findByRole("textbox", { name: "Keterangan" })).value).toBe("listrik");
    expect(within(lembar).getByRole("button", { name: "Biaya" }).getAttribute("aria-pressed")).toBe("true");
    expect(await catatan()).toHaveLength(2);
  });

  test("terima bon: pelanggan dan nominal terisi", async () => {
    await jual({ lainnya: 50000, bayar: "bon", pelangganId: budi.id });
    buka();
    await screen.findByText("Bon pelanggan");
    await ucapkan("Budi bayar 20 ribu");
    const lembar = await screen.findByRole("dialog", { name: "Terima bon" });
    expect((await within(lembar).findByRole("button", { name: /Budi/ })).getAttribute("aria-pressed")).toBe("true");
    expect(within(lembar).getByRole("textbox", { name: "Dibayar" }).value).toBe("Rp 20.000");
    expect(within(lembar).getByText("Sisa 30.000")).toBeTruthy();
  });

  test("tidak dimengerti: Belum paham, lalu Ketik manual atau Coba lagi", async () => {
    buka();
    await screen.findByText("Belum ada catatan hari ini");
    await ucapkan("eh yang biru tadi berapa ya");
    const gagal = await screen.findByRole("dialog", { name: "Belum paham" });
    expect(within(gagal).getByText("“eh yang biru tadi berapa ya”")).toBeTruthy();
    fireEvent.click(within(gagal).getByRole("button", { name: "Coba lagi" }));
    expect(await screen.findByRole("dialog", { name: "Mendengarkan…" })).toBeTruthy();
    act(() => sesi.onresult({ results: [[{ transcript: "halo" }]] }));
    fireEvent.click(screen.getByRole("button", { name: "Selesai" }));
    const kedua = await screen.findByRole("dialog", { name: "Belum paham" });
    fireEvent.click(within(kedua).getByRole("button", { name: "Ketik manual" }));
    expect(await screen.findByRole("dialog", { name: "Jual" })).toBeTruthy();
  });

  test("galat: pesan ramah untuk izin ditolak, tidak terdengar, dan tanpa internet", async () => {
    buka();
    await screen.findByRole("button", { name: "Catat dengan suara" });
    const kasus = [
      ["not-allowed", /Izin mikrofon ditolak/],
      ["service-not-allowed", /nyalakan Siri atau Dikte/],
      ["no-speech", /Suara belum terdengar/],
      ["network", /butuh internet/],
    ];
    for (const [kode, pesan] of kasus) {
      await tampilkanLembar("Catat dengan suara", "Mendengarkan…");
      act(() => sesi.onerror({ error: kode }));
      expect(await screen.findByText(pesan)).toBeTruthy();
      await lembarTertutup();
    }
  });

  test("menutup lembar membatalkan rekaman tanpa pesan galat", async () => {
    buka();
    await tampilkanLembar("Catat dengan suara", "Mendengarkan…");
    const lembar = screen.getByRole("dialog", { name: "Mendengarkan…" });
    const dipakai = sesi;
    fireEvent.keyDown(lembar, { key: "Escape" });
    await lembarTertutup();
    expect(dipakai.dibatalkan).toBe(true);
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("alur Terima bon, Laci, Hitung ulang", () => {
  test("terima bon: tombol Lunas mengisi seluruh bon", async () => {
    await jual({ lainnya: 28000, bayar: "bon", pelangganId: budi.id });
    buka();
    await laciTampil("Rp 100.000");
    const lembar = await tampilkanLembar("Terima bon");
    fireEvent.click(await within(lembar).findByRole("button", { name: /Budi/ }));
    klik("Lunas");
    expect(screen.getByRole("textbox", { name: "Dibayar" }).value).toBe("Rp 28.000");
    klik("Simpan");
    await lembarTertutup();
    await laciTampil("Rp 128.000");
    expect(isiTempat(await catatan(), "bon", budi.id)).toBe(0);
  });

  test("terima bon: sisa ikut berubah", async () => {
    await jual({ lainnya: 28000, bayar: "bon", pelangganId: budi.id });
    buka();
    const lembar = await tampilkanLembar("Terima bon");
    fireEvent.click(await within(lembar).findByRole("button", { name: /Budi/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Dibayar" }), { target: { value: "20000" } });
    expect(screen.getByText("Sisa 8.000")).toBeTruthy();
  });

  test("tidak ada bon: lembar memberi tahu", async () => {
    buka();
    await tampilkanLembar("Terima bon");
    expect(await screen.findByText("Tidak ada pelanggan yang punya bon.")).toBeTruthy();
  });

  test("ambil pribadi melebihi laci ditolak", async () => {
    buka();
    await laciTampil("Rp 100.000");
    await tampilkanLembar("Laci");
    klik("Ambil pribadi");
    fireEvent.change(screen.getByRole("textbox", { name: "Jumlah" }), { target: { value: "200000" } });
    klik("Simpan");
    expect(await screen.findByText("Laci cuma Rp 100.000.")).toBeTruthy();
  });

  test("hitung ulang lewat lembar Laci: selisih dicatat", async () => {
    buka();
    await laciTampil("Rp 100.000");
    await tampilkanLembar("Laci");
    klik("Isi laci tidak cocok? Hitung ulang");
    await screen.findByRole("dialog", { name: "Hitung ulang laci" });
    fireEvent.change(await screen.findByRole("textbox", { name: "Uang di laci sebenarnya" }), { target: { value: "94000" } });
    expect(await screen.findByText("−Rp 6.000")).toBeTruthy();
    klik("Cocokkan");
    await lembarTertutup();
    await laciTampil("Rp 94.000");
    expect((await catatan()).some((c) => c.dari === "laci" && c.ke === "selisih" && c.nominal === 6000)).toBe(true);
  });
});

describe("alur Rincian dan hapus", () => {
  test("rincian menampilkan rute dan akibat, hapus perlu ditekan dua kali", async () => {
    await jual({ pilihan: [{ barang_id: kopi.id, jumlah: 2 }] });
    buka();
    fireEvent.click(await screen.findByRole("button", { name: /Kopi ×2/ }));
    const lembar = await screen.findByRole("dialog", { name: "Kopi ×2" });
    expect(within(lembar).getByText("Pembeli")).toBeTruthy();
    expect(within(lembar).getByText("Stok Kopi").nextSibling.textContent).toBe("−2");
    expect(within(lembar).getByText("Untung").nextSibling.textContent).toBe("+1.000");

    const hapus = await within(lembar).findByRole("button", { name: "Hapus catatan" });
    await waitFor(() => expect(hapus.disabled).toBe(false));
    fireEvent.click(hapus);
    expect(await catatan()).toHaveLength(3);
    fireEvent.click(within(lembar).getByRole("button", { name: "Tekan lagi untuk menghapus" }));
    await lembarTertutup();
    expect(await catatan()).toHaveLength(2);
    await laciTampil("Rp 100.000");
  });

  test("hapus ditolak karena stok: ada alasan, tombol mati, ada tautan Koreksi stok", async () => {
    await belanja({ jenis: "stok", total: 20000, barangId: kopi.id, jumlah: 10 });
    await jual({ pilihan: [{ barang_id: kopi.id, jumlah: 15 }] });
    buka();
    fireEvent.click(await screen.findByRole("button", { name: /Belanja Kopi ×10/ }));
    const lembar = await screen.findByRole("dialog", { name: "Belanja Kopi ×10" });
    expect(await within(lembar).findByText(/Stok Kopi akan jadi minus/)).toBeTruthy();
    expect(within(lembar).getByRole("button", { name: "Hapus catatan" }).disabled).toBe(true);
    expect(within(lembar).getByRole("button", { name: "Pakai Koreksi stok" })).toBeTruthy();
    expect(await catatan()).toHaveLength(4);
  });

  test("hapus ditolak karena bon sudah dibayar", async () => {
    await jual({ lainnya: 10000, keterangan: "Rokok", bayar: "bon", pelangganId: budi.id });
    await terimaBon({ pelangganId: budi.id, nominal: 10000 });
    buka();
    fireEvent.click(await screen.findByRole("button", { name: /Rokok · bon Budi/ }));
    const lembar = await screen.findByRole("dialog", { name: "Rokok · bon Budi" });
    expect(await within(lembar).findByText(/Bon Budi akan jadi minus/)).toBeTruthy();
    expect(within(lembar).getByRole("button", { name: "Hapus catatan" }).disabled).toBe(true);
  });

  test("hapus ditolak karena laci: pesan keputusan, bisa ke Hitung ulang", async () => {
    await belanja({ jenis: "biaya", total: 150000, keterangan: "Sewa", pakaiPribadi: true });
    buka();
    const pribadi = (await catatan()).find((c) => c.keterangan === "Uang pribadi untuk belanja");
    fireEvent.click(await screen.findByRole("button", { name: /Uang pribadi untuk belanja/ }));
    const lembar = await screen.findByRole("dialog", { name: "Uang pribadi untuk belanja" });
    expect(await within(lembar).findByText(`Tidak bisa dihapus, isi laci akan jadi −Rp ${(pribadi.nominal).toLocaleString("id-ID")}. Pakai Hitung ulang kalau uangnya memang beda.`)).toBeTruthy();
    fireEvent.click(within(lembar).getByRole("button", { name: "Hitung ulang" }));
    expect(await screen.findByRole("dialog", { name: "Hitung ulang laci" })).toBeTruthy();
  });
});
