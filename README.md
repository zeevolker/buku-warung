# Buku Warung

Aplikasi web pembukuan sederhana untuk warung dan pedagang kaki lima: catat uang masuk dan keluar, lihat untung harian sampai bulanan, dan pantau stok barang. Dibuat dengan HTML, CSS, dan JavaScript murni, tanpa framework.

**Demo:** [isi tautan setelah deploy]

![Tampilan Catat Cepat](screenshots/catat-cepat.png)
<!-- Tambahkan screenshot dari HP. Buat folder screenshots/ lalu simpan gambarnya di sana. -->

## Masalah yang ingin diselesaikan

Banyak pemilik warung dan pedagang kaki lima tidak mencatat keuangan, atau hanya mencatat di buku tulis. Akibatnya mereka sulit tahu untung sebenarnya dan baru sadar barang habis saat pembeli sudah menanyakannya.

[Tambahkan 2-3 kalimat dari hasil wawancaramu: siapa yang kamu tanya, apa kata mereka tentang cara mencatat sekarang.]

## Fitur

- **Catat Cepat:** catat uang masuk dan keluar dengan satu form dan dua tombol besar
- **Ringkasan:** total uang masuk, uang keluar, dan untung untuk hari ini, minggu ini, dan bulan ini
- **Stok Barang:** daftar barang dengan tombol + dan −, serta penanda merah untuk barang yang hampir habis
- Tampilan mobile-first dengan tombol dan tulisan besar
- Bekerja tanpa server dan tanpa akun, data tersimpan di perangkat pengguna

## Teknologi

- HTML, CSS, dan JavaScript (tanpa framework)
- `localStorage` untuk penyimpanan data
- Di-deploy di [GitHub Pages / Netlify]

## Cara menjalankan

1. Unduh atau clone repositori ini
2. Buka `index.html` di browser (atau gunakan ekstensi Live Server di VS Code)

Tidak ada instalasi atau proses build.

## Struktur proyek

```
buku-warung/
├── index.html        Catat Cepat
├── ringkasan.html    Ringkasan harian/mingguan/bulanan
├── stok.html         Stok Barang
├── css/style.css
└── js/
    ├── storage.js    Baca/tulis data (localStorage)
    ├── catat.js
    ├── ringkasan.js
    └── stok.js
```

## Keputusan desain

- **Tanpa framework di versi 1.** Aplikasinya kecil, dan aku ingin menguatkan dasar JavaScript (DOM, event, pengolahan array) sebelum memakai framework.
- **Semua akses data lewat `storage.js`.** Kalau nanti pindah ke database atau backend, hanya file itu yang perlu diubah.
- **Tanggal memakai waktu lokal, bukan UTC.** `toISOString()` memakai UTC, sehingga dini hari di Indonesia tanggalnya bisa mundur sehari.
- **Bahasa sehari-hari.** "Uang Masuk" dan "Uang Keluar", bukan istilah akuntansi.

## Hasil uji ke pengguna

[Isi setelah kamu menguji ke pedagang. Contoh format:]

- Diuji ke [jumlah] pedagang selama [berapa hari]
- Temuan: [apa yang membuat mereka bingung atau berhenti memakai]
- Perubahan yang dibuat karena temuan itu: [ubah apa dan kenapa]

## Keterbatasan saat ini

- Data tersimpan di browser satu perangkat, jadi tidak tersinkron antar HP dan hilang kalau data browser dihapus
- Stok belum berkurang otomatis saat mencatat penjualan
- Belum ada ekspor laporan

## Rencana pengembangan

- [ ] Hubungkan penjualan dengan pengurangan stok
- [ ] Ekspor laporan ke CSV
- [ ] Pencatatan kasbon (utang pelanggan)
- [ ] Cadangan dan sinkronisasi data (backend dan database)
- [ ] Versi dengan framework, setelah kebutuhan dari pengguna jelas