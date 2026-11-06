// buatIkon.mjs: membuat ikon PNG dari gambar ikon, memakai browser Playwright.
// Dijalankan sekali kalau ikonnya berubah: node scripts/buatIkon.mjs
import { chromium } from "@playwright/test";

// Sudut dibuat persegi penuh, karena HP membulatkannya sendiri
const GAMBAR = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#4f7d65"/><g transform="translate(112 112) scale(3.6)"><circle cx="40" cy="20" r="11" fill="#f2d27a"/><path d="M35 20h10M40 15v10" stroke="#7d5a12" stroke-width="3" stroke-linecap="round"/><path d="M8 38c10-5 21-5 32 2v30c-11-7-22-7-32-2V38Z" fill="#fff"/><path d="M72 38c-10-5-21-5-32 2v30c11-7 22-7 32-2V38Z" fill="#e4f0e8"/><path d="M16 48c6-2 11-2 16 1M16 56c6-2 11-2 16 1M48 49c5-3 10-3 16-1M48 57c5-3 10-3 16-1" stroke="#7fb898" stroke-width="3" stroke-linecap="round"/></g></svg>`;

const browser = await chromium.launch();
for (const [nama, ukuran] of [["icon-192", 192], ["icon-512", 512], ["apple-touch-icon", 180]]) {
  const page = await browser.newPage({ viewport: { width: ukuran, height: ukuran } });
  await page.setContent(`<!doctype html><style>*{margin:0}svg{display:block;width:${ukuran}px;height:${ukuran}px}</style>${GAMBAR}`);
  await page.screenshot({ path: `public/icons/${nama}.png` });
  await page.close();
  console.log(nama, ukuran);
}
await browser.close();
