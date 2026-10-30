// stok.js: halaman Stok Barang.
import { mulaiAplikasi } from "../app.js";
import { pasangKepala } from "../ui/kepala.js";
import { semua } from "../data/db.js";
import { daftarBarang, tambahBarang, ubahStok, hapusBarang, ubahHargaBarang, jualTunai, catatUtang } from "../data/repo.js";
import { formatRupiah } from "../lib/format.js";
import { formatWaktuLengkap } from "../lib/tanggal.js";
import { el, ambilAngka, pasangFormatRupiah, inputRupiah, buatTombolHapus, buatKosong, aman, saatDataBerubah } from "../ui/komponen.js";

// Tunggu pemindahan data lama selesai sebelum menampilkan apa pun
await mulaiAplikasi();
pasangKepala();

export const BATAS_MENIPIS = 5; // stok <= angka ini ditandai merah

const $ = (id) => document.getElementById(id);
const daftarEl = $("daftar-barang");

const panelTerbuka = new Map(); // id barang -> "harga" | "kasbon"
const pesanBarang = new Map(); // id barang -> { teks, galat }
let urutan = []; // urutan id; dibekukan saat menekan + / − supaya kartu tidak pindah tempat

function setPesan(id, teks, galat = false) {
  pesanBarang.clear();
  pesanBarang.set(id, { teks, galat });
}

async function tambah() {
  const pesanEl = $("pesan");
  const jumlahEl = $("jumlah-awal");
  const jumlah = Number(jumlahEl.value);
  if (jumlahEl.value === "" || jumlah < 0 || !Number.isInteger(jumlah)) {
    pesanEl.textContent = "Isi jumlah stok (boleh 0).";
    return jumlahEl.focus();
  }
  const hasil = await aman(() =>
    tambahBarang({ nama: $("nama").value, stok: jumlah, harga_jual: ambilAngka($("harga")), harga_beli: ambilAngka($("harga-beli")) })
  );
  if (hasil.galat) {
    pesanEl.textContent = hasil.galat;
    return $("nama").focus();
  }
  pesanEl.textContent = "";
  $("form-barang").reset();
  $("nama").focus();
  tampilkan();
}

function tombol(teks, kelas, onclick, label) {
  const b = el("button", { type: "button", className: kelas, textContent: teks, onclick });
  if (label) b.setAttribute("aria-label", label);
  return b;
}

function bukaTutup(id, panel) {
  panelTerbuka.get(id) === panel ? panelTerbuka.delete(id) : panelTerbuka.set(id, panel);
  tampilkan(false);
}

