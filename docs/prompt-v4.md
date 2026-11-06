# Prompt Claude Code: Buku Warung v4

Cara pakai:
1. Salin `rancangan-v4.md` ke `C:\Dev\Buku Warung\docs\rancangan-v4.md`.
2. Di folder proyek, buat branch baru: `git checkout -b v4`.
3. Jalankan Claude Code di `C:\Dev\Buku Warung`, tempel **satu tahap** setiap kali.
4. Setelah setiap tahap: coba di browser, cek hasilnya, commit sendiri, baru lanjut tahap berikutnya.

---

## Tahap 1: Fondasi dan logika

```text
Kita membangun Buku Warung v4 dari awal dengan React. Baca dulu docs/rancangan-v4.md sampai habis: itu sumber kebenaran untuk logika, layar, warna, dan arsitektur. Kode v3 yang ada (src/, *.html) boleh dibaca sebagai referensi (terutama src/data/sync.js, supabase.js, migrasi.js, cadangan.js), tapi v4 tidak perlu mengikuti strukturnya.

Aku pemula di React, jadi tulis kode yang sederhana dan mudah dibaca: JavaScript (bukan TypeScript), nama variabel dan fungsi berbahasa Indonesia, komponen kecil, komentar singkat di bagian yang tidak jelas.

TAHAP INI: fondasi proyek dan semua logika murni. Belum perlu layar lengkap.

1. Proyek
   - Ubah proyek jadi React 19 + Vite (JavaScript), base "/buku-warung/", tetap bisa di-deploy ke GitHub Pages.
   - Pindahkan file v3 ke folder legacy/ (jangan dihapus) supaya bisa dibaca saat migrasi.
   - Pasang: react-router, motion, dexie, dexie-react-hooks, @supabase/supabase-js, vitest, @testing-library/react, jsdom.
   - Struktur:
     src/data/      (logika murni + database, tanpa React)
     src/komponen/  (komponen tampilan bersama)
     src/layar/     (satu folder per layar)
     src/gaya/      (variabel CSS dan gaya dasar)

2. Gaya dasar
   - src/gaya/variabel.css: semua warna, radius, bayangan, dan font dari bagian 6 rancangan (Plus Jakarta Sans).
   - Pakai CSS Modules untuk gaya tiap komponen.

3. Kerangka tampilan
   - React Router dengan rute untuk semua layar di rancangan; setiap layar boleh berisi judul saja dulu. Layar dimuat dengan lazy().
   - Komponen bersama: MenuBawah (kapsul mengambang, 4 tab dengan ikon + label), Lembar (lembar bawah memakai Motion: muncul dari bawah, bisa ditarik turun untuk menutup), ChipTempat (label tempat berwarna: Laci hijau, Bon kuning, Stok biru, luar abu-abu), Rute ("dari → ke" + nominal).
   - Transisi antar layar dengan Motion (AnimatePresence). Pakai LazyMotion supaya ringan. Hormati prefers-reduced-motion.

4. Database lokal (src/data/db.js, Dexie), nama database "buku-warung-v4"
   - barang: id, nama, harga_jual, harga_beli, batas_hampir_habis
   - pelanggan: id, nama, no_wa
   - catatan: id, waktu, dari, ke, pelanggan_id, nominal, item (array {barang_id, nama, jumlah, harga, modal}), keterangan
       dari/ke berisi salah satu: "laci", "bon", "stok", "pembeli", "agen", "biaya", "pemilik", "selisih". Kalau "bon", pelanggan_id wajib.
       "modal" adalah harga beli per unit SAAT catatan dibuat (snapshot), tidak pernah diubah lagi.
   - pengingat: id, teks, keterangan, waktu_ingat, selesai
   - memo: id, judul, isi, warna
   - meta: kunci, nilai
   - Semua tabel (kecuali meta) punya created_at, updated_at, deleted (hapus lunak), dirty (perlu dikirim ke cloud).

5. Logika murni (src/data/hitung.js), tanpa React dan tanpa database, semuanya dites
   - isiTempat(catatan, tempat, pelangganId?) = total nominal yang ke tempat itu − total nominal yang dari tempat itu.
   - stokBarang(catatan, barangId): stok bertambah kalau ke = "agen" atau ke = "stok"; berkurang kalau dari = "pembeli" atau dari = "stok". Tulis aturan ini di satu fungsi kecil dengan komentar.
   - untung(catatan, rentang) = hasil jualan (dari "pembeli") − modal barang yang terjual (jumlah × modal) − biaya (ke "biaya", termasuk koreksi stok).
   - Fungsi untuk laporan: ringkasan hari, minggu, bulan (sesuai bagian 4 rancangan), untung per hari, per minggu, paling laku, paling untung, arus laci masuk/keluar, bon awal → akhir, selisih laci.
   - Fungsi "bolehDihapus(catatan, semuaCatatan)": tolak kalau sesudah dihapus stok barang mana pun atau bon pelanggan mana pun jadi minus; kembalikan alasannya dalam kalimat untuk pedagang.
   - Fungsi "catatanBelanja(total, isiLaci)": kalau total > isi laci, kembalikan dua catatan (pemilik → laci untuk kekurangannya, lalu laci → agen).
   - Ringkasan per hari (src/data/ringkasan.js): simpan isi laci, bon, dan stok di akhir setiap hari di tabel meta supaya tidak menghitung ulang ribuan catatan. Kalau ada catatan baru/terhapus di tanggal lama, hitung ulang mulai tanggal itu. Hasilnya harus selalu sama dengan menghitung dari nol (buktikan dengan tes).

6. Aksi (src/data/aksi.js): semua yang bisa dilakukan pengguna sebagai fungsi yang menulis ke Dexie: jual (tunai/bon), belanja (stok/biaya/pinjaman, termasuk kasus melebihi laci), terimaBon, uangAwal, ambilPribadi, hitungUlangLaci, tambahBarang (sudah ada di rak → pemilik → stok; baru dibeli → laci → agen), koreksiStok (stok → biaya, nilai = jumlah × harga beli), tambahPelanggan (bon lama → pemilik → bon), hapusCatatan (pakai bolehDihapus). Belanja stok memperbarui harga_beli barang ke harga terakhir.

7. Tes (Vitest): minimal semua contoh angka di bagian 7 rancangan harus keluar persis (isi laci Rp 1.146.000, untung hari ini Rp 56.000, minggu ini Rp 224.000, bon Budi Rp 53.000, dan seterusnya). Buat data contoh itu sebagai fixture yang bisa dipakai ulang.

Selesai kalau: npm test lulus, npm run build berhasil, npm run dev menampilkan kerangka dengan menu bawah dan transisi layar. Jelaskan singkat apa yang dibuat dan cara mencobanya. Jangan commit atau push.
```

