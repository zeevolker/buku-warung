# Rancangan Buku Warung v4: "Dari → Ke"

Catatan hasil diskusi dan mockup (6 Nov 2026). Dibaca dulu sebelum mengerjakan v4.

Mockup (kanvas desain, 38 layar, status: lengkap): https://claude.ai/artifact/8nHmC87pS5PTLWjuXqJmNd

## 1. Ide utama

Setiap catatan = **uang pindah dari satu tempat ke tempat lain**.

| Tempat | Warna | Arti |
|---|---|---|
| Laci | hijau | uang tunai di warung |
| Bon: [nama] | kuning | uang yang masih dipegang pelanggan |
| Stok | biru | barang di rak, dinilai dengan harga beli |
| Pembeli, Agen, Biaya, Pemilik, Selisih | abu-abu | luar warung |

**Satu rumus untuk semua angka:**

```
isi tempat = total yang masuk KE tempat itu − total yang keluar DARI tempat itu
```

- Isi laci = isi "Laci"; utang Budi = isi "Bon: Budi"; stok = barang masuk − barang keluar.
- Untung = hasil jualan − modal barang yang terjual − biaya.
- Tidak ada angka yang disimpan; menghapus catatan otomatis membatalkan semua akibatnya.

## 2. Semua kejadian

| Kejadian | Dari → Ke | Stok |
|---|---|---|
| Jual tunai | Pembeli → Laci | barang − |
| Jual ngebon | Pembeli → Bon: X | barang − |
| Terima bon | Bon: X → Laci | |
| Pelanggan pinjam uang | Laci → Bon: X | |
| Belanja stok | Laci → Agen | barang + |
| Biaya warung | Laci → Biaya | |
| Uang awal / tambah modal | Pemilik → Laci | |
| Ambil pribadi | Laci → Pemilik | |
| Hitung ulang laci | Laci → Selisih (atau sebaliknya) | |
| Tambah barang, "sudah ada di rak" | Pemilik → Stok | barang + |
| Tambah barang, "baru dibeli" | Laci → Agen | barang + |
| Pelanggan baru dengan bon lama | Pemilik → Bon: X | |
| Koreksi stok (rusak, hilang, dipakai) | Stok → Biaya (jumlah × harga beli) | barang − |
| Belanja melebihi isi laci | Pemilik → Laci (kekurangannya), lalu Laci → Agen | barang + |

## 3. Aturan yang sudah diputuskan

- **Isi laci all time**, tidak reset tiap hari. Yang mulai dari nol tiap hari hanya baris "Hari ini +… · −…" dan Laporan Hari.
- **Uang awal dicatat sekali** saat pertama pakai (langkah 3 tutorial). Laci kosong karena belanja itu wajar, tidak perlu uang awal lagi.
- **Isi laci tidak boleh minus.** Kalau belanja melebihi isi laci, aplikasi bertanya "Laci cuma Rp X. Sisanya Rp Y pakai uang pribadi?" lalu membuat dua catatan.
- **Beda dengan uang fisik** → Hitung ulang, selisihnya dicatat.
- **Harga beli berubah: pakai harga terakhir.** Setiap catatan jual menyimpan modal saat itu (snapshot), jadi untung di catatan lama tidak berubah. Belanja stok memperbarui harga beli barang. Sisa stok lama ikut dihitung harga baru: diterima sebagai risiko pedagang (realistis).
- **Label untung:** "Hasil jualan", "Modal barang yang terjual", "Biaya warung".
- **Menghapus catatan ditolak kalau stok, bon, atau isi laci jadi minus.** Pesan untuk laci: "Tidak bisa dihapus, isi laci akan jadi −Rp X. Pakai Hitung ulang kalau uangnya memang beda." Angka yang sudah minus (misalnya dua HP mencatat saat offline) tetap boleh diperbaiki; yang ditolak hanya penghapusan yang membuatnya makin minus.
- **Harga beli wajib diisi saat menambah barang.** Barang lama yang harga belinya kosong tetap bisa dijual; modalnya dicatat tidak diketahui (`null`).
- **Jualan Lainnya punya kolom "modal" opsional.** Kalau diisi, disimpan sebagai item tanpa `barang_id` (stok tidak berubah, tidak ikut peringkat paling laku). Kalau kosong, dihitung untung penuh, dan fungsi laporan mengembalikan `jualanTanpaModal` supaya bisa ditampilkan sebagai "termasuk Rp X jualan tanpa modal".
- **Item belanja menyimpan harga beli sebelumnya di kolom `modal`,** supaya harga beli barang bisa kembali saat belanjanya dihapus.
- **Koreksi stok ke atas** (barang di rak lebih banyak dari catatan) dicatat Pemilik → Stok.
- **Tambahan teknis yang disetujui:** `@vitejs/plugin-react`, `@testing-library/dom`, `fake-indexeddb`, dan `404.html` (salinan `index.html`, supaya alamat layar bisa dibuka langsung di GitHub Pages).

