// kasbon.js: halaman Kasbon (utang pelanggan).
import { mulaiAplikasi } from "../app.js";
import { pasangKepala } from "../ui/kepala.js";
import { daftarPelanggan, daftarBarang, catatUtang, terimaBayar, hapusKasbon, hapusPelanggan, ubahTelepon } from "../data/repo.js";
import { formatRupiah, nomorWhatsApp } from "../lib/format.js";
import { formatWaktuLengkap } from "../lib/tanggal.js";
import { jenisKasbon } from "../data/hitung.js";
import { el, ambilAngka, pasangFormatRupiah, inputRupiah, buatTombolHapus, buatKosong, aman, saatDataBerubah } from "../ui/komponen.js";

// Tunggu pemindahan data lama selesai sebelum menampilkan apa pun
await mulaiAplikasi();
pasangKepala();

const $ = (id) => document.getElementById(id);
const terbuka = new Set(); // kartu pelanggan yang sedang dibuka
const pesanKartu = new Map(); // id pelanggan -> pesan kesalahan
let barangTersedia = [];

// ---------- Form kasbon baru ----------

const jenisDipilih = () => document.querySelector('input[name="k-jenis"]:checked').value;

function barangTerpilih() {
  if (jenisDipilih() !== "barang") return null;
  return barangTersedia.find((b) => b.id === $("k-barang").value) || null;
}

const INFO_JENIS = {
  stok: "Stok berkurang otomatis. Total tidak berubah karena uangnya belum diterima.",
  lain: "Untuk barang yang tidak dicatat di Stok. Total tidak berubah karena uangnya belum diterima.",
  tunai: "Uang keluar dari laci, jadi tercatat sebagai uang keluar dan Total berkurang. Saat dibayar, Total bertambah lagi.",
};

// Barang dari stok: nominal dihitung otomatis dari harga jual x jumlah.
// Uang tunai: tidak perlu memilih barang.
function perbaruiForm() {
  const tunai = jenisDipilih() === "tunai";
  const b = barangTerpilih();
  $("bagian-barang").hidden = tunai;
  $("baris-jumlah-barang").hidden = !b;
  $("k-nominal").readOnly = Boolean(b);
  $("label-nominal").textContent = tunai ? "Jumlah pinjaman (Rp)" : "Utang (Rp)";
  $("btn-utang").textContent = tunai ? "Catat Pinjaman" : "Catat Utang";
  $("k-info-jenis").textContent = INFO_JENIS[tunai ? "tunai" : b ? "stok" : "lain"];
  if (!b && $("k-nominal").readOnly === false && $("k-nominal").dataset.otomatis) {
    $("k-nominal").value = "";
    delete $("k-nominal").dataset.otomatis;
  }
  if (b) {
    $("k-nominal").dataset.otomatis = "1";
    const n = Math.max(1, Math.floor(Number($("k-jumlah-barang").value) || 1));
    $("k-nominal").value = (b.harga_jual * n).toLocaleString("id-ID");
    $("k-jumlah-barang").max = String(b.stok);
  }
}

async function catatBaru() {
  const b = barangTerpilih();
  const hasil = await aman(() =>
    catatUtang({
      nama: $("k-nama").value,
      nominal: ambilAngka($("k-nominal")),
      catatan: $("k-catatan").value,
      telepon: $("k-telepon").value,
      barangId: b ? b.id : null,
      jumlah: b ? Math.floor(Number($("k-jumlah-barang").value)) : null,
      jenis: jenisDipilih(),
    })
  );
  if (hasil.galat) {
    $("k-pesan").textContent = hasil.galat;
    return;
  }
  $("k-pesan").textContent = "";
  $("form-kasbon").reset();
  perbaruiForm();
  $("k-nama").focus();
  tampilkan();
}

// ---------- Kartu pelanggan ----------

function teksPengingat(p) {
  return `Halo ${p.nama}, mengingatkan kasbon di warung sebesar ${formatRupiah(p.sisa)}. Terima kasih.`;
}

