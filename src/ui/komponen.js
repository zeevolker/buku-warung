// komponen.js: potongan tampilan yang dipakai di banyak halaman.

import { formatRupiah } from "../lib/format.js";

// ---------- Membuat elemen ----------
// el("button", { className: "tombol", onclick }, "Simpan")
export function el(tag, atribut = {}, ...anak) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(atribut)) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith("aria-") || k.startsWith("data-") || k === "role" || k === "for") e.setAttribute(k, v);
    else e[k] = v;
  }
  e.append(...anak.flat().filter((a) => a !== null && a !== undefined && a !== false));
  return e;
}

// Ikon garis sederhana (24x24)
const PATH_IKON = {
  tambah: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  kurang: '<path d="M5 12h14"/>',
  centang: '<path d="M20 6 9 17l-5-5"/>',
  jam: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  kotak: '<path d="M21 8 12 3 3 8v8l9 5 9-5Z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
  kanan: '<path d="m9 18 6-6-6-6"/>',
  kiri: '<path d="m15 18-6-6 6-6"/>',
  tutup: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  cari: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  awanOk: '<path d="M17.5 19H7a5 5 0 1 1 1-9.9A6 6 0 0 1 19.5 11 4 4 0 0 1 17.5 19Z"/><path d="m9.5 14 2 2 3.5-3.5"/>',
  awanMati: '<path d="m2 2 20 20"/><path d="M17.5 19H7a5 5 0 0 1-1.6-9.7"/><path d="M10 5.3A6 6 0 0 1 19.5 11a4 4 0 0 1 1.4 7.3"/>',
  putar: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>',
  hp: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
  orang: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  bagikan: '<path d="M4 12v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/>',
  pesan: '<path d="M21 11.5a8.4 8.4 0 0 1-12.6 7.3L3 20.5l1.8-5.2A8.4 8.4 0 1 1 21 11.5Z"/>',
};

export function ikon(nama) {
  const span = document.createElement("span");
  span.innerHTML = `<svg class="ikon" viewBox="0 0 24 24" aria-hidden="true">${PATH_IKON[nama] || ""}</svg>`;
  return span.firstChild;
}

// ---------- Kolom angka rupiah ----------
export function ambilAngka(input) {
  return Number(String(input.value).replace(/\D/g, "")) || 0;
}

// Saat mengetik, otomatis diberi titik ribuan: 15000 -> 15.000
export function pasangFormatRupiah(input) {
  input.addEventListener("input", () => {
    const n = ambilAngka(input);
    input.value = n ? n.toLocaleString("id-ID") : "";
  });
  return input;
}

export const ribuan = (n) => Number(n || 0).toLocaleString("id-ID");

// ---------- Lembar (dialog dari bawah) ----------
export function bukaLembar(dialog) {
  dialog.showModal();
  dialog.querySelector("[autofocus]")?.focus();
}

export function tutupLembar(dialog) {
  dialog.close();
}

// Klik di luar lembar atau tombol [data-tutup] menutupnya
export function pasangLembar(dialog) {
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog || e.target.closest("[data-tutup]")) dialog.close();
  });
  return dialog;
}

// ---------- Tombol hapus dua kali tekan ----------
// Tekan pertama: tulisan berubah jadi "Tekan lagi untuk menghapus". Tekan kedua: onYa().
export function pasangHapusDuaKali(tombol, onYa) {
  const asli = tombol.textContent;
  let siap = false;
  let timer;
  tombol.addEventListener("click", () => {
    if (!siap) {
      siap = true;
      tombol.textContent = "Tekan lagi untuk menghapus";
      timer = setTimeout(() => {
        siap = false;
        tombol.textContent = asli;
      }, 4000);
      return;
    }
    clearTimeout(timer);
    siap = false;
    tombol.textContent = asli;
    onYa();
  });
}

// ---------- Pesan sementara ----------
let timerKabar;
export function kabar(teks) {
  let k = document.getElementById("kabar");
  if (!k) {
    k = el("p", { id: "kabar", className: "kabar", role: "status" });
    document.body.append(k);
  }
  k.textContent = teks;
  clearTimeout(timerKabar);
  timerKabar = setTimeout(() => (k.textContent = ""), 3500);
}

