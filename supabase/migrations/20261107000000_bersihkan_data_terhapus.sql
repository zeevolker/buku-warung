-- Pembersihan otomatis: baris yang dihapus pengguna (deleted = true) dihapus permanen setelah 30 hari.
--
-- Aturannya:
--   - Patokan waktunya server_updated_at. Masa tunggu 30 hari supaya penghapusan sempat sampai ke semua HP.
--   - Baris deleted = false tidak pernah disentuh.
--   - Catatan dibersihkan lebih dulu, baru barang dan pelanggan.
--   - Barang dan pelanggan yang masih dipakai baris mana pun yang tersisa tetap disimpan,
--     supaya riwayat dan laporan lama utuh. Sesudah catatannya ikut bersih, baru mereka dibersihkan.
--   - Catatan v4 yang aslinya catatan v3 yang masih aktif tetap disimpan (idnya sama). Lihat komentar
--     di bagian catatan2 di bawah.
--
-- Mencoba sekali secara manual (dari SQL Editor), hasilnya jumlah baris yang dihapus per tabel:
--   select * from public.bersihkan_data_terhapus();
--
-- Mencoba tanpa benar-benar menghapus (jalankan ketiganya sekaligus):
--   begin;
--   select * from public.bersihkan_data_terhapus();
--   rollback;
--
-- Melihat jadwal dan riwayat job:
--   select * from cron.job where jobname = 'bersihkan-data-terhapus';
--   select d.start_time, d.status, d.return_message
--   from cron.job_run_details d
--   join cron.job j on j.jobid = d.jobid
--   where j.jobname = 'bersihkan-data-terhapus'
--   order by d.start_time desc
--   limit 20;

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.bersihkan_data_terhapus()
returns table (nama_tabel text, baris_dihapus bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  batas constant timestamptz := now() - interval '30 days';
  n bigint;
begin
  -- ---------- Arsip v2. Transaksi dulu, karena transaksi menunjuk ke kasbon ----------

  delete from public.transaksi t
  where t.deleted and t.server_updated_at < batas;
  get diagnostics n = row_count;
  nama_tabel := 'transaksi'; baris_dihapus := n; return next;

  delete from public.stok_mutasi s
  where s.deleted and s.server_updated_at < batas;
  get diagnostics n = row_count;
  nama_tabel := 'stok_mutasi'; baris_dihapus := n; return next;

  delete from public.kasbon k
  where k.deleted and k.server_updated_at < batas
    and not exists (select 1 from public.transaksi t where t.user_id = k.user_id and t.kasbon_id = k.id);
  get diagnostics n = row_count;
  nama_tabel := 'kasbon'; baris_dihapus := n; return next;

  -- ---------- Catatan ----------

  delete from public.catatan c
  where c.deleted and c.server_updated_at < batas;
  get diagnostics n = row_count;
  nama_tabel := 'catatan'; baris_dihapus := n; return next;

  -- Catatan v3 yang dipindahkan ke v4 memakai id yang sama, dan HP baru memindahkan ulang arsip v3
  -- yang belum punya pasangan di catatan2. Kalau pasangannya yang sudah dihapus ini ikut dibersihkan
  -- sementara arsipnya masih aktif, catatan itu akan hidup lagi dan isi laci jadi salah.
  delete from public.catatan2 c
  where c.deleted and c.server_updated_at < batas
    and not exists (select 1 from public.catatan v3 where v3.id = c.id and not v3.deleted);
  get diagnostics n = row_count;
  nama_tabel := 'catatan2'; baris_dihapus := n; return next;

  delete from public.pengingat p
  where p.deleted and p.server_updated_at < batas;
  get diagnostics n = row_count;
  nama_tabel := 'pengingat'; baris_dihapus := n; return next;

  delete from public.memo m
  where m.deleted and m.server_updated_at < batas;
  get diagnostics n = row_count;
  nama_tabel := 'memo'; baris_dihapus := n; return next;

  -- ---------- Barang dan pelanggan, sesudah catatan ----------
  -- "Dipakai" berarti disebut baris mana pun yang tersisa, termasuk yang deleted = true
  -- tapi belum 30 hari.

  delete from public.barang b
  where b.deleted and b.server_updated_at < batas
    and not exists (select 1 from public.catatan2 c where c.user_id = b.user_id and c.item @> jsonb_build_array(jsonb_build_object('barang_id', b.id::text)))
    and not exists (select 1 from public.catatan c where c.user_id = b.user_id and c.barang @> jsonb_build_array(jsonb_build_object('barang_id', b.id::text)))
    and not exists (select 1 from public.stok_mutasi s where s.user_id = b.user_id and s.barang_id = b.id)
    and not exists (select 1 from public.kasbon k where k.user_id = b.user_id and k.barang_id = b.id)
    and not exists (select 1 from public.transaksi t where t.user_id = b.user_id and t.barang_id = b.id);
  get diagnostics n = row_count;
  nama_tabel := 'barang'; baris_dihapus := n; return next;

  delete from public.pelanggan p
  where p.deleted and p.server_updated_at < batas
    and not exists (select 1 from public.catatan2 c where c.user_id = p.user_id and c.pelanggan_id = p.id)
    and not exists (select 1 from public.catatan c where c.user_id = p.user_id and c.pelanggan_id = p.id)
    and not exists (select 1 from public.kasbon k where k.user_id = p.user_id and k.pelanggan_id = p.id)
    and not exists (select 1 from public.transaksi t where t.user_id = p.user_id and t.pelanggan_id = p.id);
  get diagnostics n = row_count;
  nama_tabel := 'pelanggan'; baris_dihapus := n; return next;
end;
$$;

-- Fungsi baru bisa dijalankan siapa saja (public), dan Supabase menambah izin untuk perannya sendiri.
-- Semuanya dicabut, supaya tidak bisa dipanggil dari aplikasi. Cron berjalan sebagai pemilik fungsi.
revoke all on function public.bersihkan_data_terhapus() from public, anon, authenticated, service_role;

-- Setiap hari pukul 02.00 WIB (19.00 UTC). Aman dijalankan ulang: job lama dihapus dulu.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'bersihkan-data-terhapus') then
    perform cron.unschedule('bersihkan-data-terhapus');
  end if;
end;
$$;

select cron.schedule('bersihkan-data-terhapus', '0 19 * * *', 'select public.bersihkan_data_terhapus()');
