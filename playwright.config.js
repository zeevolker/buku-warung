// Tes alur layar dengan browser sungguhan, mode HP. Jalankan: npm run test:e2e
import { defineConfig, devices } from "@playwright/test";

const PORT = 5198;

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Pixel 7"],
    baseURL: `http://localhost:${PORT}/buku-warung/`,
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
    serviceWorkers: "block",
    acceptDownloads: true,
    trace: "off",
  },
  webServer: {
    command: `npx vite build --outDir dist-e2e --emptyOutDir --mode e2e && npx vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/buku-warung/`,
    reuseExistingServer: false,
    timeout: 120_000,
    // Tanpa Supabase: mode tamu, supaya tes tidak pernah menyentuh database sungguhan
    env: { VITE_SUPABASE_URL: "", VITE_SUPABASE_PUBLISHABLE_KEY: "" },
  },
});
