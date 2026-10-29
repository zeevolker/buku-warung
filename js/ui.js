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
      buatTombol("Batal", "hapus", tampilAwal)
    );
  }

  tampilAwal();
  return wadah;
}
