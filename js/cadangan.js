// cadangan.js: simpan dan pulihkan data lewat file JSON.

const terakhirEl = document.getElementById("cadangan-terakhir");
const pesanCadanganEl = document.getElementById("cadangan-pesan");
const fileEl = document.getElementById("file-cadangan");
const konfirmasiEl = document.getElementById("cadangan-konfirmasi");
const ringkasEl = document.getElementById("cadangan-ringkas");

let dataMenunggu = null; // isi file yang sudah valid, menunggu konfirmasi pengguna

function tampilTerakhir() {
  const ms = Number(localStorage.getItem(KEY_CADANGAN_TERAKHIR));
  terakhirEl.textContent = ms
    ? "Terakhir dicadangkan: " + formatWaktuLengkap(ms)
    : "Belum pernah dicadangkan.";
}

// Pastikan isi file benar-benar cadangan Buku Warung sebelum dipakai.
function dataValid(o) {
  return Boolean(
    o &&
    o.aplikasi === "buku-warung" &&
    Array.isArray(o.transaksi) &&
    Array.isArray(o.barang) &&
    o.transaksi.every((t) => ["masuk", "keluar"].includes(t.tipe) && Number.isFinite(t.nominal) && typeof t.tanggal === "string") &&
    o.barang.every((b) => typeof b.nama === "string" && Number.isFinite(b.stok))
  );
}

function simpanCadangan() {
  const isi = JSON.stringify(
    {
      aplikasi: "buku-warung",
      versi: 1,
      dibuat: Date.now(),
      transaksi: ambilData(KEY_TRANSAKSI),
      barang: ambilData(KEY_BARANG),
    },
    null,
    2
  );

  const url = URL.createObjectURL(new Blob([isi], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `buku-warung-cadangan-${hariIni()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  localStorage.setItem(KEY_CADANGAN_TERAKHIR, String(Date.now()));
  tampilTerakhir();
  pesanCadanganEl.textContent = "Cadangan diunduh. Simpan file-nya di tempat aman, misalnya kirim ke WhatsApp sendiri.";
}

function bacaFile(file) {
  const pembaca = new FileReader();
  pembaca.onload = () => {
    try {
      const o = JSON.parse(pembaca.result);
      if (!dataValid(o)) throw new Error("format salah");
      dataMenunggu = o;
      ringkasEl.textContent =
        `Ditemukan ${o.transaksi.length} catatan dan ${o.barang.length} barang` +
        (o.dibuat ? ` (dicadangkan ${formatWaktuLengkap(o.dibuat)})` : "") +
        ". Memulihkan akan MENGGANTI semua data di HP ini.";
      konfirmasiEl.hidden = false;
      pesanCadanganEl.textContent = "";
    } catch (e) {
      pesanCadanganEl.textContent = "File ini bukan cadangan Buku Warung yang valid.";
    }
  };
  pembaca.readAsText(file);
}

fileEl.addEventListener("change", () => {
  if (fileEl.files[0]) bacaFile(fileEl.files[0]);
  fileEl.value = ""; // supaya file yang sama bisa dipilih lagi
});

document.getElementById("btn-pulihkan-ya").addEventListener("click", () => {
  if (!dataMenunggu) return;
  const berhasil =
    simpanData(KEY_TRANSAKSI, dataMenunggu.transaksi) &&
    simpanData(KEY_BARANG, dataMenunggu.barang);
  if (!berhasil) {
    konfirmasiEl.hidden = true;
    pesanCadanganEl.textContent =
      "Pemulihan gagal karena data tidak bisa disimpan. Cek ruang penyimpanan HP lalu coba lagi.";
    return;
  }
  dataMenunggu = null;
  location.reload(); // muat ulang supaya angka ringkasan ikut diperbarui
});

document.getElementById("btn-pulihkan-batal").addEventListener("click", () => {
  dataMenunggu = null;
  konfirmasiEl.hidden = true;
});

document.getElementById("btn-cadangan").addEventListener("click", simpanCadangan);
tampilTerakhir();
