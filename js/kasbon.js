// kasbon.js: logika halaman Kasbon (utang pelanggan).
const namaEl = document.getElementById("k-nama");
const nominalEl = document.getElementById("k-nominal");
const teleponEl = document.getElementById("k-telepon");
const catatanEl = document.getElementById("k-catatan");
const pesanEl = document.getElementById("k-pesan");
const daftarEl = document.getElementById("daftar-pelanggan");
const totalEl = document.getElementById("k-total");
const jumlahEl = document.getElementById("k-jumlah");
const namaListEl = document.getElementById("daftar-nama");

// Kartu pelanggan yang sedang dibuka (disimpan supaya tetap terbuka setelah tampilan diperbarui)
const terbuka = new Set();

function tambahUtangBaru() {
  const nama = namaEl.value.trim();
  const nominal = ambilAngka(nominalEl);

  if (!nama) {
    pesanEl.textContent = "Isi nama pelanggan dulu.";
    namaEl.focus();
    return;
  }
  if (nominal <= 0) {
    pesanEl.textContent = "Isi jumlah utang lebih dari 0.";
    nominalEl.focus();
    return;
  }
  if (!catatKasbon(nama, "utang", nominal, catatanEl.value, teleponEl.value)) return;

  pesanEl.textContent = "";
  document.getElementById("form-kasbon").reset();
  namaEl.focus();
  tampilkan();
}

function teksPengingat(p) {
  return `Halo ${p.nama}, mengingatkan kasbon di warung sebesar ${formatRupiah(sisaKasbon(p))}. Terima kasih.`;
}

function ingatkan(p) {
  const nomor = nomorWhatsApp(p.telepon);
  const teks = encodeURIComponent(teksPengingat(p));
  // Tanpa nomor, WhatsApp tetap terbuka dan pengguna memilih kontaknya sendiri.
  window.open(`https://wa.me/${nomor}?text=${teks}`, "_blank", "noopener");
}

function buatBaris(p, m) {
  const baris = document.createElement("div");
  baris.className = "mutasi " + m.tipe;

  const jenis = document.createElement("span");
  jenis.className = "jenis";
  jenis.textContent = (m.tipe === "utang" ? "Utang" : "Bayar") + (m.catatan ? ": " + m.catatan : "");

  const jumlah = document.createElement("strong");
  jumlah.textContent = (m.tipe === "utang" ? "+ " : "− ") + formatRupiah(m.nominal);

  const waktu = document.createElement("small");
  waktu.textContent = formatWaktuLengkap(m.dibuat);

  const hapus = buatTombolHapus(() => {
    hapusMutasiKasbon(p.id, m.id);
    tampilkan();
  });

  baris.append(jenis, jumlah, waktu, hapus);
  return baris;
}

function buatDetail(p, sisa) {
  const detail = document.createElement("div");
  detail.className = "detail";
  detail.hidden = !terbuka.has(p.id);
  detail.id = "detail-" + p.id;

  // Riwayat utang dan bayar, terbaru di atas
  [...p.mutasi].reverse().forEach((m) => detail.appendChild(buatBaris(p, m)));

  const nominal = document.createElement("input");
  nominal.type = "text";
  nominal.inputMode = "numeric";
  nominal.autocomplete = "off";
  nominal.placeholder = "Jumlah (Rp)";
  nominal.setAttribute("aria-label", "Jumlah untuk " + p.nama);
  pasangFormatRupiah(nominal);

  const catatan = document.createElement("input");
  catatan.type = "text";
  catatan.maxLength = 60;
  catatan.placeholder = "Catatan (boleh kosong)";
  catatan.setAttribute("aria-label", "Catatan untuk " + p.nama);

  const centang = document.createElement("label");
  centang.className = "centang";
  const kotak = document.createElement("input");
  kotak.type = "checkbox";
  kotak.checked = true;
  centang.append(kotak, document.createTextNode("Catat bayaran sebagai uang masuk"));

  const pesan = document.createElement("p");
  pesan.className = "pesan-kartu";
  pesan.setAttribute("role", "alert");

  function baca() {
    const n = ambilAngka(nominal);
    if (n <= 0) {
      pesan.textContent = "Isi jumlahnya dulu.";
      nominal.focus();
      return 0;
    }
    return n;
  }

  const aksi = document.createElement("div");
  aksi.className = "aksi-kasbon";

  const btnUtang = document.createElement("button");
  btnUtang.type = "button";
  btnUtang.className = "utang";
  btnUtang.textContent = "Tambah Utang";
  btnUtang.addEventListener("click", () => {
    const n = baca();
    if (!n) return;
    if (catatKasbon(p.nama, "utang", n, catatan.value)) tampilkan();
  });

  const btnBayar = document.createElement("button");
  btnBayar.type = "button";
  btnBayar.className = "bayar";
  btnBayar.textContent = "Terima Bayar";
  btnBayar.addEventListener("click", () => {
    const n = baca();
    if (!n) return;
    if (n > sisa) {
      pesan.textContent = `Melebihi sisa utang (${formatRupiah(sisa)}).`;
      return;
    }
    if (!catatKasbon(p.nama, "bayar", n, catatan.value)) return;
    if (kotak.checked) tambahTransaksi("masuk", n, "Bayar kasbon: " + p.nama);
    tampilkan();
  });
  aksi.append(btnUtang, btnBayar);

  const bawah = document.createElement("div");
  bawah.className = "bawah";

  if (sisa > 0) {
    const wa = document.createElement("button");
    wa.type = "button";
    wa.className = "btn-kecil";
    wa.textContent = "Ingatkan lewat WhatsApp";
    wa.addEventListener("click", () => ingatkan(p));
    bawah.appendChild(wa);
  }
  bawah.appendChild(
    buatTombolHapus(() => {
      terbuka.delete(p.id);
      hapusPelanggan(p.id);
      tampilkan();
    })
  );

  detail.append(nominal, catatan, centang, pesan, aksi, bawah);
  return detail;
}

