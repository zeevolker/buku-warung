-- Buku Warung v3: setiap kejadian disimpan sebagai SATU catatan.
-- Tabel barang dan pelanggan tetap dipakai. Tabel transaksi, kasbon, dan stok_mutasi
-- dari versi 2 tidak dipakai lagi (dibiarkan dulu sebagai arsip).

create table public.catatan (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),

  jenis text not null check (jenis in ('jual', 'keluar', 'bayar', 'stok')),
  tanggal date not null,
  nominal bigint not null default 0 check (nominal >= 0),
  dibayar text check (dibayar in ('sekarang', 'nanti')),          -- untuk jual
  untuk text check (untuk in ('belanja', 'biaya', 'pinjaman')),    -- untuk keluar
  pelanggan_id uuid,                                              -- jual nanti, pinjaman, bayar
  -- Barang yang terlibat: [{ "barang_id", "nama", "jumlah", "harga", "modal" }]
  barang jsonb not null default '[]'::jsonb check (jsonb_typeof(barang) = 'array'),
  keterangan text not null default '',

  foreign key (user_id, pelanggan_id) references public.pelanggan (user_id, id),
  check (jenis <> 'jual' or dibayar is not null),
  check (jenis <> 'keluar' or untuk is not null),
  check (jenis <> 'bayar' or pelanggan_id is not null)
);

create index catatan_tarik on public.catatan (user_id, server_updated_at);
create index catatan_pelanggan on public.catatan (user_id, pelanggan_id) where pelanggan_id is not null;

create trigger catatan_sebelum_tulis before insert or update on public.catatan
  for each row execute function public.bw_sebelum_tulis();

alter table public.catatan enable row level security;
revoke all on public.catatan from anon;
revoke delete, truncate on public.catatan from authenticated;
create policy "pemilik bisa membaca" on public.catatan for select to authenticated using ((select auth.uid()) = user_id);
create policy "pemilik bisa menambah" on public.catatan for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "pemilik bisa mengubah" on public.catatan for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