---

## Tahap 2: Layar mencatat

```text
Lanjutkan Buku Warung v4. Baca docs/rancangan-v4.md bagian 1–6 dan kode tahap 1. Mockup ada di https://claude.ai/artifact/8nHmC87pS5PTLWjuXqJmNd (kalau tidak bisa dibuka, ikuti deskripsi di rancangan).

TAHAP INI: semua layar untuk mencatat dan memeriksa, tersambung ke aksi.js dan Dexie (pakai useLiveQuery supaya angka langsung berubah).

- Beranda: nama warung, ikon Catatan dengan angka pengingat belum selesai, avatar dengan titik status, kartu "Isi laci" (all time) + kapsul "Hari ini +… / −…" (hijau/terakota), tombol Jual besar + tombol mikrofon (belum berfungsi, tahap 5), tiga tombol Belanja / Terima bon / Laci, strip Bon pelanggan, daftar "Hari ini" (4 terakhir) dengan tautan "Semua riwayat", tampilan kosong untuk pengguna baru.
- Lembar Jual: daftar barang dengan tombol −/+, "+ Barang lain" (cari), jualan tanpa stok (Lainnya), pilihan Tunai | Bon (Bon → pilih pelanggan atau + Baru), Rute di atas tombol Simpan.
- Lembar Belanja: Stok | Biaya | Pinjaman, barang + jumlah, total besar, Rute. Kalau total melebihi isi laci: kotak kuning "Laci cuma Rp X. Sisanya Rp Y pakai uang pribadi?" (Ya, pakai / Ubah jumlah).
- Lembar Terima bon: kartu pelanggan yang punya bon, nominal besar, tombol cepat Lunas, Rute + sisa bon.
- Lembar Laci: Uang awal | Ambil pribadi, nominal, Rute, tautan Hitung ulang.
- Lembar Hitung ulang: menurut catatan, uang sebenarnya, selisih (laci → selisih atau sebaliknya), tombol Cocokkan.
- Lembar Rincian catatan (dibuka saat catatan ditekan): nominal, blok dari → ke, daftar akibat (bon, stok, untung, laci), tombol Hapus yang perlu ditekan dua kali; kalau bolehDihapus menolak, tampilkan kotak alasannya dan matikan tombol.

Animasi (Motion): lembar naik dari bawah, angka Isi laci berubah dengan animasi hitung, catatan baru masuk ke daftar dengan geser halus (layout animation), umpan balik kecil saat Simpan. Jangan berlebihan; semuanya cepat (≤ 250 ms).

Aturan tampilan: teks sesedikit mungkin, input 16px (supaya iPhone tidak zoom), target sentuh ≥ 44px, rupiah pakai titik ribuan, minus pakai "−".

Tambahkan tes komponen untuk alur Jual tunai, Jual bon, dan Hapus ditolak. Selesai kalau npm test dan npm run build lulus. Jelaskan singkat cara mencobanya. Jangan commit atau push.
```

