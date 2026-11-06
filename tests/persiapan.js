// persiapan.js: dijalankan sebelum setiap file tes.
import "fake-indexeddb/auto"; // IndexedDB tiruan, karena jsdom tidak punya
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Node versi baru punya localStorage sendiri yang tidak lengkap, jadi diganti dengan tiruan sederhana
const isiPenyimpanan = new Map();
globalThis.localStorage = {
  getItem: (k) => (isiPenyimpanan.has(k) ? isiPenyimpanan.get(k) : null),
  setItem: (k, v) => void isiPenyimpanan.set(k, String(v)),
  removeItem: (k) => void isiPenyimpanan.delete(k),
  clear: () => isiPenyimpanan.clear(),
};

afterEach(cleanup);