## 4. Layar (lihat mockup)

- **Mencatat:** Beranda, Jual, Jual · bon, Belanja (Stok | Biaya | Pinjaman), Belanja melebihi laci, Terima bon, Uang laci (Uang awal | Ambil pribadi), Catat dengan suara.
- **Memeriksa:** Rincian catatan (rute + akibat + hapus), Hitung ulang laci.
- **Mengelola:** Barang (cari, filter hampir habis), Tambah barang, Koreksi stok, Pelanggan, detail pelanggan (Terima bon, Ingatkan via WA, riwayat), Akun (status cloud, nama warung, cadangan file, lihat tutorial lagi, privasi, keluar).
- **Catatan:** ikon catatan dengan angka di header Beranda, dua tab:
  - Pengingat: daftar centang dengan tanggal/jam opsional (belum / selesai). Versi gratis: pengingat muncul di dalam aplikasi (angka di ikon + tanda di Beranda saat waktunya tiba), bukan notifikasi push.
  - Catatan saya: kartu catatan bebas (nomor agen, harga grosir, ide jualan, jadwal agen).
  - Berdiri sendiri: tidak memengaruhi laci, stok, bon, atau laporan. Tetap ikut tersimpan ke cloud bersama akun.
- **Laporan** (rumus sama, beda rentang dan pertanyaan):
  - Hari: untung hari ini, isi laci pagi → sekarang, catatan terakhir.
  - Minggu: untung + grafik per hari (terbaik ditandai), isi laci Senin pagi → sekarang dengan Masuk/Keluar, bon awal → sekarang.
  - Bulan: pindah bulan, untung vs bulan lalu (%), grafik per minggu, paling laku, paling untung, biaya, diambil pribadi, bon.
  - Tombol **Unduh** → Excel (semua catatan, tabel) atau PDF (ringkasan). Dibuat di HP: SheetJS dan jsPDF, dimuat hanya saat tombol ditekan.
- **Pertama kali:** (1) Selamat datang + login: Masuk dengan Google, Masuk dengan email, "Coba dulu tanpa akun"; (2) Nama warung; (3) Uang di laci sekarang; (4) Panduan 3 tombol dengan sorotan: Jual → Belanja → Terima bon. Tagline: "Sekali tekan, untung langsung kelihatan." Ikon: buku terbuka + koin kuning di kotak sage.

## 5. Catat dengan suara

- Tombol mikrofon di sebelah tombol Jual. Web Speech API bawaan browser (`id-ID`), gratis, tanpa server.
- Parser aturan buatan sendiri (`src/data/suara.js`, fungsi murni, dites): kata kunci jenis, angka ("10 ribu", "sepuluh ribu", "15rb", "1,5 juta"), jumlah barang, cocokkan nama barang dan pelanggan (toleran salah dengar ringan).
- Hasilnya hanya mengisi lembar yang sesuai; **tidak pernah menyimpan otomatis**.
- Tombol disembunyikan saat offline atau browser tidak mendukung. Halaman privasi perlu menyebut suara diproses server Google (Chrome).

## 6. Gaya visual