---

## Tahap 3: Mengelola, laporan, catatan

```text
Lanjutkan Buku Warung v4. Baca docs/rancangan-v4.md dan kode tahap 1–2.

TAHAP INI:
- Barang: cari, filter Semua | Hampir habis, stok di kanan (oranye kalau hampir habis), + Tambah. Lembar Tambah/Ubah barang: nama, harga jual, harga beli, stok sekarang, batas hampir habis, "Barangnya dari mana?" Sudah ada di rak | Baru dibeli, Rute. Lembar Koreksi stok: menurut catatan, jumlah sebenarnya, alasan Rusak | Hilang | Dipakai, Rute stok → biaya.
- Pelanggan: total bon, daftar (yang lunas di bawah, abu-abu), + Tambah. Lembar Tambah pelanggan: nama, nomor WA, bon lama. Detail pelanggan: bon besar, tombol Terima bon dan Ingatkan via WA, riwayat. Lembar pengingat WA: pratinjau pesan dengan rincian bon otomatis, Ubah pesan, Kirim lewat WhatsApp (tautan wa.me).
- Semua riwayat: cari, filter Semua | Jual | Belanja | Bon | Laci, dikelompokkan per tanggal dengan jumlah catatan, bisa digulir panjang tanpa lambat (render bertahap).
- Laporan dengan tab Hari | Minggu | Bulan sesuai bagian 4 rancangan, termasuk grafik batang (SVG buatan sendiri, animasi tumbuh saat muncul), hari ke depan yang belum terjadi ditampilkan kosong, tombol pindah bulan, dan baris Selisih laci.
- Unduh laporan: lembar dengan pilihan Excel (semua catatan periode itu dalam tabel) dan PDF (ringkasan siap cetak). Pakai SheetJS dan jsPDF yang dimuat dengan import() hanya saat tombol ditekan. Nama file: buku-warung-[periode].xlsx/pdf.
- Catatan: tab Pengingat (daftar centang, tanggal/jam opsional, yang lewat waktu ditandai, angka di ikon Beranda) dan Catatan saya (kartu memo berwarna, tombol Catatan baru mengambang). Tidak memengaruhi angka lain.

Tes: laporan Hari/Minggu/Bulan dengan fixture tahap 1 harus sama dengan angka di rancangan; isi file Excel yang dihasilkan punya baris sesuai jumlah catatan. Selesai kalau npm test dan npm run build lulus. Jangan commit atau push.
```

---

## Tahap 4: Akun, tutorial, sinkron, migrasi v3

