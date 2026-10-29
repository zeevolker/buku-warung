// ui.js: komponen kecil yang dipakai lebih dari satu halaman.

// Tombol Hapus dengan konfirmasi di tempat:
// klik "Hapus" -> muncul "Yakin?" + [Ya, hapus] [Batal].
// onYa dijalankan hanya kalau pengguna menekan "Ya, hapus".
function buatTombolHapus(onYa) {
  const wadah = document.createElement("span");
  wadah.className = "hapus-wadah";

  function buatTombol(teks, kelas, onClick) {
    const tombol = document.createElement("button");
    tombol.type = "button";
    tombol.className = kelas;
    tombol.textContent = teks;
    tombol.addEventListener("click", onClick);
    return tombol;
  }

  function tampilAwal() {
    wadah.replaceChildren(buatTombol("Hapus", "hapus", tampilKonfirmasi));
  }

  function tampilKonfirmasi() {
    const tanya = document.createElement("span");
    tanya.className = "tanya";
    tanya.textContent = "Yakin?";
    wadah.replaceChildren(
      tanya,
      buatTombol("Ya, hapus", "hapus-ya", onYa),
      buatTombol("Batal", "hapus", tampilAwal),
    );
  }

  tampilAwal();
  return wadah;
}

// Ambil angka murni dari kolom yang tampil "15.000" -> 15000
function ambilAngka(el) {
  return Number(el.value.replace(/\D/g, "")) || 0;
}

// Saat mengetik, otomatis tampil dengan titik ribuan: 15000 -> 15.000
function pasangFormatRupiah(el) {
  el.addEventListener("input", () => {
    const angka = ambilAngka(el);
    el.value = angka ? angka.toLocaleString("id-ID") : "";
  });
}

// Satu baris catatan transaksi, dipakai di Catat Cepat dan Riwayat.
// aksi.onUbah(t) dan aksi.onHapus(t) dijalankan saat tombolnya ditekan.
function buatItemTransaksi(t, aksi) {
  const li = document.createElement("li");
  li.className = "item " + t.tipe;

  const info = document.createElement("span");
  info.textContent =
    t.catatan || (t.tipe === "masuk" ? "Uang masuk" : "Uang keluar");

  const nominal = document.createElement("strong");
  nominal.textContent =
    (t.tipe === "masuk" ? "+ " : "- ") + formatRupiah(t.nominal);

  const waktu = document.createElement("small");
  waktu.className = "waktu";
  waktu.textContent = labelWaktuTransaksi(t);

  const ubah = document.createElement("button");
  ubah.type = "button";
  ubah.className = "ubah-catat";
  ubah.textContent = "Ubah";
  ubah.addEventListener("click", () => aksi.onUbah(t));

  const hapus = buatTombolHapus(() => aksi.onHapus(t));

  const wadahAksi = document.createElement("span");
  wadahAksi.className = "aksi";
  wadahAksi.append(ubah, hapus);

  li.append(info, nominal, waktu, wadahAksi);
  return li;
}

// Bagikan teks lewat menu bagikan HP (ada WhatsApp di dalamnya).
// Kalau browser tidak mendukung, buka WhatsApp langsung dengan teks terisi.
async function bagikanTeks(teks) {
  if (navigator.share) {
    try {
      await navigator.share({ text: teks });
    } catch (e) {
      // Pengguna membatalkan: tidak apa-apa.
    }
    return;
  }
  window.open(
    "https://wa.me/?text=" + encodeURIComponent(teks),
    "_blank",
    "noopener",
  );
}
