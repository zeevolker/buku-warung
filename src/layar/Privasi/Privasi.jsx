// Privasi.jsx: kebijakan privasi.
import KerangkaLayar from "../../komponen/KerangkaLayar.jsx";
import gaya from "./Privasi.module.css";

export default function Privasi() {
  return (
    <KerangkaLayar judul="Kebijakan Privasi" kembali="/akun">
      <div className={gaya.isi}>
        <p className={gaya.tanggal}>Berlaku sejak 6 November 2026</p>
        <p>Buku Warung adalah aplikasi pembukuan sederhana untuk warung dan pedagang kecil. Halaman ini menjelaskan data apa yang disimpan dan bagaimana data itu dipakai.</p>

        <h2>Tanpa akun</h2>
        <p>Kalau kamu memakai Buku Warung tanpa masuk akun, semua catatan (penjualan, uang keluar, stok, bon pelanggan, pengingat, dan catatan bebas) hanya tersimpan di perangkatmu sendiri. Tidak ada data yang dikirim ke server, kecuali suara saat kamu memakai fitur catat dengan suara (lihat di bawah).</p>

        <h2>Dengan akun</h2>
        <p>Kalau kamu masuk dengan Google atau email, kami menyimpan:</p>
        <ul>
          <li>alamat email dan nama warung;</li>
          <li>catatan yang kamu buat di aplikasi, supaya tersimpan aman dan bisa dibuka di perangkat lain.</li>
        </ul>
        <p>
          Data disimpan di layanan <a href="https://supabase.com">Supabase</a> (server di Singapura). Setiap akun hanya bisa membaca dan mengubah datanya sendiri.
        </p>

        <h2>Catat dengan suara</h2>
        <p>Fitur ini memakai pengenal suara bawaan browser dan hanya berjalan setelah kamu menekan tombol mikrofon. Suara diproses oleh pengenal suara browser; di Chrome, suaramu dikirim ke server Google untuk diubah jadi teks. Aplikasi hanya menerima teksnya dan tidak menyimpan rekaman suara.</p>

        <h2>Yang tidak kami lakukan</h2>
        <ul>
          <li>Tidak menjual atau membagikan datamu kepada pihak lain.</li>
          <li>Tidak memakai datamu untuk iklan.</li>
          <li>Tidak mengakses kontak, foto, atau data lain di perangkatmu.</li>
        </ul>

        <h2>Menghapus data</h2>
        <p>
          Kamu bisa menghapus catatan kapan saja di dalam aplikasi. Untuk menghapus akun beserta seluruh datanya, kirim permintaan lewat <a href="https://github.com/zeevolker/buku-warung/issues">halaman proyek di GitHub</a>.
        </p>

        <h2>Perubahan</h2>
        <p>Kebijakan ini bisa diperbarui seiring perkembangan aplikasi. Tanggal berlaku di atas akan ikut diubah.</p>
      </div>
    </KerangkaLayar>
  );
}
