// pengingat.js: ingatkan pengguna untuk mencadangkan data.
// Muncul kalau sudah 7 hari sejak cadangan terakhir (atau data sudah lebih
// dari 7 hari dan belum pernah dicadangkan). "Nanti" menundanya 1 hari.
const HARI_PENGINGAT = 7;
const KEY_PENGINGAT_TUNDA = "bw_pengingat_tunda";
const MS_SEHARI = 24 * 60 * 60 * 1000;

function bacaAngka(key) {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch (e) {
    return 0;
  }
}

function hariSejak(ms) {
  return Math.floor((Date.now() - ms) / MS_SEHARI);
}

// Mengembalikan kalimat pengingat, atau null kalau belum perlu.
function pesanPengingat() {
  if (bacaAngka(KEY_PENGINGAT_TUNDA) > Date.now()) return null;

  const terakhir = bacaAngka(KEY_CADANGAN_TERAKHIR);
  if (terakhir) {
    const hari = hariSejak(terakhir);
    return hari >= HARI_PENGINGAT
      ? `Sudah ${hari} hari data belum dicadangkan.`
      : null;
  }

  const transaksi = ambilData(KEY_TRANSAKSI);
  if (transaksi.length === 0) return null;
  const tertua = Math.min(...transaksi.map((t) => t.dibuat || t.id));
  return hariSejak(tertua) >= HARI_PENGINGAT
    ? "Data belum pernah dicadangkan."
    : null;
}

function tampilkanPengingat() {
  const pesan = pesanPengingat();
  const tujuan = document.querySelector(".ringkas");
  if (!pesan || !tujuan) return;

  const el = document.createElement("div");
  el.className = "banner pengingat";
  el.setAttribute("role", "status");

  const teks = document.createElement("span");
  teks.textContent = pesan + " Simpan cadangan supaya catatan tidak hilang.";

  const cadangkan = document.createElement("a");
  cadangkan.href = "ringkasan.html#cadangan";
  cadangkan.className = "btn-kecil";
  cadangkan.textContent = "Cadangkan";

  const nanti = document.createElement("button");
  nanti.type = "button";
  nanti.className = "btn-kecil";
  nanti.textContent = "Nanti";
  nanti.addEventListener("click", () => {
    try {
      localStorage.setItem(
        KEY_PENGINGAT_TUNDA,
        String(Date.now() + MS_SEHARI),
      );
    } catch (e) {
      // Gagal menyimpan tidak apa-apa: pengingat muncul lagi besok.
    }
    el.remove();
  });

  const aksi = document.createElement("div");
  aksi.className = "aksi-pengingat";
  aksi.append(cadangkan, nanti);

  el.append(teks, aksi);
  tujuan.before(el);
}

tampilkanPengingat();