function buatKartu(p) {
  const sisa = sisaKasbon(p);
  const li = document.createElement("li");
  li.className = "pelanggan" + (sisa <= 0 ? " lunas" : "");

  const atas = document.createElement("div");
  atas.className = "atas";

  const kiri = document.createElement("div");
  const nama = document.createElement("div");
  nama.className = "nama";
  nama.textContent = p.nama;
  const info = document.createElement("div");
  info.className = "info";
  const terakhir = p.mutasi.length ? p.mutasi[p.mutasi.length - 1].dibuat : p.id;
  info.textContent = "Terakhir: " + formatWaktuLengkap(terakhir);
  kiri.append(nama, info);

  const besar = document.createElement("div");
  besar.className = "sisa";
  besar.textContent = sisa > 0 ? formatRupiah(sisa) : "Lunas";
  atas.append(kiri, besar);

  const detail = buatDetail(p, sisa);

  const buka = document.createElement("button");
  buka.type = "button";
  buka.className = "btn-kecil buka";
  buka.setAttribute("aria-controls", detail.id);
  function setBuka(nilai) {
    buka.setAttribute("aria-expanded", String(nilai));
    buka.textContent = nilai ? "Tutup" : "Buka rincian";
    detail.hidden = !nilai;
  }
  setBuka(terbuka.has(p.id));
  buka.addEventListener("click", () => {
    const nilai = detail.hidden;
    if (nilai) terbuka.add(p.id);
    else terbuka.delete(p.id);
    setBuka(nilai);
  });

  li.append(atas, buka, detail);
  return li;
}

function tampilkan() {
  const data = ambilData(KEY_KASBON);

  // Hero: total yang belum dibayar
  const berutang = data.filter((p) => sisaKasbon(p) > 0);
  const total = berutang.reduce((jml, p) => jml + sisaKasbon(p), 0);
  totalEl.textContent = formatRupiah(total);
  jumlahEl.textContent = berutang.length
    ? `dari ${berutang.length} pelanggan`
    : "Tidak ada utang yang belum dibayar";

  // Saran nama saat mengetik (supaya tidak salah eja dan jadi dua pelanggan)
  namaListEl.replaceChildren(
    ...data.map((p) => {
      const o = document.createElement("option");
      o.value = p.nama;
      return o;
    })
  );

  daftarEl.innerHTML = "";
  if (data.length === 0) {
    const kosong = document.createElement("li");
    kosong.className = "kosong";
    kosong.textContent = "Belum ada kasbon. Catat utang pelanggan pertamamu di atas.";
    daftarEl.appendChild(kosong);
    return;
  }

  // Yang masih berutang paling atas (terbesar dulu), yang lunas di bawah
  [...data]
    .sort((a, b) => sisaKasbon(b) - sisaKasbon(a))
    .forEach((p) => daftarEl.appendChild(buatKartu(p)));
}

pasangFormatRupiah(nominalEl);
document.getElementById("btn-utang").addEventListener("click", tambahUtangBaru);
tampilkan();
