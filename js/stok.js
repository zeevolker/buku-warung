// stok.js: logika halaman Stok Barang.
const namaEl = document.getElementById("nama");
const jumlahEl = document.getElementById("jumlah-awal");
const hargaEl = document.getElementById("harga");
const pesanEl = document.getElementById("pesan");
const daftarEl = document.getElementById("daftar-barang");

function tambah() {
  const nama = namaEl.value.trim();
  const jumlah = Number(jumlahEl.value);

  if (!nama) {
    pesanEl.textContent = "Isi nama barang dulu.";
    namaEl.focus();
    return;
  }
  if (jumlahEl.value === "" || jumlah < 0) {
    pesanEl.textContent = "Isi jumlah stok (boleh 0).";
    jumlahEl.focus();
    return;
  }

  if (!tambahBarang(nama, jumlah, ambilAngka(hargaEl))) return;
  pesanEl.textContent = "";
  document.getElementById("form-barang").reset();
  namaEl.focus();
  tampilkan();
}

function buatTombolUbah(teks, label, onClick) {
  const tombol = document.createElement("button");
  tombol.type = "button";
  tombol.className = "ubah";
  tombol.textContent = teks;
  tombol.setAttribute("aria-label", label);
  tombol.addEventListener("click", onClick);
  return tombol;
}

// Urutan daftar (berisi id barang). Barang yang hampir habis ditaruh paling atas
// saat halaman dibuka atau saat daftar berubah (tambah/hapus). Saat menekan + atau −,
// urutannya dibekukan supaya barang yang sedang diubah tidak pindah tempat.
let urutan = [];

function tampilkan(urutUlang = true) {
  const barang = ambilData(KEY_BARANG);
  daftarEl.innerHTML = "";

  if (barang.length === 0) {
    const kosong = document.createElement("li");
    kosong.className = "kosong";
    kosong.textContent =
      "Belum ada barang. Tambahkan barang pertamamu di atas.";
    daftarEl.appendChild(kosong);
    return;
  }

  if (urutUlang) {
    barang.sort((a, b) => a.stok - b.stok);
    urutan = barang.map((b) => b.id);
  } else {
    barang.sort((a, b) => urutan.indexOf(a.id) - urutan.indexOf(b.id));
  }

  barang.forEach((b) => {
    const menipis = b.stok <= BATAS_MENIPIS;

    const li = document.createElement("li");
    li.className = "barang" + (menipis ? " menipis" : "");

    // Baris atas: nama + harga, dan status kalau stok menipis
    const atas = document.createElement("div");
    atas.className = "atas";

    const kiri = document.createElement("div");
    const nama = document.createElement("div");
    nama.className = "nama";
    nama.textContent = b.nama;
    const harga = document.createElement("div");
    harga.className = "harga";
    harga.textContent = b.harga ? formatRupiah(b.harga) : "Harga belum diisi";
    kiri.append(nama, harga);
    atas.appendChild(kiri);

    if (menipis) {
      const status = document.createElement("div");
      status.className = "status";
      status.textContent = b.stok === 0 ? "Habis" : "Hampir habis";
      atas.appendChild(status);
    }

    // Baris bawah: tombol − jumlah + dan hapus
    const kontrol = document.createElement("div");
    kontrol.className = "kontrol";

    const jumlah = document.createElement("span");
    jumlah.className = "jumlah";
    jumlah.textContent = b.stok;

    const hapus = buatTombolHapus(() => {
      hapusBarang(b.id);
      tampilkan();
    });

    kontrol.append(
      buatTombolUbah("−", `Kurangi stok ${b.nama}`, () => {
        ubahStok(b.id, -1);
        tampilkan(false);
      }),
      jumlah,
      buatTombolUbah("+", `Tambah stok ${b.nama}`, () => {
        ubahStok(b.id, +1);
        tampilkan(false);
      }),
      hapus,
    );

    const diubah = document.createElement("small");
    diubah.className = "diubah";
    diubah.textContent =
      "Terakhir diubah: " + formatWaktuLengkap(b.diubah || b.id);

    li.append(atas, kontrol, diubah);
    daftarEl.appendChild(li);
  });
}

pasangFormatRupiah(hargaEl);
document.getElementById("btn-tambah").addEventListener("click", tambah);
tampilkan();