const LABEL_JENIS = { barang: "Utang barang", lain: "Utang", tunai: "Pinjam uang" };
const KET_KAS = { utang: " · tercatat sebagai uang keluar", bayar: " · tercatat sebagai uang masuk" };

function buatBaris(k) {
  const jenis = k.tipe === "utang" ? LABEL_JENIS[jenisKasbon(k)] : "Bayar";
  return el(
    "div",
    { className: "mutasi " + k.tipe },
    el("span", { className: "jenis", textContent: jenis + (k.catatan ? ": " + k.catatan : "") }),
    el("strong", { textContent: (k.tipe === "utang" ? "+ " : "− ") + formatRupiah(k.nominal) }),
    el("small", {}, formatWaktuLengkap(k.created_at), k.transaksi_id ? KET_KAS[k.tipe] : ""),
    buatTombolHapus(async () => {
      const h = await aman(() => hapusKasbon(k.id));
      if (h.galat) pesanKartu.set(k.pelanggan_id, h.galat);
      tampilkan();
    })
  );
}

function buatDetail(p) {
  const nominal = inputRupiah({ placeholder: "Jumlah (Rp)", label: "Jumlah untuk " + p.nama });
  const catatan = el("input", { type: "text", maxLength: 60, placeholder: "Catatan (boleh kosong)" });
  catatan.setAttribute("aria-label", "Catatan untuk " + p.nama);
  const kotak = el("input", { type: "checkbox", checked: true });
  const namaRadio = "jenis-" + p.id;
  const pilihan = (nilai, teks, pilih = false) =>
    el("label", {}, el("input", { type: "radio", name: namaRadio, value: nilai, checked: pilih }), el("span", { textContent: teks }));
  const segmen = el("div", { className: "segmen kecil" }, pilihan("lain", "Barang", true), pilihan("tunai", "Uang tunai"));
  const jenisUtang = () => segmen.querySelector("input:checked").value;

  const jalankan = async (aksi) => {
    const h = await aman(aksi);
    if (h.galat) pesanKartu.set(p.id, h.galat);
    else pesanKartu.delete(p.id);
    tampilkan();
  };

  const telepon = el("input", { type: "tel", inputMode: "tel", value: p.telepon || "", placeholder: "No. HP (opsional)" });
  telepon.setAttribute("aria-label", "Nomor HP " + p.nama);

  return el(
    "div",
    { className: "detail", id: "detail-" + p.id },
    ...p.kasbon.map(buatBaris),
    nominal,
    catatan,
    el("fieldset", { className: "pilih-jenis" }, el("legend", { textContent: "Tambah utang berupa" }), segmen),
    el("label", { className: "centang" }, kotak, "Catat bayaran sebagai uang masuk"),
    pesanKartu.has(p.id) ? el("p", { className: "pesan-kartu", role: "alert", textContent: pesanKartu.get(p.id) }) : null,
    el(
      "div",
      { className: "aksi-kasbon" },
      el("button", {
        type: "button",
        className: "utang",
        textContent: "Tambah Utang",
        onclick: () => jalankan(() => catatUtang({ nama: p.nama, nominal: ambilAngka(nominal), catatan: catatan.value, jenis: jenisUtang() })),
      }),
      el("button", {
        type: "button",
        className: "bayar",
        textContent: "Terima Bayar",
        onclick: () => jalankan(() => terimaBayar(p.id, { nominal: ambilAngka(nominal), catatan: catatan.value, catatKas: kotak.checked })),
      })
    ),
    el(
      "div",
      { className: "baris-telepon" },
      telepon,
      el("button", { type: "button", className: "btn-kecil", textContent: "Simpan", onclick: () => jalankan(() => ubahTelepon(p.id, telepon.value)) })
    ),
    el(
      "div",
      { className: "bawah" },
      p.sisa > 0
        ? el("button", {
            type: "button",
            className: "btn-kecil",
            textContent: "Ingatkan lewat WhatsApp",
            onclick: () =>
              window.open(`https://wa.me/${nomorWhatsApp(p.telepon)}?text=${encodeURIComponent(teksPengingat(p))}`, "_blank", "noopener"),
          })
        : null,
      buatTombolHapus(() =>
        jalankan(async () => {
          const h = await hapusPelanggan(p.id);
          if (!h.galat) terbuka.delete(p.id);
          return h;
        }), "Hapus pelanggan")
    )
  );
}

