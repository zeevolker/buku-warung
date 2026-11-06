import { test, expect, vi, beforeAll } from "vitest";
import { useState, Suspense } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { LazyMotion, domMax, MotionGlobalConfig } from "motion/react";
import App from "../src/App.jsx";
import Lembar from "../src/komponen/Lembar.jsx";
import ChipTempat from "../src/komponen/ChipTempat.jsx";
import Rute from "../src/komponen/Rute.jsx";

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
  window.scrollTo = vi.fn(() => Promise.resolve()); // Chrome baru mengembalikan Promise, bukan undefined
});

const dalamGerak = (isi) => <LazyMotion features={domMax} strict>{isi}</LazyMotion>;

test("ChipTempat: nama dan warna per tempat", () => {
  render(<><ChipTempat tempat="laci" /><ChipTempat tempat="bon" namaPelanggan="Budi" /><ChipTempat tempat="agen" /></>);
  expect(screen.getByText("Laci").className).toContain("laci");
  expect(screen.getByText("Bon: Budi").className).toContain("bon");
  expect(screen.getByText("Agen").className).toContain("luar");
});

test("Rute: dari, ke, dan nominal", () => {
  render(<Rute dari="pembeli" ke="bon" namaPelanggan="Sari" nominal={28000} />);
  expect(screen.getByText("Pembeli")).toBeTruthy();
  expect(screen.getByText("Bon: Sari")).toBeTruthy();
  expect(screen.getByText("Rp 28.000")).toBeTruthy();
});

function ContohLembar() {
  const [buka, setBuka] = useState(false);
  return dalamGerak(
    <>
      <button onClick={() => setBuka(true)}>Buka</button>
      <Lembar terbuka={buka} onTutup={() => setBuka(false)} judul="Jual"><button>Simpan</button></Lembar>
    </>
  );
}

test("Lembar: terbuka, tertutup dengan Esc, fokus kembali ke tombol asal", async () => {
  render(<ContohLembar />);
  expect(screen.queryByRole("dialog")).toBeNull();
  const tombol = screen.getByText("Buka");
  tombol.focus();
  fireEvent.click(tombol);
  const dialog = screen.getByRole("dialog", { name: "Jual" });
  expect(document.activeElement).toBe(dialog);
  expect(document.body.style.overflow).toBe("hidden");
  fireEvent.keyDown(dialog, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(document.activeElement).toBe(tombol);
  expect(document.body.style.overflow).toBe("");
});

test("Lembar: dua lembar bertukar tidak mengunci gulir halaman", async () => {
  function DuaLembar() {
    const [buka, setBuka] = useState("a");
    return dalamGerak(
      <>
        <button onClick={() => setBuka("b")}>Ke B</button>
        <button onClick={() => setBuka(null)}>Tutup</button>
        <Lembar terbuka={buka === "a"} onTutup={() => {}} judul="A" />
        <Lembar terbuka={buka === "b"} onTutup={() => {}} judul="B" />
      </>
    );
  }
  render(<DuaLembar />);
  expect(document.body.style.overflow).toBe("hidden");
  fireEvent.click(screen.getByText("Ke B"));
  await screen.findByRole("dialog", { name: "B" });
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "A" })).toBeNull());
  expect(document.body.style.overflow).toBe("hidden");
  fireEvent.click(screen.getByText("Tutup"));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.body.style.overflow).toBe(""));
});

const bukaDi = (alamat) => render(<MemoryRouter initialEntries={[alamat]}>{dalamGerak(<App />)}</MemoryRouter>);

test("rute: setiap layar terbuka lewat lazy, menu bawah sesuai", async () => {
  const daftar = [["/", "Buku Warung", true], ["/laporan", "Laporan", true], ["/barang", "Barang", true], ["/pelanggan", "Pelanggan", true], ["/pelanggan/x", "Pelanggan", true], ["/riwayat", "Semua riwayat", true], ["/catatan", "Catatan", true], ["/akun", "Akun", true], ["/masuk", "Masuk", false], ["/mulai", "Selamat datang", false], ["/privasi", "Kebijakan Privasi", false]];
  for (const [alamat, judul, adaMenu] of daftar) {
    const { unmount } = bukaDi(alamat);
    await screen.findByRole("heading", { name: judul }, { timeout: 3000 });
    expect(Boolean(screen.queryByRole("navigation")), alamat).toBe(adaMenu);
    unmount();
  }
});

test("menu bawah: pindah layar dan menandai tab aktif", async () => {
  bukaDi("/");
  await screen.findByRole("heading", { name: "Buku Warung" }, { timeout: 3000 });
  const tab = screen.getByRole("link", { name: "Laporan" });
  expect(tab.getAttribute("aria-current")).toBeNull();
  fireEvent.click(tab);
  await screen.findByRole("heading", { name: "Laporan" }, { timeout: 3000 });
  expect(screen.getByRole("link", { name: "Laporan" }).getAttribute("aria-current")).toBe("page");
});
