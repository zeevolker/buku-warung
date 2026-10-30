// komponen.js: potongan tampilan yang dipakai lebih dari satu halaman.

import { formatRupiah } from "../lib/format.js";
import { formatWaktuLengkap } from "../lib/tanggal.js";

// Buat elemen dengan cepat: el("button", { className: "x", textContent: "Hapus" })
export function el(tag, isi = {}, ...anak) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(isi)) {
    if (k.startsWith("aria-") || k === "role" || k === "for") e.setAttribute(k, v);
    else e[k] = v;
  }
  e.append(...anak.filter((a) => a !== null && a !== undefined && a !== false));
  return e;
}

// Ambil angka murni dari kolom yang tampil "15.000" -> 15000
export function ambilAngka(input) {
  return Number(input.value.replace(/\D/g, "")) || 0;
}

// Saat mengetik, otomatis tampil dengan titik ribuan: 15000 -> 15.000
export function pasangFormatRupiah(input) {
  input.addEventListener("input", () => {
    const angka = ambilAngka(input);
    input.value = angka ? angka.toLocaleString("id-ID") : "";
  });
  return input;
}

export function inputRupiah({ nilai = 0, placeholder = "", label = "" } = {}) {
  const i = el("input", { type: "text", inputMode: "numeric", autocomplete: "off", placeholder });
  if (label) i.setAttribute("aria-label", label);
  if (nilai) i.value = nilai.toLocaleString("id-ID");
  return pasangFormatRupiah(i);
}

// Tombol Hapus dengan konfirmasi di tempat: "Hapus" -> "Yakin? [Ya, hapus] [Batal]"
export function buatTombolHapus(onYa, teks = "Hapus") {
  const wadah = el("span", { className: "hapus-wadah" });
  const tombol = (t, kelas, fn) => el("button", { type: "button", className: kelas, textContent: t, onclick: fn });
  const awal = () => wadah.replaceChildren(tombol(teks, "hapus", konfirmasi));
  const konfirmasi = () =>
    wadah.replaceChildren(el("span", { className: "tanya", textContent: "Yakin?" }), tombol("Ya, hapus", "hapus-ya", onYa), tombol("Batal", "hapus", awal));
  awal();
  return wadah;
}

const LABEL_SUMBER = { jual: "Penjualan barang", bayar_kasbon: "Bayar kasbon", pinjam_kasbon: "Pinjaman kasbon" };

// Satu baris catatan uang (Catat Cepat dan Riwayat)
export function buatItemTransaksi(t, { onUbah, onHapus }) {
  const bisaDiubah = t.sumber === "manual";
  return el(
    "li",
    { className: "item " + t.tipe },
    el("span", { textContent: t.catatan || (t.tipe === "masuk" ? "Uang masuk" : "Uang keluar") }),
    el("strong", { textContent: (t.tipe === "masuk" ? "+ " : "- ") + formatRupiah(t.nominal) }),
    el(
      "small",
      { className: "waktu" },
      formatWaktuLengkap(t.created_at),
      LABEL_SUMBER[t.sumber] ? el("span", { className: "label-sumber", textContent: LABEL_SUMBER[t.sumber] }) : null
    ),
    el(
      "span",
      { className: "aksi" },
      bisaDiubah ? el("button", { type: "button", className: "ubah-catat", textContent: "Ubah", onclick: () => onUbah(t) }) : null,
      buatTombolHapus(() => onHapus(t))
    )
  );
}

// Kasbon yang diberikan pada hari itu: bukan uang masuk, jadi tidak ikut Total
export function buatItemKasbon(k, namaPelanggan) {
  return el(
    "li",
    { className: "item kasbon-hari" },
    el("span", { textContent: `Kasbon ${namaPelanggan}` + (k.catatan ? `: ${k.catatan}` : "") }),
    el("strong", { textContent: formatRupiah(k.nominal) }),
    el("small", { className: "waktu" }, formatWaktuLengkap(k.created_at), el("span", { className: "label-sumber", textContent: "Kasbon, tidak masuk Total" })),
    el("span", { className: "aksi" }, el("a", { className: "btn-kecil", href: "kasbon.html", textContent: "Lihat" }))
  );
}

export function buatKosong(teks) {
  return el("li", { className: "kosong", textContent: teks });
}

// Bagikan teks lewat menu bagikan HP; kalau tidak didukung, buka WhatsApp langsung
export async function bagikanTeks(teks) {
  if (navigator.share) {
    try {
      await navigator.share({ text: teks });
    } catch {
      // Dibatalkan pengguna: tidak apa-apa
    }
    return;
  }
  window.open("https://wa.me/?text=" + encodeURIComponent(teks), "_blank", "noopener");
}

// Jalankan aksi yang menulis data. Kalau penyimpanan gagal, beri tahu pengguna.
export async function aman(aksi) {
  try {
    return await aksi();
  } catch (e) {
    console.error(e);
    tampilGagalSimpan();
    return { galat: "Data gagal disimpan." };
  }
}

export function tampilGagalSimpan() {
  if (document.getElementById("gagal-simpan")) return;
  document.body.prepend(
    el("div", {
      id: "gagal-simpan",
      className: "gagal-simpan",
      role: "alert",
      textContent:
        "Data gagal disimpan. Penyimpanan HP mungkin penuh, atau browser sedang dalam mode penyamaran. Coba muat ulang halaman.",
    })
  );
}

// Perbarui tampilan saat data berubah dari HP lain (lewat sinkron), tapi jangan
// mengganggu pengguna yang sedang mengetik di dalam daftar.
export function saatDataBerubah(gambarUlang) {
  globalThis.addEventListener("bw:data-berubah", (e) => {
    if (e.detail?.sumber !== "server") return;
    const aktif = document.activeElement;
    if (aktif && aktif.tagName === "INPUT" && aktif.closest("ul")) return;
    gambarUlang();
  });
}

// Pesan singkat yang hilang sendiri (misalnya penghapusan yang ditolak)
let timerKabar;
export function kabar(teks) {
  let k = document.getElementById("kabar");
  if (!k) {
    k = el("p", { id: "kabar", className: "kabar", role: "status" });
    document.body.append(k);
  }
  k.textContent = teks;
  clearTimeout(timerKabar);
  timerKabar = setTimeout(() => (k.textContent = ""), 4000);
}