function buatKartu(p) {
  const lunas = p.sisa <= 0;
  const buka = terbuka.has(p.id);
  const terakhir = p.kasbon.length ? p.kasbon[0].created_at : p.created_at;
  const tombolBuka = el("button", {
    type: "button",
    className: "btn-kecil buka",
    textContent: buka ? "Tutup" : "Buka rincian",
    onclick: () => {
      buka ? terbuka.delete(p.id) : terbuka.add(p.id);
      tampilkan();
    },
  });
  tombolBuka.setAttribute("aria-expanded", String(buka));
  tombolBuka.setAttribute("aria-controls", "detail-" + p.id);

  return el(
    "li",
    { className: "pelanggan" + (lunas ? " lunas" : "") },
    el(
      "div",
      { className: "atas" },
      el("div", {}, el("div", { className: "nama", textContent: p.nama }), el("div", { className: "info", textContent: "Terakhir: " + formatWaktuLengkap(terakhir) })),
      el("div", { className: "sisa", textContent: lunas ? "Lunas" : formatRupiah(p.sisa) })
    ),
    tombolBuka,
    buka ? buatDetail(p) : null
  );
}

async function tampilkan() {
  const [pelanggan, barang] = await Promise.all([daftarPelanggan(), daftarBarang()]);

  // Hero: total yang belum dibayar
  const berutang = pelanggan.filter((p) => p.sisa > 0);
  $("k-total").textContent = formatRupiah(berutang.reduce((n, p) => n + p.sisa, 0));
  $("k-jumlah").textContent = berutang.length ? `dari ${berutang.length} pelanggan` : "Tidak ada utang yang belum dibayar";

  // Saran nama, supaya tidak salah eja lalu jadi dua pelanggan
  $("daftar-nama").replaceChildren(...pelanggan.map((p) => el("option", { value: p.nama })));

  // Pilihan barang: hanya yang punya harga jual dan stok
  const pilihanSebelum = $("k-barang").value;
  barangTersedia = barang.filter((b) => b.harga_jual && b.stok > 0).sort((a, b) => a.nama.localeCompare(b.nama));
  $("k-barang").replaceChildren(
    el("option", { value: "", textContent: "Di luar daftar stok" }),
    ...barangTersedia.map((b) => el("option", { value: b.id, textContent: `${b.nama} (${formatRupiah(b.harga_jual)}, stok ${b.stok})` }))
  );
  if (barangTersedia.some((b) => b.id === pilihanSebelum)) $("k-barang").value = pilihanSebelum;
  perbaruiForm();

  if (pelanggan.length === 0) {
    $("daftar-pelanggan").replaceChildren(buatKosong("Belum ada kasbon. Catat utang pelanggan pertamamu di atas."));
    return;
  }
  // Yang masih berutang paling atas (terbesar dulu), yang lunas di bawah
  pelanggan.sort((a, b) => b.sisa - a.sisa || a.nama.localeCompare(b.nama));
  $("daftar-pelanggan").replaceChildren(...pelanggan.map(buatKartu));
}

pasangFormatRupiah($("k-nominal"));
$("k-barang").addEventListener("change", perbaruiForm);
document.querySelectorAll('input[name="k-jenis"]').forEach((r) => r.addEventListener("change", perbaruiForm));
$("k-jumlah-barang").addEventListener("input", perbaruiForm);
$("btn-utang").addEventListener("click", catatBaru);
saatDataBerubah(tampilkan);
tampilkan();
