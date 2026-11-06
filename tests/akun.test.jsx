import { afterEach, beforeAll, beforeEach, describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router";
import { LazyMotion, domMax, MotionGlobalConfig } from "motion/react";
import { db, ambilMeta, aturMeta, semuaAda } from "../src/data/db.js";
import { isiTempat } from "../src/data/hitung.js";
import { uangAwal, jual } from "../src/data/aksi.js";

// Supabase tiruan. Setiap tes mengatur jawabannya lewat klien.auth.
const klien = vi.hoisted(() => ({
  aktif: true,
  auth: {},
  from: () => ({}),
}));

vi.mock("../src/data/supabase.js", () => ({
  supabaseAktif: () => klien.aktif,
  ambilKlien: async () => (klien.aktif ? klien : null),
  remoteSupabase: () => ({ kirim: async () => {}, ambilSejak: async () => [] }),
}));

import Masuk from "../src/layar/Masuk/Masuk.jsx";
import Mulai from "../src/layar/Mulai/Mulai.jsx";
import Akun from "../src/layar/Akun/Akun.jsx";
import Beranda from "../src/layar/Beranda/Beranda.jsx";
import PitaStatus from "../src/layar/Beranda/PitaStatus.jsx";
import { keluarAkun, mulaiAkun, sinkronSekarang, ambilStatus, terjemahkanGalat, kosongkanSemua } from "../src/data/akun.js";

function Alamat() {
  return <span data-testid="alamat">{useLocation().pathname}</span>;
}

const buka = (elemen, alamat = "/") =>
  render(
    <MemoryRouter initialEntries={[alamat]}>
      <LazyMotion features={domMax} strict>
        <Alamat />
        <Routes>
          <Route path="*" element={elemen} />
        </Routes>
      </LazyMotion>
    </MemoryRouter>
  );

const klik = (nama) => fireEvent.click(screen.getByRole("button", { name: nama }));
const alamat = () => screen.getByTestId("alamat").textContent;
const ketik = (nama, nilai) => fireEvent.change(screen.getByLabelText(nama), { target: { value: nilai } });

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(async () => {
  await db.delete();
  await db.open();
  klien.aktif = true;
  klien.auth = {
    signInWithPassword: vi.fn(async () => ({ error: null })),
    signUp: vi.fn(async () => ({ data: { user: { identities: [{}] }, session: {} }, error: null })),
    signInWithOAuth: vi.fn(async () => ({ error: null })),
    resetPasswordForEmail: vi.fn(async () => ({ error: null })),
    updateUser: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    getSession: vi.fn(async () => ({ data: { session: null } })),
    onAuthStateChange: vi.fn(),
  };
});

afterEach(() => {
  delete navigator.standalone;
});

describe("terjemahan galat", () => {
  test("pesan berbahasa Indonesia", () => {
    expect(terjemahkanGalat({ message: "Invalid login credentials" })).toBe("Email atau kata sandi salah.");
    expect(terjemahkanGalat({ status: 429, message: "x" })).toContain("Terlalu sering");
    expect(terjemahkanGalat({ message: "Email not confirmed" })).toContain("belum dikonfirmasi");
    expect(terjemahkanGalat({ message: "Failed to fetch" })).toContain("internet");
  });
});

describe("Masuk dengan email", () => {
  test("isian salah ditolak sebelum dikirim", async () => {
    buka(<Masuk />, "/masuk");
    ketik("Email", "bukan-email");
    ketik("Kata sandi", "rahasia123");
    fireEvent.click(screen.getAllByRole("button", { name: "Masuk" }).at(-1));
    expect(await screen.findByText("Tulis alamat email yang benar.")).toBeTruthy();
    ketik("Email", "a@b.co");
    ketik("Kata sandi", "123");
    fireEvent.click(screen.getAllByRole("button", { name: "Masuk" }).at(-1));
    expect(await screen.findByText(/minimal 8/)).toBeTruthy();
    expect(klien.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  test("kata sandi salah: pesan jelas", async () => {
    klien.auth.signInWithPassword = vi.fn(async () => ({ error: { message: "Invalid login credentials" } }));
    buka(<Masuk />, "/masuk");
    ketik("Email", "a@b.co");
    ketik("Kata sandi", "rahasia123");
    fireEvent.click(screen.getAllByRole("button", { name: "Masuk" }).at(-1));
    expect(await screen.findByText("Email atau kata sandi salah.")).toBeTruthy();
  });

  test("daftar dengan email yang sudah terdaftar: diarahkan ke Lupa kata sandi", async () => {
    klien.auth.signUp = vi.fn(async () => ({ data: { user: { identities: [] }, session: null }, error: null }));
    buka(<Masuk />, "/masuk");
    klik("Daftar baru");
    ketik("Email", "a@b.co");
    ketik("Kata sandi", "rahasia123");
    klik("Daftar");
    expect(await screen.findByText(/sudah punya akun.*Lupa kata sandi/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Lupa kata sandi?" })).toBeTruthy();
  });

  test("daftar yang perlu konfirmasi email: diberi petunjuk", async () => {
    klien.auth.signUp = vi.fn(async () => ({ data: { user: { identities: [{}] }, session: null }, error: null }));
    buka(<Masuk />, "/masuk");
    klik("Daftar baru");
    ketik("Email", "a@b.co");
    ketik("Kata sandi", "rahasia123");
    klik("Daftar");
    expect(await screen.findByText(/Buka email di a@b.co/)).toBeTruthy();
  });

  test("lupa kata sandi: perlu email, lalu dikirim", async () => {
    buka(<Masuk />, "/masuk");
    klik("Lupa kata sandi?");
    expect(await screen.findByText(/Tulis email akunmu/)).toBeTruthy();
    expect(klien.auth.resetPasswordForEmail).not.toHaveBeenCalled();
    ketik("Email", "a@b.co");
    klik("Lupa kata sandi?");
    expect(await screen.findByText(/dikirim ke a@b.co/)).toBeTruthy();
    expect(klien.auth.resetPasswordForEmail.mock.calls[0][1].redirectTo.endsWith("/masuk")).toBe(true);
  });

  test("tombol lihat kata sandi", async () => {
    buka(<Masuk />, "/masuk");
    expect(screen.getByLabelText("Kata sandi").type).toBe("password");
    klik("Tampilkan kata sandi");
    expect(screen.getByLabelText("Kata sandi").type).toBe("text");
  });
});

describe("Pertama kali", () => {
  test("tamu: nama warung, uang awal, lalu Beranda dengan tutorial", async () => {
    buka(<Mulai />, "/mulai");
    expect(screen.getByText("untung langsung kelihatan.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Masuk dengan Google" })).toBeTruthy();
    klik("Coba dulu tanpa akun");
    expect(screen.getByRole("button", { name: "Lanjut" }).disabled).toBe(true);
    ketik("Nama warung", "Warung Sari");
    klik("Lanjut");
    await screen.findByText("Berapa uang di laci sekarang?");
    expect(screen.getByRole("button", { name: "Lanjut" }).disabled).toBe(true);
    ketik("Uang di laci", "500000");
    klik("Lanjut");
    await waitFor(() => expect(alamat()).toBe("/"));
    expect(await ambilMeta("nama_warung")).toBe("Warung Sari");
    expect(await ambilMeta("mulai_selesai")).toBe(1);
    expect(await ambilMeta("tutorial")).toBe(1);
    const semua = await semuaAda(db.catatan);
    expect(semua[0]).toMatchObject({ dari: "pemilik", ke: "laci", nominal: 500000 });
  });

  test("uang Rp 0: tidak membuat catatan", async () => {
    buka(<Mulai />, "/mulai");
    klik("Coba dulu tanpa akun");
    ketik("Nama warung", "Warung");
    klik("Lanjut");
    fireEvent.click(await screen.findByRole("button", { name: "Rp 0" }));
    klik("Lanjut");
    await waitFor(() => expect(alamat()).toBe("/"));
    expect(await db.catatan.count()).toBe(0);
  });

  test("iPhone mode layar utama: tombol Google disembunyikan", () => {
    Object.defineProperty(navigator, "standalone", { value: true, configurable: true });
    buka(<Mulai />, "/mulai");
    expect(screen.queryByRole("button", { name: "Masuk dengan Google" })).toBeNull();
    expect(screen.getByRole("button", { name: "Masuk dengan email" })).toBeTruthy();
  });

  test("tanpa Supabase: hanya tombol Mulai", () => {
    klien.aktif = false;
    buka(<Mulai />, "/mulai");
    expect(screen.queryByRole("button", { name: "Masuk dengan email" })).toBeNull();
    expect(screen.getByRole("button", { name: "Mulai" })).toBeTruthy();
  });
});

describe("Panduan 3 tombol", () => {
  test("Jual → Belanja → Terima bon, muncul sekali", async () => {
    await aturMeta("tutorial", 1);
    buka(<Beranda />);
    const panduan = await screen.findByRole("dialog", { name: "Panduan" });
    expect(within(panduan).getByText("Ada barang laku? Tekan Jual.")).toBeTruthy();
    fireEvent.click(within(panduan).getByRole("button", { name: "Lanjut" }));
    expect(within(panduan).getByText("Uang keluar? Tekan Belanja.")).toBeTruthy();
    expect(within(panduan).getByText("2 dari 3")).toBeTruthy();
    fireEvent.click(within(panduan).getByRole("button", { name: "Lanjut" }));
    expect(within(panduan).getByText("Pelanggan bayar? Tekan Terima bon.")).toBeTruthy();
    fireEvent.click(within(panduan).getByRole("button", { name: "Selesai" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Panduan" })).toBeNull());
    expect(await ambilMeta("tutorial")).toBe(0);
  });

  test("Lewati menutup panduan, tombol disorot punya penanda", async () => {
    await aturMeta("tutorial", 1);
    const { container } = buka(<Beranda />);
    const panduan = await screen.findByRole("dialog", { name: "Panduan" });
    expect(container.querySelector('[data-panduan="jual"]').textContent).toContain("Jual");
    expect(container.querySelector('[data-panduan="belanja"]').textContent).toContain("Belanja");
    expect(container.querySelector('[data-panduan="bon"]').textContent).toContain("Terima bon");
    fireEvent.click(within(panduan).getByRole("button", { name: "Lewati" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Panduan" })).toBeNull());
  });
});

describe("Mode tamu: ajakan simpan ke cloud", () => {
  const banyakCatatan = async (n) => {
    for (let i = 0; i < n; i++) await uangAwal(1000);
  };

  test("muncul setelah 10 catatan, Nanti saja menunda 20 catatan", async () => {
    await banyakCatatan(10);
    buka(<Beranda />);
    const lembar = await screen.findByRole("dialog", { name: "Sudah 10 catatan" });
    fireEvent.click(within(lembar).getByRole("button", { name: "Nanti saja" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(await ambilMeta("ajakan_berikut")).toBe(30);
  });

  test("belum 10 catatan atau tanpa Supabase: tidak muncul", async () => {
    await banyakCatatan(9);
    buka(<Beranda />);
    await screen.findByRole("button", { name: "Jual" });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Cocokkan isi laci setelah pindah dari v3", () => {
  test("tampil sekali, mencatat selisih, lalu tidak muncul lagi", async () => {
    await uangAwal(1000);
    await aturMeta("ajakan_berikut", 999);
    await aturMeta("cocokkan_laci", 1);
    buka(<Beranda />);
    const lembar = await screen.findByRole("dialog", { name: "Cocokkan isi laci" });
    fireEvent.change(await within(lembar).findByLabelText("Uang di laci sebenarnya"), { target: { value: "5000" } });
    fireEvent.click(within(lembar).getByRole("button", { name: "Cocokkan" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(isiTempat(await semuaAda(db.catatan), "laci")).toBe(5000);
    expect(await ambilMeta("cocokkan_laci")).toBe(0);
  });
});

describe("Status simpan", () => {
  test("offline dengan catatan belum terkirim", () => {
    render(<PitaStatus akun={{ email: "a@b.co", keadaan: "offline", belum: 3 }} />);
    expect(screen.getByText("3 catatan tersimpan di HP. Terkirim saat ada sinyal.")).toBeTruthy();
  });

  test("gagal punya tombol Coba lagi", () => {
    render(<PitaStatus akun={{ email: "a@b.co", keadaan: "gagal", belum: 1 }} />);
    expect(screen.getByText(/Gagal kirim ke cloud/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Coba lagi" })).toBeTruthy();
  });

  test("tersimpan atau tamu: tidak ada pita", () => {
    const { container } = render(
      <>
        <PitaStatus akun={{ email: "a@b.co", keadaan: "sinkron", belum: 0 }} />
        <PitaStatus akun={{ email: null, keadaan: "tamu", belum: 5 }} />
      </>
    );
    expect(container.textContent).toBe("");
  });
});

describe("Akun", () => {
  test("tamu: tombol masuk, tanpa tombol keluar", async () => {
    buka(<Akun />, "/akun");
    expect(await screen.findByText("Data hanya tersimpan di HP ini")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Masuk dengan email" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Keluar dari akun" })).toBeNull();
  });

  test("Lihat tutorial lagi", async () => {
    buka(<Akun />, "/akun");
    klik("Lihat tutorial lagi");
    await waitFor(() => expect(alamat()).toBe("/"));
    expect(await ambilMeta("tutorial")).toBe(1);
  });

  test("ubah nama warung", async () => {
    buka(<Akun />, "/akun");
    fireEvent.click(screen.getByRole("button", { name: /Nama warung/ }));
    const lembar = await screen.findByRole("dialog", { name: "Nama warung" });
    fireEvent.change(within(lembar).getByLabelText("Nama warung"), { target: { value: "Warung Baru" } });
    fireEvent.click(within(lembar).getByRole("button", { name: "Simpan" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(await ambilMeta("nama_warung")).toBe("Warung Baru");
  });

  test("file bukan cadangan ditolak; file benar minta persetujuan", async () => {
    await uangAwal(1000);
    buka(<Akun />, "/akun");
    const kolom = screen.getByLabelText("File cadangan");
    const berkas = (isi) => new File([isi], "x.json", { type: "application/json" });
    fireEvent.change(kolom, { target: { files: [berkas("bukan json")] } });
    expect(await screen.findByText("File ini bukan cadangan Buku Warung.")).toBeTruthy();

    const isi = JSON.stringify({ aplikasi: "buku-warung", versi: 4, dibuat: 1, data: { barang: [], pelanggan: [], catatan: [] } });
    fireEvent.change(kolom, { target: { files: [berkas(isi)] } });
    const lembar = await screen.findByRole("dialog", { name: "Pulihkan dari file?" });
    expect(lembar.textContent).toContain("0 catatan");
    expect(await db.catatan.count()).toBe(1);
    fireEvent.click(within(lembar).getByRole("button", { name: "Ya, ganti data" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(isiTempat(await semuaAda(db.catatan), "laci")).toBe(0);
  });
});

describe("Akun: alur sesi", () => {
  const SESI = { user: { id: "u1", email: "a@b.co", user_metadata: { nama_warung: "Warung Akun" } } };

  test("masuk: data tamu jadi milik akun, keluar ditolak kalau ada yang belum terkirim", async () => {
    await uangAwal(1000);
    klien.auth.getSession = vi.fn(async () => ({ data: { session: SESI } }));
    await mulaiAkun();
    expect(ambilStatus().email).toBe("a@b.co");
    expect(await ambilMeta("pemilik")).toBe("u1");
    expect(await ambilMeta("nama_warung")).toBe("Warung Akun");

    // Server tiruan menerima semua, jadi sekarang sudah terkirim
    await db.catatan.toCollection().modify({ dirty: 1 });
    await sinkronSekarang();
    expect(await db.catatan.where("dirty").equals(1).count()).toBe(0);

    await uangAwal(2000);
    // Terkirim lewat keluarAkun, lalu data di HP dikosongkan
    expect(await keluarAkun()).toEqual({});
    expect(klien.auth.signOut).toHaveBeenCalled();
    expect(await db.catatan.count()).toBe(0);
    expect(ambilStatus().email).toBeNull();
  });

  test("kosongkanSemua menghapus data dan meta", async () => {
    await jual({ lainnya: 1000 });
    await aturMeta("nama_warung", "X");
    await kosongkanSemua();
    expect(await db.catatan.count()).toBe(0);
    expect(await ambilMeta("nama_warung")).toBeNull();
  });
});
