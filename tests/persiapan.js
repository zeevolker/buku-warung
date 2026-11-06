// persiapan.js: dijalankan sebelum setiap file tes.
import "fake-indexeddb/auto"; // IndexedDB tiruan, karena jsdom tidak punya
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(cleanup);
