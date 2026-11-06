// Alur utama dari awal sampai akhir, di browser sungguhan dengan ukuran HP.
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";

const tombol = (page, nama, exact = true) => page.getByRole("button", { name: nama, exact });

// Pengguna baru sampai Beranda, panduannya dilewati
async function mulai(page, uang = "500000") {
  await page.goto("./");
  await tombol(page, "Mulai").click();
  await page.getByLabel("Nama warung").fill("Warung Uji");
  await tombol(page, "Lanjut").click();
  await page.getByLabel("Uang di laci").fill(uang);
  await tombol(page, "Lanjut").click();
  await tombol(page, "Lewati").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

async function tambahBarang(page, { nama, jual, beli, stok }) {
  await page.getByRole("link", { name: "Barang", exact: true }).click();
  await tombol(page, "+ Tambah").click();
  const lembar = page.getByRole("dialog", { name: "Tambah barang" });
  await lembar.getByRole("textbox", { name: "Nama" }).fill(nama);
  await lembar.getByRole("textbox", { name: "Harga jual" }).fill(String(jual));
  await lembar.getByRole("textbox", { name: "Harga beli" }).fill(String(beli));
  await lembar.getByRole("spinbutton", { name: "Stok sekarang" }).fill(String(stok));
  await lembar.getByRole("button", { name: "Simpan" }).click();
  await expect(lembar).toHaveCount(0);
  await page.getByRole("link", { name: "Beranda", exact: true }).click();
  await expect(tombol(page, "Jual")).toBeVisible();
}

const laci = (page) => page.getByRole("region", { name: "Isi laci" });

async function jualKopi(page, { jumlah = 1, bon = null } = {}) {
  await tombol(page, "Jual").click();
  const lembar = page.getByRole("dialog", { name: "Jual" });
  for (let i = 0; i < jumlah; i++) await lembar.getByRole("button", { name: "Tambah Kopi" }).click();
  if (bon) {
    await lembar.getByRole("button", { name: "Bon", exact: true }).click();
    await lembar.getByRole("button", { name: "+ Baru" }).click();
    await lembar.getByLabel("Nama pelanggan baru").fill(bon);
  }
  await lembar.getByRole("button", { name: "Simpan" }).click();
  await expect(lembar).toHaveCount(0);
}

test("tutorial pertama kali muncul sekali, dan bisa dibuka lagi dari Akun", async ({ page }) => {
  await page.goto("./");
  await expect(page).toHaveURL(/\/mulai$/);
  await tombol(page, "Mulai").click();
  await page.getByLabel("Nama warung").fill("Warung Sari");
  await tombol(page, "Lanjut").click();
  await page.getByLabel("Uang di laci").fill("500000");
  await tombol(page, "Lanjut").click();

  const panduan = page.getByRole("dialog", { name: "Panduan" });
  await expect(panduan.getByText("Ada barang laku? Tekan Jual.")).toBeVisible();
  // Tombol yang disorot tetap terlihat di balik lapisan gelap
  await expect(page.locator('[data-panduan="jual"]')).toBeVisible();
  await panduan.getByRole("button", { name: "Lanjut" }).click();
  await expect(panduan.getByText("Uang keluar? Tekan Belanja.")).toBeVisible();
  await panduan.getByRole("button", { name: "Lanjut" }).click();
  await expect(panduan.getByText("Pelanggan bayar? Tekan Terima bon.")).toBeVisible();
  await panduan.getByRole("button", { name: "Selesai" }).click();
  await expect(panduan).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Warung Sari" })).toBeVisible();
  await expect(laci(page)).toContainText("Rp 500.000");

  await page.reload();
  await expect(tombol(page, "Jual")).toBeVisible();
  await expect(panduan).toHaveCount(0);

  await page.getByRole("link", { name: /^Akun/ }).click();
  await tombol(page, "Lihat tutorial lagi").click();
  await expect(panduan).toBeVisible();
});

test("jual tunai: laci naik, stok turun, catatan muncul", async ({ page }) => {
  await mulai(page);
  await tambahBarang(page, { nama: "Kopi", jual: 2000, beli: 1500, stok: 5 });
  await jualKopi(page, { jumlah: 2 });
  await expect(laci(page)).toContainText("Rp 504.000");
  await expect(tombol(page, /Kopi ×2/, false)).toBeVisible();
  await page.getByRole("link", { name: "Barang", exact: true }).click();
  await expect(page.getByLabel("Stok 3, hampir habis")).toBeVisible();
});

test("jual bon lalu terima bon", async ({ page }) => {
  await mulai(page);
  await tambahBarang(page, { nama: "Kopi", jual: 2000, beli: 1500, stok: 5 });
  await jualKopi(page, { jumlah: 2, bon: "Budi" });
  await expect(laci(page)).toContainText("Rp 500.000");
  await expect(page.getByRole("link", { name: /Bon pelanggan/ })).toContainText("Rp 4.000");

  await tombol(page, "Terima bon").click();
  const lembar = page.getByRole("dialog", { name: "Terima bon" });
  await lembar.getByRole("button", { name: /Budi/ }).click();
  await lembar.getByRole("button", { name: "Lunas" }).click();
  await expect(lembar.getByRole("textbox", { name: "Dibayar" })).toHaveValue("Rp 4.000");
  await lembar.getByRole("button", { name: "Simpan" }).click();
  await expect(lembar).toHaveCount(0);
  await expect(laci(page)).toContainText("Rp 504.000");
  await expect(page.getByRole("link", { name: /Bon pelanggan/ })).toHaveCount(0);
});

test("belanja melebihi laci memakai uang pribadi, laci jadi nol", async ({ page }) => {
  await mulai(page, "100000");
  await tambahBarang(page, { nama: "Kopi", jual: 2000, beli: 1500, stok: 5 });
  await tombol(page, "Belanja").click();
  const lembar = page.getByRole("dialog", { name: "Belanja" });
  await lembar.getByRole("combobox", { name: "Barang" }).selectOption({ label: "Kopi" });
  await lembar.getByRole("spinbutton", { name: "Jumlah" }).fill("100");
  await lembar.getByRole("textbox", { name: "Total" }).fill("150000");
  await expect(lembar.getByText("Rp 1.500 per unit")).toBeVisible();
  await expect(lembar.getByText("Laci cuma Rp 100.000")).toBeVisible();
  await expect(lembar.getByRole("button", { name: "Simpan" })).toBeDisabled();
  await lembar.getByRole("button", { name: "Ya, pakai" }).click();
  await lembar.getByRole("button", { name: "Simpan" }).click();
  await expect(lembar).toHaveCount(0);
  await expect(laci(page)).toContainText("Rp 0");
});

test("hapus ditolak karena stok sudah terjual, lalu hapus penjualannya berhasil", async ({ page }) => {
  await mulai(page);
  await tambahBarang(page, { nama: "Kopi", jual: 2000, beli: 1500, stok: 1 });
  await tombol(page, "Belanja").click();
  const belanja = page.getByRole("dialog", { name: "Belanja" });
  await belanja.getByRole("combobox", { name: "Barang" }).selectOption({ label: "Kopi" });
  await belanja.getByRole("spinbutton", { name: "Jumlah" }).fill("3");
  await belanja.getByRole("textbox", { name: "Total" }).fill("4500");
  await belanja.getByRole("button", { name: "Simpan" }).click();
  await expect(belanja).toHaveCount(0);
  await jualKopi(page, { jumlah: 4 });

  await tombol(page, /Belanja Kopi ×3/, false).click();
  let rincian = page.getByRole("dialog", { name: "Belanja Kopi ×3" });
  await expect(rincian.getByText("Tidak bisa dihapus")).toBeVisible();
  await expect(rincian.getByText(/Stok Kopi akan jadi minus/)).toBeVisible();
  await expect(rincian.getByRole("button", { name: "Hapus catatan" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(rincian).toHaveCount(0);

  await tombol(page, /Kopi ×4/, false).click();
  rincian = page.getByRole("dialog", { name: "Kopi ×4" });
  await rincian.getByRole("button", { name: "Hapus catatan" }).click();
  await rincian.getByRole("button", { name: "Tekan lagi untuk menghapus" }).click();
  await expect(rincian).toHaveCount(0);
  await expect(laci(page)).toContainText("Rp 495.500");
});

test("laporan menghitung dari catatan hari ini, dan unduh Excel berisi catatannya", async ({ page }) => {
  await mulai(page);
  await tambahBarang(page, { nama: "Kopi", jual: 2000, beli: 1500, stok: 5 });
  await jualKopi(page, { jumlah: 2 });
  await page.getByRole("link", { name: "Laporan", exact: true }).click();

  const untung = page.getByRole("region", { name: "Untung hari ini" });
  await expect(untung).toContainText("Rp 1.000");
  await expect(untung).toContainText("4.000");
  await expect(untung).toContainText("−3.000");

  await tombol(page, "Minggu").click();
  await expect(page.getByRole("img", { name: /Untung per hari/ })).toBeVisible();
  await tombol(page, "Bulan").click();
  await expect(page.getByRole("img", { name: /Untung per minggu/ })).toBeVisible();

  await tombol(page, "Hari").click();
  await tombol(page, "Unduh").click();
  const lembar = page.getByRole("dialog", { name: "Unduh laporan" });
  const [unduhan] = await Promise.all([page.waitForEvent("download"), lembar.getByRole("button", { name: /Excel/ }).click()]);
  expect(unduhan.suggestedFilename()).toMatch(/^buku-warung-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const buku = XLSX.read(await readFile(await unduhan.path()));
  const baris = XLSX.utils.sheet_to_json(buku.Sheets.Catatan, { header: 1 });
  // Judul + uang awal + stok awal + satu penjualan
  expect(baris).toHaveLength(4);
  expect(baris[3].slice(2, 5)).toEqual(["Kopi ×2", "Pembeli", "Laci"]);
});

test("catat dengan suara mengisi lembar Jual, dan tidak menyimpan sendiri", async ({ page }) => {
  // Pengenal suara tiruan, karena browser uji tidak punya mikrofon
  await page.addInitScript(() => {
    globalThis.SpeechRecognition = class {
      start() {
        globalThis.sesiSuara = this;
      }
      stop() {
        setTimeout(() => this.onend?.(), 10);
      }
      abort() {}
    };
    globalThis.ucapkan = (teks) => globalThis.sesiSuara.onresult({ results: [[{ transcript: teks }]] });
  });
  await mulai(page);
  await tambahBarang(page, { nama: "Kopi", jual: 2000, beli: 1500, stok: 5 });

  await tombol(page, "Catat dengan suara").click();
  const lembar = page.getByRole("dialog", { name: "Mendengarkan…" });
  await expect(lembar.getByText("Silakan bicara…")).toBeVisible();
  await page.evaluate(() => globalThis.ucapkan("jual dua kopi"));
  await expect(lembar.getByText("“jual dua kopi”")).toBeVisible();
  await lembar.getByRole("button", { name: "Selesai" }).click();

  const jual = page.getByRole("dialog", { name: "Jual" });
  await expect(jual.getByText("Rp 4.000")).toBeVisible();
  await expect(laci(page)).toContainText("Rp 500.000");
  await jual.getByRole("button", { name: "Simpan" }).click();
  await expect(jual).toHaveCount(0);
  await expect(laci(page)).toContainText("Rp 504.000");

  await tombol(page, "Catat dengan suara").click();
  await page.evaluate(() => globalThis.ucapkan("eh yang biru tadi berapa ya"));
  await page.getByRole("dialog", { name: "Mendengarkan…" }).getByRole("button", { name: "Selesai" }).click();
  const gagal = page.getByRole("dialog", { name: "Belum paham" });
  await expect(gagal.getByText("“eh yang biru tadi berapa ya”")).toBeVisible();
  await expect(gagal.getByRole("button", { name: "Ketik manual" })).toBeVisible();
  await expect(gagal.getByRole("button", { name: "Coba lagi" })).toBeVisible();
});

test("tombol mikrofon hilang saat offline atau browser tidak mendukung", async ({ page, context }) => {
  await page.addInitScript(() => {
    globalThis.SpeechRecognition = class {};
  });
  await mulai(page);
  await expect(tombol(page, "Catat dengan suara")).toBeVisible();
  await context.setOffline(true);
  await expect(tombol(page, "Catat dengan suara")).toHaveCount(0);
  await context.setOffline(false);
  await expect(tombol(page, "Catat dengan suara")).toBeVisible();
});

test.describe("aplikasi terpasang", () => {
  test.use({ serviceWorkers: "allow" });

  test("tetap terbuka dan bisa mencatat saat offline", async ({ page, context }) => {
    await mulai(page, "1000");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect(tombol(page, "Jual")).toBeVisible();
    await context.setOffline(true);
    await page.reload();
    await expect(tombol(page, "Jual")).toBeVisible();
    await tombol(page, "Laci").click();
    const lembar = page.getByRole("dialog", { name: "Laci" });
    await lembar.getByRole("textbox", { name: "Jumlah" }).fill("500");
    await lembar.getByRole("button", { name: "Simpan" }).click();
    await expect(lembar).toHaveCount(0);
    await expect(laci(page)).toContainText("Rp 1.500");
    // Layar lain yang belum pernah dibuka juga tersedia
    await page.getByRole("link", { name: "Laporan", exact: true }).click();
    await expect(tombol(page, "Unduh")).toBeVisible();
  });

  test("manifest dan ikon tersedia", async ({ page, request }) => {
    await page.goto("./");
    const alamat = await page.locator('link[rel="manifest"]').getAttribute("href");
    const manifest = await (await request.get(new URL(alamat, page.url()).href)).json();
    expect(manifest).toMatchObject({ name: "Buku Warung", display: "standalone", start_url: "/buku-warung/" });
    for (const nama of ["icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"]) {
      expect((await request.get(new URL(nama, page.url()).href)).status(), nama).toBe(200);
    }
  });
});