// Jalankan aksi yang menyimpan data; kalau penyimpanan HP gagal, beri tahu pengguna
export async function aman(aksi) {
  try {
    return await aksi();
  } catch (e) {
    console.error(e);
    if (!document.getElementById("gagal-simpan")) {
      document.body.prepend(
        el("div", {
          id: "gagal-simpan",
          className: "gagal-simpan",
          role: "alert",
          textContent: "Data gagal disimpan. Penyimpanan HP mungkin penuh atau browser dalam mode penyamaran.",
        })
      );
    }
    return { galat: "Data gagal disimpan." };
  }
}

// Gambar ulang halaman saat data berubah dari HP lain (lewat sinkron),
// kecuali pengguna sedang mengisi form di lembar yang terbuka.
export function saatDataBerubah(gambarUlang) {
  globalThis.addEventListener("bw:data-berubah", (e) => {
    if (e.detail?.sumber !== "server") return;
    if (document.querySelector("dialog[open]")) return;
    gambarUlang();
  });
}

export async function bagikanTeks(teks) {
  if (navigator.share) {
    try {
      await navigator.share({ text: teks });
    } catch {
      // dibatalkan
    }
    return;
  }
  window.open("https://wa.me/?text=" + encodeURIComponent(teks), "_blank", "noopener");
}

export function inisial(nama) {
  const kata = String(nama || "?").trim().split(/\s+/);
  return ((kata[0]?.[0] || "") + (kata[1]?.[0] || "")).toUpperCase() || "?";
}

// ---------- Satu catatan di daftar ----------
const jam = (ms) => new Date(ms).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

// Judul, keterangan, dan tampilan angka sebuah catatan
export function uraikanCatatan(c, namaPelanggan = "") {
  const daftarBarang = (c.barang || []).map((b) => `${b.nama} × ${b.jumlah}`).join(", ");
  switch (c.jenis) {
    case "jual":
      return c.dibayar === "nanti"
        ? { judul: daftarBarang || c.keterangan || "Penjualan", ket: `Bayar nanti · ${namaPelanggan}`, angka: ribuan(c.nominal), gaya: "netral", ikon: "jam" }
        : { judul: daftarBarang || c.keterangan || "Penjualan lain", ket: "Tunai", angka: "+" + ribuan(c.nominal), gaya: "masuk", ikon: "tambah" };
    case "keluar":
      if (c.untuk === "belanja") {
        const b = c.barang[0] || {};
        return { judul: `Belanja stok · ${b.nama} ${b.jumlah}`, ket: `Stok +${b.jumlah}`, angka: "−" + ribuan(c.nominal), gaya: "keluar", ikon: "kurang" };
      }
      if (c.untuk === "pinjaman") return { judul: `Dipinjam · ${namaPelanggan}`, ket: "Masuk ke utang", angka: "−" + ribuan(c.nominal), gaya: "keluar", ikon: "kurang" };
      return { judul: c.keterangan || "Biaya warung", ket: "Biaya warung", angka: "−" + ribuan(c.nominal), gaya: "keluar", ikon: "kurang" };
    case "bayar":
      return { judul: `Terima bayar · ${namaPelanggan}`, ket: "Utang dibayar", angka: "+" + ribuan(c.nominal), gaya: "masuk", ikon: "centang" };
    case "stok": {
      const b = c.barang[0] || {};
      return { judul: `${c.keterangan || "Koreksi stok"} · ${b.nama}`, ket: "Tanpa uang", angka: (b.jumlah > 0 ? "+" : "") + b.jumlah, gaya: "netral", ikon: "kotak" };
    }
    default:
      return { judul: "Catatan", ket: "", angka: "", gaya: "netral", ikon: "kotak" };
  }
}

export function itemCatatan(c, namaPelanggan, onKlik, tampilTanggal = false) {
  const u = uraikanCatatan(c, namaPelanggan);
  const waktu = tampilTanggal
    ? new Date(c.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) + ", " + jam(c.created_at)
    : jam(c.created_at);
  return el(
    "li",
    {},
    el(
      "button",
      { type: "button", className: "catatan-item", onclick: () => onKlik(c), "aria-label": `${u.judul}, ${u.angka}. Buka rincian` },
      el("span", { className: "ikon-bulat " + (u.gaya === "netral" ? "" : u.gaya) }, ikon(u.ikon)),
      el("span", { className: "teks" }, el("span", { className: "judul", textContent: u.judul }), el("span", { className: "ket", textContent: `${waktu} · ${u.ket}` })),
      el("span", { className: "jumlah " + u.gaya, textContent: u.angka })
    )
  );
}

export function kosong(teks) {
  return el("li", { className: "kosong", textContent: teks });
}

export { formatRupiah };
