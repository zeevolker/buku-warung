import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const akar = (file) => fileURLToPath(new URL(file, import.meta.url));
const halaman = ["index", "riwayat", "ringkasan", "stok", "kasbon", "akun", "privasi"];

export default defineConfig({
  // Alamat GitHub Pages: https://zeevolker.github.io/buku-warung/
  base: process.env.BASE_PATH || "/buku-warung/",
  build: {
    target: "es2022", // dukung top-level await di halaman
    // Daftar file hasil build, dibaca service worker untuk mode offline
    manifest: "asset-manifest.json",
    rollupOptions: {
      input: Object.fromEntries(halaman.map((h) => [h, akar(`./${h}.html`)])),
    },
  },
});