```text
Lanjutkan Buku Warung v4. Baca docs/rancangan-v4.md, kode tahap 1–3, dan kode v3 di legacy/ (sync.js, supabase.js, migrasi.js, cadangan.js, pages/akun.js) serta supabase/migrations/.

TAHAP INI:

1. Supabase (proyek yang sama dengan v3; jangan sentuh proyek lain)
   - Buat file migrasi baru di supabase/migrations/ untuk tabel v4: catatan v4 (pakai nama baru, misalnya catatan2, karena tabel catatan v3 dibiarkan sebagai arsip), pengingat, memo, dan kolom yang perlu ditambah di barang/pelanggan.
   - Pola keamanan sama dengan v3: RLS per pengguna, tanpa izin DELETE (hapus lunak), trigger yang memaksa user_id dan mengisi server_updated_at, foreign key komposit (user_id, id), on delete cascade dari auth.users.
   - Jangan jalankan migrasi ke database; cukup buat filenya. Aku yang akan menerapkannya.

2. Sinkron (src/data/sync.js): pindahkan cara kerja v3 (kirim baris dirty dengan upsert, tarik per tabel memakai server_updated_at dengan tumpang 10 detik, versi terbaru menang) ke Dexie. Jalan otomatis saat online, saat aplikasi dibuka, dan setelah setiap simpan.

3. Akun dan status
   - Login Google (PKCE) dan email + kata sandi (masuk, daftar, lupa kata sandi, buat kata sandi baru). Di iPhone mode layar utama (navigator.standalone) sembunyikan tombol Google. Kalau daftar tapi email sudah terdaftar, arahkan ke Lupa kata sandi (seperti v3).
   - Status simpan di avatar: hijau tersimpan, kuning offline + pita "N catatan tersimpan di HP", merah gagal + pita dengan Coba lagi.
   - Halaman Akun: profil, kartu status + Simpan sekarang, nama warung, cadangan ke file dan pulihkan (format v4, tetap bisa membaca cadangan v1–v3), Lihat tutorial lagi, Kebijakan privasi, Keluar.
   - Mode tamu ("Coba dulu tanpa akun"): semua jalan di HP; setelah 10 catatan muncul lembar ajakan simpan ke cloud (Nanti saja → muncul lagi 20 catatan kemudian). Saat tamu login, data di HP ikut terkirim ke akun.

4. Pertama kali (tutorial): Selamat datang + login, Nama warung, Uang di laci sekarang (dicatat sebagai pemilik → laci), lalu panduan 3 langkah dengan sorotan pada tombol Jual → Belanja → Terima bon (lapisan gelap, tombol yang disorot tetap terlihat, gelembung penjelas, Lewati/Lanjut). Muncul sekali; bisa dibuka lagi dari Akun.

5. Migrasi v3 → v4 (src/data/migrasi.js), berjalan otomatis sekali saat v4 pertama dibuka, juga untuk data yang ditarik dari cloud v3:
   - jual dibayar sekarang → pembeli → laci; jual dibayar nanti → pembeli → bon (pelanggan yang sama)
   - keluar untuk belanja → laci → agen (item ikut, stok bertambah); untuk biaya → laci → biaya; untuk pinjaman → laci → bon
   - bayar → bon → laci
   - koreksi stok v3: tambah → pemilik → stok (nilai = jumlah × harga beli); kurang → stok → biaya
   - barang, pelanggan, id, waktu, dan modal di setiap item dipertahankan apa adanya
   - v3 tidak pernah mencatat uang awal, jadi isi laci hasil migrasi bisa tidak sesuai uang fisik (bahkan minus). Setelah migrasi, tampilkan sekali lembar "Cocokkan isi laci" (memakai Hitung ulang) sebelum mulai.
   - Tes migrasi: data v3 contoh menghasilkan stok, bon, dan untung yang persis sama dengan perhitungan v3 (pakai fungsi v3 di legacy/ sebagai pembanding).

Selesai kalau npm test dan npm run build lulus. Jelaskan langkah yang harus aku lakukan di Supabase (menerapkan migrasi, pengaturan auth) dengan singkat. Jangan commit atau push.
```

