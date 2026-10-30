// kepala.js: tombol status akun di pojok kanan atas setiap halaman,
// plus pengingat untuk mengamankan data.

import { el } from "./komponen.js";
import { ambilStatus } from "../app.js";
import { supabaseAktif } from "../data/supabase.js";
import { semua } from "../data/db.js";

const TEKS = {
  tamu: "Masuk",
  sinkron: "Tersimpan",
  menyinkron: "Menyimpan…",
  offline: "Offline",
  gagal: "Gagal sinkron",
};

export function pasangKepala() {
  const tombol = document.getElementById("status-akun");
  if (!tombol) return;
  const gambar = (s) => {
    let teks = TEKS[s.keadaan] || "Akun";
    if (s.keadaan === "offline" && s.belum) teks = `Offline · ${s.belum} menunggu`;
    if (s.keadaan === "tamu" && !supabaseAktif()) teks = "Data di HP ini";
    tombol.textContent = teks;
    tombol.dataset.keadaan = s.keadaan;
    tombol.setAttribute(
      "aria-label",
      s.keadaan === "tamu" ? "Akun: belum masuk, data hanya di HP ini" : `Akun: ${teks}${s.email ? ", " + s.email : ""}`
    );
  };
  gambar(ambilStatus());
  globalThis.addEventListener("bw:status", (e) => gambar(e.detail));
}

// ---------- Pengingat ----------
const KEY_TUNDA = "bw_pengingat_tunda";
const KEY_CADANGAN_TERAKHIR = "bw_cadangan_terakhir";
const MS_SEHARI = 86_400_000;

function bacaAngka(key) {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

// Tamu yang sudah mencatat lebih dari 3 hari diingatkan untuk masuk (kalau cloud tersedia)
// atau menyimpan cadangan (kalau tidak). Yang sudah masuk tidak perlu diingatkan.
export async function pasangPengingat() {
  const tujuan = document.querySelector(".ringkas");
  if (!tujuan || bacaAngka(KEY_TUNDA) > Date.now()) return;

  // Tunggu status akun pertama, supaya pengguna yang sudah masuk tidak melihat pengingat sekejap
  await new Promise((r) => setTimeout(r, 1200));
  if (ambilStatus().email) return;

  const transaksi = await semua("transaksi");
  if (!transaksi.length) return;
  const tertua = Math.min(...transaksi.map((t) => t.created_at));
  const terakhirCadangan = bacaAngka(KEY_CADANGAN_TERAKHIR);
  const patokan = Math.max(tertua, terakhirCadangan);
  const hari = Math.floor((Date.now() - patokan) / MS_SEHARI);

  const pakaiCloud = supabaseAktif();
  if (hari < (pakaiCloud ? 3 : 7)) return;

  const pesan = pakaiCloud
    ? "Data masih hanya ada di HP ini. Masuk dengan akun supaya tersimpan aman dan bisa dibuka di HP lain."
    : `Sudah ${hari} hari data belum dicadangkan. Simpan cadangan supaya catatan tidak hilang.`;

  const banner = el(
    "div",
    { className: "banner pengingat", role: "status" },
    el("span", { textContent: pesan }),
    el(
      "div",
      { className: "aksi-pengingat" },
      el("a", { className: "btn-kecil", href: pakaiCloud ? "akun.html" : "akun.html#cadangan", textContent: pakaiCloud ? "Masuk" : "Cadangkan" }),
      el("button", {
        type: "button",
        className: "btn-kecil",
        textContent: "Nanti",
        onclick: () => {
          try {
            localStorage.setItem(KEY_TUNDA, String(Date.now() + MS_SEHARI));
          } catch {
            // tidak apa-apa
          }
          banner.remove();
        },
      })
    )
  );
  tujuan.before(banner);
}
