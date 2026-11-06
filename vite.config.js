import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Alamat GitHub Pages: https://zeevolker.github.io/buku-warung/
const BASE = process.env.BASE_PATH || "/buku-warung/";

// GitHub Pages tidak tahu rute React (misalnya /buku-warung/laporan), jadi membuka alamat itu
// langsung akan menghasilkan 404.html. Isinya disamakan dengan index.html supaya aplikasi tetap terbuka.
const salin404 = {
  name: "salin-404",
  apply: "build",
  writeBundle: ({ dir }) => copyFile(resolve(dir, "index.html"), resolve(dir, "404.html")),
};

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    salin404,
    VitePWA({
      // Versi baru menunggu sampai pengguna menekan Muat ulang atau membuka aplikasi lagi (lihat VersiBaru.jsx)
      registerType: "prompt",
      injectRegister: false,
      manifest: {
        name: "Buku Warung",
        short_name: "Buku Warung",
        description: "Pembukuan warung: isi laci, stok, bon pelanggan, dan untung langsung kelihatan.",
        lang: "id",
        start_url: BASE,
        scope: BASE,
        display: "standalone",
        background_color: "#f6f5f1",
        theme_color: "#f6f5f1",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png}"],
        // Library Excel dan PDF besar, tapi harus tetap bisa dipakai saat offline
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: "CacheFirst",
            options: { cacheName: "font", expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  test: {
    testTimeout: 20000, // lebih panjang dari batas tunggu findBy di tests/persiapan.js
    environment: "jsdom",
    setupFiles: ["./tests/persiapan.js"],
    include: ["tests/**/*.test.{js,jsx}"],
    // Tes tidak boleh tersambung ke Supabase sungguhan, walau ada file .env.local
    env: { VITE_SUPABASE_URL: "", VITE_SUPABASE_PUBLISHABLE_KEY: "" },
  },
});
