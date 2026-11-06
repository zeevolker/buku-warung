// Tes terpisah karena mulaiAkun hanya berjalan sekali per file.
import { test, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { LazyMotion, domMax, MotionGlobalConfig } from "motion/react";
import { db, aturMeta } from "../src/data/db.js";

const klien = vi.hoisted(() => ({ auth: {} }));

vi.mock("../src/data/supabase.js", () => ({
  supabaseAktif: () => true,
  ambilKlien: async () => klien,
  remoteSupabase: () => ({ kirim: async () => {}, ambilSejak: async () => [] }),
}));

import App from "../src/App.jsx";

const SESI = { user: { id: "u1", email: "a@b.co", user_metadata: {} } };

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
  window.scrollTo = vi.fn();
  localStorage.setItem("bw4_migrasi_lokal", "1");
});

test("tautan lupa kata sandi membuka layar kata sandi baru, bukan langsung masuk", async () => {
  await aturMeta("mulai_selesai", 1);

  // Meniru library Supabase: saat dibuka dari tautan, sesi sudah ada begitu getSession selesai,
  // dan PASSWORD_RECOVERY dikirim sekali, sesaat setelah itu, hanya kepada yang sudah mendengarkan.
  const pendengar = [];
  klien.auth = {
    onAuthStateChange: vi.fn((f) => pendengar.push(f)),
    getSession: vi.fn(async () => {
      setTimeout(() => [...pendengar].forEach((f) => f("PASSWORD_RECOVERY", SESI)), 0);
      return { data: { session: SESI } };
    }),
    updateUser: vi.fn(async () => ({ error: null })),
  };

  render(
    <MemoryRouter initialEntries={["/masuk"]}>
      <LazyMotion features={domMax} strict>
        <App />
      </LazyMotion>
    </MemoryRouter>
  );

  expect(await screen.findByRole("heading", { name: "Buat kata sandi baru" }, { timeout: 4000 })).toBeTruthy();

  fireEvent.change(screen.getByLabelText("Kata sandi baru"), { target: { value: "pendek" } });
  fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
  expect(await screen.findByText(/minimal 8/)).toBeTruthy();
  expect(klien.auth.updateUser).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText("Kata sandi baru"), { target: { value: "sandibaru123" } });
  fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
  await waitFor(() => expect(klien.auth.updateUser).toHaveBeenCalledWith({ password: "sandibaru123" }));
  expect(await screen.findByRole("heading", { name: "Buku Warung" }, { timeout: 4000 })).toBeTruthy();
  expect(await db.meta.get("mulai_selesai")).toBeTruthy();
}, 15000);
