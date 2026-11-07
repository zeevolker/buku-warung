# Prompt Claude Code: PDF laporan baru

```text
Ganti PDF laporan yang sekarang (terlalu sederhana) dengan desain baru. Baca dulu docs/rancangan-v4.md, src/data/hitung.js, src/data/unduh.js, dan layar Laporan.

CARA MEMBUAT PDF
- Jangan gambar PDF dengan jsPDF. Buat halaman cetak React di rute /cetak/:periode/:tanggal (periode = hari | minggu | bulan) yang berisi halaman-halaman A4 (794×1123 px), lalu panggil window.print() setelah font dan data siap. Pengguna memilih "Simpan sebagai PDF" di dialog cetak bawaan browser (Android Chrome dan iPhone Safari bisa).
- CSS cetak: @page { size: A4; margin: 0 }, setiap halaman page-break-after: always, warna tetap tercetak (print-color-adjust: exact), sembunyikan semua yang bukan halaman laporan.
- Set document.title sebelum mencetak supaya nama file otomatis, misalnya "Buku Warung - Mingguan 2-8 Nov 2026".
- Tombol PDF di lembar Unduh membuka rute ini. Hapus jsPDF dari proyek kalau sudah tidak dipakai. Excel (SheetJS) tetap seperti sekarang.
- Halaman cetak dimuat dengan lazy() supaya tidak memperberat aplikasi.

GAYA (sama untuk ketiga laporan)
- Kertas putih, font Plus Jakarta Sans, margin 48px atas, 56px kiri-kanan, 40px bawah. Tidak ada teks lebih kecil dari 12px; teks abu-abu tidak lebih terang dari #6e706a; garis tabel minimal 1px; tetap terbaca kalau dicetak hitam putih.
- Kop halaman 1: ikon aplikasi (buku terbuka + koin kuning di kotak sage #4f7d65), label kecil "BUKU WARUNG · LAPORAN HARIAN/MINGGUAN/BULANAN", nama warung besar, periode, dan di kanan: waktu dicetak, keterangan (data sampai saat dicetak / bulan sudah selesai), jumlah catatan. Garis bawah sage 2px.
- Kop halaman berikutnya: satu baris "Nama warung · Laporan …" + periode.
- Kaki setiap halaman: "Dibuat otomatis oleh Buku Warung · zeevolker.github.io/buku-warung" dan "Halaman X dari Y".
- 4 kartu angka utama di halaman 1: "Rp" kecil (12px) dan nominal (18px, tebal) dalam satu baris, tidak boleh patah (white-space: nowrap). Kartu untung berlatar hijau muda, kartu bon berlatar kuning muda.
- Bilah "Dari mana untungnya": satu bilah bertumpuk (modal abu-abu, biaya terakota muda, untung sage) + 4 angka di bawahnya: Hasil jualan, − Modal barang terjual, − Biaya warung, = Untung bersih.
- Angka rata kanan dengan tabular-nums; uang masuk hijau (#3c7a57), keluar terakota (#a14d31); baris total bergaris atas 2px dan tebal.

LAPORAN HARIAN (fokus: ada yang salah catat?)
Halaman 1: kartu (Untung bersih + persen dari jualan; Hasil jualan + rincian tunai/bon; Isi laci sekarang + isi pagi; Bon pelanggan + baru/dibayar hari ini), bilah untung, lalu dua kolom: "Arus uang laci" (isi pagi, jualan tunai, bon dibayar, belanja agen, biaya, uang awal/ambil pribadi/selisih kalau ada, isi sekarang) dan "Barang terjual" (barang, jumlah, jualan, total). Kotak "Cek cepat: hitung uang di laci sekarang. Kalau tidak sama dengan Rp X, periksa daftar catatan atau pakai Hitung ulang."
Halaman 2 dan seterusnya: tabel semua catatan hari itu (jam, catatan, "Dari → Ke", nominal bertanda +/−), baris yang menyangkut bon berlatar kuning muda, legenda di bawahnya. Kalau catatan banyak, lanjut otomatis ke halaman berikutnya (hitung baris per halaman, jangan biarkan terpotong).

LAPORAN MINGGUAN (fokus: hari apa paling ramai?)
Halaman 1: kartu (Untung bersih + rata-rata per hari; Hasil jualan + persen untung; Isi laci sekarang + naik/turun; Bon + jumlah orang), bilah untung, grafik batang untung per hari Sen–Min dengan angka di atas batang (hari terbaik sage tua, hari yang belum terjadi berupa garis tipis dan "–"), hasil jualan per hari di bawah nama hari, lalu tabel "Arus uang laci" dari Senin pagi sampai sekarang.
Halaman 2: "Barang terlaris" (5 teratas + "Barang lain (n jenis)" + total; kolom terjual, hasil jualan, untung; catatan bahwa untung per barang belum dikurangi biaya, dan barang paling menguntungkan), "Bon pelanggan" per orang (awal minggu, tambah, bayar, sisa, total), dua kotak berdampingan "Stok perlu dibeli" (barang di bawah batas hampir habis) dan "Catatan minggu ini" (selisih laci, barang rusak/hilang, jualan tanpa modal), lalu kotak "Cara membaca".

LAPORAN BULANAN (fokus: naik atau turun, apa yang laku?)
Halaman 1: kartu (Untung bersih + "↑/↓ x% dari bulan lalu"; Hasil jualan + persen untung; Isi laci akhir bulan + naik/turun; Bon + naik/turun), bilah untung, grafik untung per minggu (rentang tanggal 1–7, 8–14, 15–21, 22–akhir), tabel "Arus uang laci" sebulan (termasuk ambil pribadi, pinjaman, selisih).
Halaman 2: "Barang terlaris" (seperti mingguan, plus kalimat paling laku dan paling menguntungkan), dua kolom: "Kalender untung" (grid Sen–Min, warna 4 tingkat dari kuartil untung harian, legenda Sedikit–Banyak, kalimat hari terbaik) dan "Bon pelanggan" per orang (yang sisa 0 ditulis "Lunas"), kotak "Perlu diperhatikan" (3 angka kecil: selisih laci, barang rusak/hilang, jualan tanpa modal) dan "Cara membaca".

DATA
Tambahkan fungsi murni yang belum ada di src/data/laporan.js (atau hitung.js): ringkasan per barang (terjual, jualan, untung), bon per pelanggan dalam periode (awal, tambah termasuk pinjaman, bayar, sisa), perbandingan dengan periode sebelumnya dalam persen, tingkat warna kalender (kuartil), total barang rusak/hilang, jualan tanpa modal, selisih laci, stok di bawah batas. Semua angka di PDF harus berasal dari fungsi yang sama dengan layar Laporan, supaya selalu sama.

TES
- Fungsi laporan baru dites dengan fixture yang ada: total barang terlaris = hasil jualan; total bon per pelanggan = bon awal/akhir; arus laci awal + masuk − keluar = akhir.
- Tes komponen: halaman harian dengan 60 catatan terbagi ke beberapa halaman tanpa baris hilang, dan nomor "Halaman X dari Y" benar.

Catat di docs/rancangan-v4.md bahwa PDF dibuat dari halaman cetak + dialog cetak browser. Selesai kalau npm test dan npm run build lulus. Jelaskan cara mencobanya di HP (Android dan iPhone). Jangan commit atau push.
```
