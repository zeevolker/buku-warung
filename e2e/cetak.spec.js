// Halaman cetak di browser sungguhan: isi tidak boleh melewati batas halaman, dan jumlah halaman PDF harus pas.
import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

// Data banyak, dengan nama panjang, supaya kasus terburuk ikut teruji
function dataUji(jumlahPelanggan) {
  const sekarang = new Date();
  const hari = (mundur, jam, menit) => {
    const d = new Date(sekarang);
    d.setDate(d.getDate() - mundur);
    d.setHours(jam, menit, 0, 0);
    return d.getTime();
  };
  const dasar = { deleted: false, dirty: 0, created_at: 1, updated_at: 1 };
  const barang = Array.from({ length: 14 }, (_, i) => ({ ...dasar, id: `b${i}`, nama: i === 0 ? "Minyak goreng kemasan isi dua liter merek paling panjang sekali" : `Barang ${i}`, harga_jual: 5000, harga_beli: 3000, batas_hampir_habis: 1000 }));
  const pelanggan = Array.from({ length: jumlahPelanggan }, (_, i) => ({ ...dasar, id: `p${i}`, nama: i === 0 ? "Ibu Siti Nurhaliza binti Haji Abdul Rahman Sulaiman" : `Pelanggan ${i}`, no_wa: "" }));
  const catatan = [{ ...dasar, id: "awal", waktu: hari(60, 7, 0), dari: "pemilik", ke: "laci", nominal: 987654321, item: [], pelanggan_id: null, keterangan: "Uang awal" }];
  for (let i = 0; i < 70; i++) {
    const b = barang[i % barang.length];
    catatan.push({ ...dasar, id: `h${i}`, waktu: hari(0, 0, i), dari: "pembeli", ke: "laci", nominal: 5000 * (i + 1), pelanggan_id: null, item: [{ barang_id: b.id, nama: b.nama, jumlah: i + 1, harga: 5000, modal: 3000 }], keterangan: "" });
  }
  pelanggan.forEach((p, i) => catatan.push({ ...dasar, id: `bon${i}`, waktu: hari(0, 1, i), dari: "pembeli", ke: "bon", nominal: 1000 + i, pelanggan_id: p.id, item: [], keterangan: "" }));
  return { barang, pelanggan, catatan };
}

async function isiData(page, jumlahPelanggan = 24) {
  await page.addInitScript(() => {
    window.print = () => {
      window.jumlahCetak = (window.jumlahCetak || 0) + 1;
    };
  });
  await page.goto("./");
  await page.getByRole("button", { name: "Mulai", exact: true }).waitFor();
  await page.evaluate(async (data) => {
    const db = await new Promise((selesai, gagal) => {
      const buka = indexedDB.open("buku-warung-v4");
      buka.onsuccess = () => selesai(buka.result);
      buka.onerror = () => gagal(buka.error);
    });
    const tulis = db.transaction(["barang", "pelanggan", "catatan", "meta"], "readwrite");
    for (const t of ["barang", "pelanggan", "catatan"]) for (const b of data[t]) tulis.objectStore(t).put(b);
    tulis.objectStore("meta").put({ kunci: "nama_warung", nilai: "Warung Uji" });
    tulis.objectStore("meta").put({ kunci: "mulai_selesai", nilai: 1 });
    await new Promise((selesai) => (tulis.oncomplete = selesai));
    db.close();
  }, dataUji(jumlahPelanggan));
}

const tanggalIni = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Pelanggan banyak membuat tabel bon lanjut ke halaman lain; pelanggan sedikit memakai susunan dua kolom
const KASUS = [
  ["hari", 24],
  ["minggu", 24],
  ["bulan", 24],
  ["minggu", 3],
  ["bulan", 3],
];