- Font Plus Jakarta Sans. Latar #f6f5f1, teks #2b2d2a, kartu putih tanpa garis tepi dengan bayangan halus, sudut bulat 20–30px.
- Utama sage #4f7d65. Laci #e4f0e8 / #3c6b52. Bon #fbecc8 / #6b4c0e. Stok #e6ebf2 / #3d5170. Keluar #f8e7df / #b5583a. Luar #efeee9 / #5d5e58.
- Teks sesedikit mungkin; pilihan memakai tombol geser pendek; rute "dari → ke" hanya muncul sekali di atas tombol Simpan.
- Menu bawah: kapsul putih mengambang (Beranda, Laporan, Barang, Pelanggan). Akun dari avatar.

## 7. Data contoh di mockup (semua saling cocok)

Hari ini Kamis 5 Nov. Isi laci Rp 1.146.000 (pagi Rp 827.000, masuk +404.000, keluar −85.000). Untung hari ini Rp 56.000; minggu ini Rp 224.000 (Sen 58rb, Sel 61rb, Rab 49rb, Kam 56rb). Bon Rp 265.000: Sari 120rb, Budi 53rb, Pak Dedi 52rb, Ibu Rina 40rb.

## 8. Belum dikerjakan

- Sudah ada di mockup (baris "Layar pendukung"): login email, semua riwayat (dari tautan "Semua riwayat" di Beranda dan Laporan Hari; cari + filter Jual/Belanja/Bon/Laci, dikelompokkan per tanggal), tambah pelanggan (nama, nomor WA, bon lama), pengingat WhatsApp (rincian bon otomatis).
- Kondisi khusus sudah ada di mockup: Beranda kosong (ajak tambah barang), status simpan (titik avatar hijau/kuning/merah + pita "3 catatan tersimpan di HP" / "Gagal kirim, Coba lagi"), suara belum paham (contoh kalimat, Ketik manual / Coba lagi), hapus ditolak (stok atau bon jadi minus, arahkan ke Koreksi stok), ajakan simpan ke cloud setelah 10 catatan (Nanti saja).
- Laporan Bulan menampilkan baris "Selisih laci (hitung ulang)".
- Opsional: mode gelap.
- Semua layar utama memakai menu bawah yang sama (ikon + label) dan ikon yang sama di tombol Belanja, Terima bon, Laci.
- Setelah mockup lengkap: prompt untuk Claude Code (migrasi data v3 → v4, skema Supabase baru).

## 9. Arsitektur v4 (diputuskan)

- **React 19 + Vite, satu halaman (SPA)**, tetap di GitHub Pages. Bukan Next.js (tidak perlu server).
- **React Router** untuk pindah layar tanpa memuat ulang; setiap layar dimuat saat dibutuhkan (`lazy`).
- **Motion** (dulu Framer Motion) untuk animasi: transisi antar layar, lembar bawah yang bisa ditarik, daftar yang bergeser halus, angka yang beranimasi. Dipakai dengan `LazyMotion` supaya ringan.
- **CSS Modules + variabel CSS** untuk gaya (warna dari bagian 6 jadi variabel).
- **Dexie.js + `useLiveQuery`** untuk IndexedDB: tampilan otomatis ikut berubah saat data berubah.
- **Logika murni** (`hitung.js`, `suara.js`) terpisah dari React dan dites. Ringkasan isi tempat per hari disimpan lokal (bisa dibangun ulang) supaya tetap cepat walau catatan sudah ribuan.
- **Supabase** tetap untuk akun dan sinkron offline-first.
- **vite-plugin-pwa** untuk service worker dan pemasangan di layar utama.
- **Vitest + Testing Library** untuk tes, **Playwright** untuk alur layar.
- JavaScript (bukan TypeScript), dengan komentar JSDoc seperlunya.
- **Data v3 dipindahkan otomatis** ke format "dari → ke" saat pertama kali membuka v4, dengan tes migrasi.

## 10. Batasan proyek

- Arsitektur tetap gratis: GitHub Pages, Supabase paket gratis, library di browser.
- Hanya publishable key di frontend. Jangan sentuh proyek Supabase lain.
- Commit dan push dilakukan sendiri oleh pemilik proyek.