---

## Tahap 5: Suara, PWA, rapikan

```text
Lanjutkan Buku Warung v4. Baca docs/rancangan-v4.md bagian 5 dan semua kode sebelumnya.

TAHAP INI:

1. Catat dengan suara
   - src/data/suara.js (fungsi murni): uraikanKalimat(teks, { barang, pelanggan }) → { jenis: "jual"|"belanja"|"biaya"|"terimaBon"|null, bayar: "tunai"|"bon", item[], nominal, pelanggan_id, keterangan }.
     Kata kunci: jual/laku/masuk → jual; belanja/beli/kulakan → belanja; bayar listrik/air/gas/plastik → biaya; bayar utang/bayar bon/nyicil/lunas, atau nama pelanggan + bayar → terimaBon; utang/ngutang/kasbon/bon/nanti pada penjualan → bayar bon.
     Angka: "10000", "10.000", "10rb", "10 ribu", "15k", "1,5 juta", "2 jt", dan kata ("sepuluh ribu", "dua puluh lima ribu", "seribu lima ratus", "seratus", "sejuta", "setengah juta"). Fungsi terpisah: bacaAngka(teks).
     Jumlah barang dari angka/kata sebelum atau sesudah nama barang ("dua indomie", "kopi tiga"), default 1. Cocokkan nama barang/pelanggan tanpa membedakan huruf besar/kecil, toleran salah dengar ringan (contains, lalu jarak Levenshtein ≤ 2 untuk kata ≥ 4 huruf); kalau ragu jangan dicocokkan.
   - Tes minimal 20 kasus, termasuk semua contoh di mockup ("jual dua indomie, satu teh botol", "Budi bayar 20 ribu", "belanja gula 65 ribu", "Sari ngebon kopi") dan kalimat yang tidak dimengerti.
   - Tampilan: tombol mikrofon di Beranda hanya muncul kalau Web Speech API (lang "id-ID") didukung dan sedang online. Lembar "Mendengarkan…" dengan lingkaran yang berdenyut (Motion), teks langsung, contoh kalimat, Selesai. Hasilnya membuka lembar yang sesuai dalam keadaan terisi; JANGAN pernah menyimpan otomatis. Kalau tidak dimengerti: lembar "Belum paham" dengan Ketik manual / Coba lagi. Tangani izin mikrofon ditolak, no-speech, dan network dengan pesan ramah.
   - Halaman privasi: jelaskan bahwa suara diproses oleh pengenal suara bawaan browser (di Chrome dikirim ke server Google), aplikasi hanya menerima teksnya.

2. PWA: vite-plugin-pwa (precache semua aset, bisa dipasang di layar utama, berjalan offline, pembaruan otomatis dengan pemberitahuan kecil "Versi baru tersedia"). Ikon aplikasi: buku terbuka + koin kuning di kotak sage (lihat mockup), buat versi SVG dan PNG 192/512 + apple-touch-icon.

3. Performa: ukur ukuran bundle awal (target ≤ 150 KB gzip untuk layar pertama), pastikan layar jarang dipakai, SheetJS, dan jsPDF tidak masuk bundle awal. Laporkan angkanya.

4. Deploy: perbarui .github/workflows/deploy.yml (npm ci, test, build, deploy ke Pages) untuk proyek React. Kalau tidak bisa menulis file workflow, tampilkan isinya supaya aku buat sendiri.

5. Tes alur dengan Playwright (mode HP): tutorial pertama kali, jual tunai, jual bon, terima bon, belanja melebihi laci, hapus ditolak, laporan, unduh Excel.

6. README: tulis ulang untuk v4 (masalah, cara pakai, ide "dari → ke" + satu rumus, arsitektur, keputusan desain, cara menjalankan, tangkapan layar). Pertahankan bagian yang harus aku isi sendiri (hasil wawancara, hasil uji ke pengguna).

Selesai kalau npm test, tes Playwright, dan npm run build lulus. Beri ringkasan singkat dan daftar hal yang perlu aku cek manual di HP (terutama iPhone Safari). Jangan commit atau push.
```