function buatKartu(b, namaPelanggan) {
  const menipis = b.stok <= BATAS_MENIPIS;
  const pesan = pesanBarang.get(b.id);
  const panel = panelTerbuka.get(b.id);

  const jumlahEl = el("input", { type: "number", inputMode: "numeric", min: "1", value: "1" });
  jumlahEl.setAttribute("aria-label", "Jumlah: " + b.nama);
  const bacaJumlah = () => Math.floor(Number(jumlahEl.value));

  const hargaTeks =
    (b.harga_jual ? "Jual " + formatRupiah(b.harga_jual) : "Harga jual belum diisi") +
    (b.harga_beli ? " · Modal " + formatRupiah(b.harga_beli).replace(" ", " ") : "");

  const li = el(
    "li",
    { className: "barang" + (menipis ? " menipis" : "") },
    el(
      "div",
      { className: "atas" },
      el("div", {}, el("div", { className: "nama", textContent: b.nama }), el("div", { className: "harga", textContent: hargaTeks })),
      menipis ? el("div", { className: "status", textContent: b.stok === 0 ? "Habis" : "Hampir habis" }) : null
    ),
    el(
      "div",
      { className: "kontrol" },
      tombol("−", "ubah", async () => {
        const h = await aman(() => ubahStok(b.id, -1));
        if (h.galat) setPesan(b.id, h.galat, true);
        tampilkan(false);
      }, `Kurangi stok ${b.nama}`),
      el("span", { className: "jumlah", textContent: b.stok }),
      tombol("+", "ubah", async () => {
        await aman(() => ubahStok(b.id, 1));
        tampilkan(false);
      }, `Tambah stok ${b.nama}`)
    ),
    el(
      "div",
      { className: "baris-jual" },
      jumlahEl,
      Object.assign(
        tombol("Jual", "jual", async () => {
          const n = bacaJumlah();
          const h = await aman(() => jualTunai(b.id, n));
          if (h.galat) {
            setPesan(b.id, h.galat, true);
            if (!b.harga_jual) panelTerbuka.set(b.id, "harga");
          } else setPesan(b.id, `Terjual ${n}: ${formatRupiah(b.harga_jual * n)} dicatat sebagai uang masuk.`);
          tampilkan(false);
        }),
        { disabled: b.stok === 0 }
      ),
      Object.assign(tombol("Kasbon", "btn-kecil kasbon", () => bukaTutup(b.id, "kasbon")), {
        disabled: b.stok === 0,
        ariaExpanded: String(panel === "kasbon"),
      })
    )
  );

  if (pesan) li.append(el("p", { className: "pesan-barang" + (pesan.galat ? " galat" : ""), role: "status", textContent: pesan.teks }));

  // Panel kasbon: jual barang ke pelanggan, dibayar nanti
  if (panel === "kasbon") {
    const listId = "pelanggan-" + b.id;
    const namaEl = el("input", { type: "text", maxLength: 40, autocomplete: "off", placeholder: "Nama pelanggan" });
    namaEl.setAttribute("list", listId);
    namaEl.setAttribute("aria-label", "Nama pelanggan untuk kasbon " + b.nama);
    li.append(
      el(
        "div",
        { className: "panel-harga" },
        el("span", { className: "label-kecil", textContent: "Kasbon ke pelanggan" }),
        namaEl,
        el("datalist", { id: listId }, ...namaPelanggan.map((n) => el("option", { value: n }))),
        tombol("Catat kasbon", "btn-kecil simpan", async () => {
          const n = bacaJumlah();
          const h = await aman(() => catatUtang({ nama: namaEl.value, barangId: b.id, jumlah: n }));
          if (h.galat) setPesan(b.id, h.galat, true);
          else {
            panelTerbuka.delete(b.id);
            setPesan(b.id, `Kasbon ${h.pelanggan.nama}: ${n} ${b.nama}, ${formatRupiah(h.kasbon.nominal)}. Stok sudah dikurangi.`);
          }
          tampilkan(false);
        })
      )
    );
  }

  // Panel ubah harga
  if (panel === "harga") {
    const isiJual = inputRupiah({ nilai: b.harga_jual, label: "Harga jual " + b.nama });
    const isiBeli = inputRupiah({ nilai: b.harga_beli, label: "Harga beli " + b.nama });
    li.append(
      el(
        "div",
        { className: "panel-harga" },
        el(
          "div",
          { className: "baris-input" },
          el("div", {}, el("span", { className: "label-kecil", textContent: "Harga jual (Rp)" }), isiJual),
          el("div", {}, el("span", { className: "label-kecil", textContent: "Harga beli (Rp)" }), isiBeli)
        ),
        tombol("Simpan harga", "btn-kecil simpan", async () => {
          await aman(() => ubahHargaBarang(b.id, { harga_jual: ambilAngka(isiJual), harga_beli: ambilAngka(isiBeli) }));
          panelTerbuka.delete(b.id);
          setPesan(b.id, "Harga disimpan.");
          tampilkan(false);
        })
      )
    );
  }

  li.append(
    el(
      "div",
      { className: "bawah-barang" },
      Object.assign(tombol(panel === "harga" ? "Tutup" : "Ubah harga", "btn-kecil", () => bukaTutup(b.id, "harga")), {
        ariaExpanded: String(panel === "harga"),
      }),
      buatTombolHapus(async () => {
        await aman(() => hapusBarang(b.id));
        tampilkan();
      })
    ),
    el("small", { className: "diubah", textContent: "Terakhir berubah: " + formatWaktuLengkap(b.terakhir) })
  );
  return li;
}

async function tampilkan(urutUlang = true) {
  const [barang, mutasi, pelanggan] = await Promise.all([daftarBarang(), semua("stok_mutasi"), semua("pelanggan")]);
  // Waktu terakhir berubah = perubahan harga/nama atau pergerakan stok terakhir
  const terakhir = new Map();
  for (const m of mutasi) terakhir.set(m.barang_id, Math.max(terakhir.get(m.barang_id) || 0, m.created_at));
  barang.forEach((b) => (b.terakhir = Math.max(b.updated_at, terakhir.get(b.id) || 0)));

  if (barang.length === 0) {
    daftarEl.replaceChildren(buatKosong("Belum ada barang. Tambahkan barang pertamamu di atas."));
    return;
  }
  if (urutUlang || barang.some((b) => !urutan.includes(b.id))) {
    // Yang hampir habis paling atas
    barang.sort((a, b) => a.stok - b.stok || a.nama.localeCompare(b.nama));
    urutan = barang.map((b) => b.id);
  } else {
    barang.sort((a, b) => urutan.indexOf(a.id) - urutan.indexOf(b.id));
  }
  const nama = pelanggan.map((p) => p.nama).sort();
  daftarEl.replaceChildren(...barang.map((b) => buatKartu(b, nama)));
}

pasangFormatRupiah($("harga"));
pasangFormatRupiah($("harga-beli"));
$("btn-tambah").addEventListener("click", tambah);
saatDataBerubah(() => tampilkan(false));
tampilkan();
