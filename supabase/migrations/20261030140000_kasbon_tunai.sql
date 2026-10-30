-- Kasbon punya jenis: barang (dari stok), lain (barang di luar stok), tunai (pinjam uang dari laci).
-- Pinjaman tunai ikut tercatat sebagai uang keluar dengan sumber 'pinjam_kasbon'.

alter table public.kasbon
  add column jenis text check (jenis in ('barang', 'lain', 'tunai'));

-- Utang yang sudah ada: berupa barang kalau terhubung ke barang, selain itu "lain".
-- updated_at tidak diubah, tapi server_updated_at ikut diperbarui oleh trigger,
-- jadi HP akan menarik kolom jenis yang baru ini.
update public.kasbon
  set jenis = case when barang_id is not null then 'barang' else 'lain' end
  where tipe = 'utang' and jenis is null;

alter table public.transaksi drop constraint transaksi_sumber_check;
alter table public.transaksi
  add constraint transaksi_sumber_check check (sumber in ('manual', 'jual', 'bayar_kasbon', 'pinjam_kasbon'));
