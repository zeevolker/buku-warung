// Membuat ulang gambar di folder screenshots/ dengan data contoh. Hanya jalan kalau diminta:
// TANGKAP=1 npx playwright test tangkapan
import { test, expect } from "@playwright/test";

const tombol = (page, nama) => page.getByRole("button", { name: nama, exact: true });
const gambar = (page, nama) => page.screenshot({ path: `screenshots/${nama}.png` });

test.skip(!process.env.TANGKAP, "hanya untuk membuat gambar README");

test("tangkapan layar", async ({ page }) => {
  test.setTimeout(120000);
  await page.addInitScript(() => {
    window.SpeechRecognition = class {
      start() {}
      stop() {}
      abort() {}
    };
  });
  await page.goto("./");
  await tombol(page, "Mulai").click();
  await page.getByLabel("Nama warung").fill("Warung Bu Tini");
  await tombol(page, "Lanjut").click();
  await page.getByLabel("Uang di laci").fill("350000");
  await tombol(page, "Lanjut").click();
  await tombol(page, "Lewati").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("link", { name: "Barang", exact: true }).click();
  for (const [nama, jual, beli, stok] of [["Indomie Goreng", 3500, 2800, 40], ["Teh Botol", 5000, 3800, 24], ["Kopi Sachet", 2000, 1400, 60], ["Gula 1 kg", 18000, 16000, 3]]) {
    await tombol(page, "+ Tambah").click();
    const lembar = page.getByRole("dialog", { name: "Tambah barang" });
    await lembar.getByRole("textbox", { name: "Nama" }).fill(nama);
    await lembar.getByRole("textbox", { name: "Harga jual" }).fill(String(jual));
    await lembar.getByRole("textbox", { name: "Harga beli" }).fill(String(beli));
    await lembar.getByRole("spinbutton", { name: "Stok sekarang" }).fill(String(stok));
    await lembar.getByRole("button", { name: "Simpan" }).click();
    await expect(lembar).toHaveCount(0);
  }
  await page.getByRole("link", { name: "Beranda", exact: true }).click();

  const jual = async (daftar) => {
    await tombol(page, "Jual").click();
    const lembar = page.getByRole("dialog", { name: "Jual" });
    for (const [nama, n] of daftar) for (let i = 0; i < n; i++) await lembar.getByRole("button", { name: `Tambah ${nama}` }).click();
    return lembar;
  };

  let lembar = await jual([["Indomie Goreng", 3], ["Teh Botol", 2]]);
  await page.waitForTimeout(400);
  await gambar(page, "jual");
  await lembar.getByRole("button", { name: "Simpan" }).click();
  await expect(lembar).toHaveCount(0);

  lembar = await jual([["Kopi Sachet", 4]]);
  await lembar.getByRole("button", { name: "Simpan" }).click();
  await expect(lembar).toHaveCount(0);
  await page.waitForTimeout(3000);
  await gambar(page, "beranda");

  await page.getByRole("button", { name: "Catat dengan suara" }).click();
  await expect(page.getByRole("dialog", { name: "Mendengarkan…" })).toBeVisible();
  await page.waitForTimeout(400);
  await gambar(page, "suara");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("link", { name: "Laporan", exact: true }).click();
  await page.waitForTimeout(800);
  await gambar(page, "laporan");
  await page.getByRole("link", { name: "Barang", exact: true }).click();
  await page.waitForTimeout(800);
  await gambar(page, "barang");
});
