import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// GitHub Pages tidak tahu rute React (misalnya /buku-warung/laporan), jadi membuka alamat itu
// langsung akan menghasilkan 404.html. Isinya disamakan dengan index.html supaya aplikasi tetap terbuka.
const salin404 = {
  name: "salin-404",
  apply: "build",
  closeBundle: () => copyFile(resolve("dist/index.html"), resolve("dist/404.html")),
};

export default defineConfig({
  // Alamat GitHub Pages: https://zeevolker.github.io/buku-warung/
  base: process.env.BASE_PATH || "/buku-warung/",
  plugins: [react(), salin404],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/persiapan.js"],
    include: ["tests/**/*.test.{js,jsx}"],
  },
});