for (const [periode, jumlahPelanggan] of KASUS) {
  test(`laporan ${periode}, ${jumlahPelanggan} pelanggan: tidak ada isi yang melewati batas halaman`, async ({ page }, info) => {
    await isiData(page, jumlahPelanggan);
    await page.goto(`./cetak/${periode}/${tanggalIni()}`);
    await page.waitForFunction(() => window.jumlahCetak === 1);
    await page.emulateMedia({ media: "print" });

    // Isi laporan harus benar-benar terlihat saat dicetak, sedangkan tombol tidak
    const terlihat = (pilih) => page.locator(pilih).first().evaluate((el) => getComputedStyle(el).visibility !== "hidden" && getComputedStyle(el).display !== "none");
    for (const pilih of ['section[aria-label^="Halaman "]', "header", "h2", "td", "footer"]) expect(await terlihat(pilih), pilih).toBe(true);
    expect(await terlihat("button")).toBe(false);

    const hasil = await page.evaluate(() =>
      [...document.querySelectorAll('section[aria-label^="Halaman "]')].map((h) => {
        const kaki = h.querySelector("footer").getBoundingClientRect();
        const isi = h.querySelector("footer").previousElementSibling;
        const bloks = [...isi.children];
        const bawah = bloks.length ? Math.max(...bloks.map((b) => b.getBoundingClientRect().bottom)) : 0;
        return { lebih: Math.round(bawah - kaki.top), kaki: h.querySelector("footer").textContent, teksKecil: [...h.querySelectorAll("*")].filter((x) => x.children.length === 0 && x.textContent.trim() && parseFloat(getComputedStyle(x).fontSize) < 12).length };
      })
    );
    expect(hasil.length).toBeGreaterThan(1);
    // Data yang wajar muat di dua halaman seperti rancangannya
    if (periode !== "hari" && jumlahPelanggan === 3) expect(hasil).toHaveLength(2);
    for (const h of hasil) {
      expect(h.lebih, h.kaki).toBeLessThanOrEqual(0);
      expect(h.teksKecil, h.kaki).toBe(0);
    }

    // Jumlah halaman PDF sama dengan jumlah halaman laporan: tidak ada halaman kosong
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    const jalur = info.outputPath(`laporan-${periode}.pdf`);
    writeFileSync(jalur, pdf);
    const jumlahPdf = (readFileSync(jalur, "latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
    expect(jumlahPdf).toBe(hasil.length);
    // PDF tanpa teks tidak memuat font sama sekali
    expect(readFileSync(jalur, "latin1")).toContain("/FontName");

    // Gambar tiap halaman ikut disimpan di test-results, untuk diperiksa dengan mata
    await page.setViewportSize({ width: 830, height: 1400 });
    const halaman = page.locator('section[aria-label^="Halaman "]');
    for (let i = 0; i < hasil.length; i++) {
      await halaman.nth(i).evaluate((h) => h.scrollIntoView());
      await page.screenshot({ path: info.outputPath(`${periode}-${i + 1}.png`) });
    }
  });
}

test("tombol PDF di lembar Unduh membuka halaman cetak, lalu Kembali ke periode yang sama", async ({ page }) => {
  await isiData(page);
  await page.goto("./laporan");
  await page.getByRole("button", { name: "Minggu", exact: true }).click();
  await page.getByRole("button", { name: "Unduh", exact: true }).click();
  await page.getByRole("dialog", { name: "Unduh laporan" }).getByRole("button", { name: /PDF/ }).click();
  await expect(page).toHaveURL(/cetak\/minggu\//);
  await page.waitForFunction(() => window.jumlahCetak === 1);
  await expect(page).toHaveTitle(/^Buku Warung - Mingguan /);
  await expect(page.getByRole("link", { name: "Beranda" })).toHaveCount(0);
  // Di layar HP halaman A4 diperkecil, jadi tidak perlu digeser ke samping
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.getByRole("button", { name: "Kembali" }).click();
  await expect(page).toHaveURL(/laporan$/);
  await expect(page.getByRole("img", { name: /Untung per hari/ })).toBeVisible();
});
