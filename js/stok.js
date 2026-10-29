// stok.js: logika halaman Stok Barang.
const namaEl = document.getElementById("nama");
const jumlahEl = document.getElementById("jumlah-awal");
const hargaEl = document.getElementById("harga");
const hargaBeliEl = document.getElementById("harga-beli");
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

  if (!tambahBarang(nama, jumlah, ambilAngka(hargaEl), ambilAngka(hargaBeliEl))) return;
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

// Barang yang panel "Ubah harga"-nya sedang terbuka
const panelTerbuka = new Set();
// Pesan terakhir per barang (misalnya "Terjual 2 ..."), supaya tetap tampil setelah daftar diperbarui
const pesanBarang = new Map();

function buatInputRupiah(nilai, label) {
  const el = document.createElement("input");
  el.type = "text";
  el.inputMode = "numeric";
  el.autocomplete = "off";
  el.setAttribute("aria-label", label);
  el.value = nilai ? nilai.toLocaleString("id-ID") : "";
  pasangFormatRupiah(el);
  return el;
}

// Baris "Jual" + panel ubah harga untuk satu barang
function buatBagianJual(b) {
  const pesan = document.createElement("p");
  pesan.className = "pesan-barang";
  pesan.setAttribute("role", "status");
  const lama = pesanBarang.get(b.id);
  if (lama) {
    pesan.textContent = lama.teks;
    pesan.classList.toggle("galat", lama.galat);
  }

  const baris = document.createElement("div");
  baris.className = "baris-jual";

  const jumlah = document.createElement("input");
  jumlah.type = "number";
  jumlah.inputMode = "numeric";
  jumlah.min = "1";
  jumlah.value = "1";
  jumlah.setAttribute("aria-label", "Jumlah yang dijual: " + b.nama);

  const jual = document.createElement("button");
  jual.type = "button";
  jual.className = "jual";
  jual.textContent = "Jual";
  jual.disabled = b.stok === 0;
  jual.addEventListener("click", () => {
    const n = Math.floor(Number(jumlah.value));
    if (!(n >= 1)) {
      pesanBarang.clear();
      pesanBarang.set(b.id, { teks: "Isi jumlah minimal 1.", galat: true });
      return tampilkan(false);
    }
    const galat = jualBarang(b.id, n);
    pesanBarang.clear();
    pesanBarang.set(
      b.id,
      galat
        ? { teks: galat, galat: true }
        : { teks: `Terjual ${n}: ${formatRupiah(b.harga * n)} dicatat sebagai uang masuk.`, galat: false }
    );
    if (galat && !b.harga) panelTerbuka.add(b.id);
    tampilkan(false);
  });

  const ubah = document.createElement("button");
  ubah.type = "button";
  ubah.className = "btn-kecil";
  ubah.textContent = "Ubah harga";
  ubah.setAttribute("aria-expanded", String(panelTerbuka.has(b.id)));
  ubah.addEventListener("click", () => {
    if (panelTerbuka.has(b.id)) panelTerbuka.delete(b.id);
    else panelTerbuka.add(b.id);
    tampilkan(false);
  });

  baris.append(jumlah, jual, ubah);

  const panel = document.createElement("div");
  panel.className = "panel-harga";
  panel.hidden = !panelTerbuka.has(b.id);

  const kolom = document.createElement("div");
  kolom.className = "baris-input";
  const isiJual = buatInputRupiah(b.harga, "Harga jual " + b.nama);
  const isiBeli = buatInputRupiah(b.hargaBeli, "Harga beli " + b.nama);
  [["Harga jual", isiJual], ["Harga beli", isiBeli]].forEach(([teks, el]) => {
    const wadah = document.createElement("div");
    const label = document.createElement("span");
    label.className = "label-kecil";
    label.textContent = teks + " (Rp)";
    wadah.append(label, el);
    kolom.appendChild(wadah);
  });

  const simpan = document.createElement("button");
  simpan.type = "button";
  simpan.className = "btn-kecil simpan";
  simpan.textContent = "Simpan harga";
  simpan.addEventListener("click", () => {
    if (!ubahHargaBarang(b.id, ambilAngka(isiJual), ambilAngka(isiBeli))) return;
    panelTerbuka.delete(b.id);
    pesanBarang.clear();
    pesanBarang.set(b.id, { teks: "Harga disimpan.", galat: false });
    tampilkan(false);
  });

  panel.append(kolom, simpan);
  return { baris, pesan, panel };
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
    harga.textContent =
      (b.harga ? "Jual " + formatRupiah(b.harga) : "Harga jual belum diisi") +
      (b.hargaBeli ? " · Modal\u00a0" + formatRupiah(b.hargaBeli).replace(" ", "\u00a0") : "");
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

    const { baris: barisJual, pesan, panel } = buatBagianJual(b);

    const diubah = document.createElement("small");
    diubah.className = "diubah";
    diubah.textContent =
      "Terakhir diubah: " + formatWaktuLengkap(b.diubah || b.id);

    li.append(atas, kontrol, barisJual, pesan, panel, diubah);
    daftarEl.appendChild(li);
  });
}

pasangFormatRupiah(hargaEl);
pasangFormatRupiah(hargaBeliEl);
document.getElementById("btn-tambah").addEventListener("click", tambah);
tampilkan();
