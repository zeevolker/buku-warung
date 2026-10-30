-- Buku Warung: skema database (Supabase / PostgreSQL)
--
-- Setiap tabel punya kolom yang sama dengan IndexedDB di HP:
--   id                UUID yang dibuat di HP (supaya data bisa dibuat saat offline)
--   user_id           pemilik data; diisi otomatis dari akun yang login
--   created_at        waktu dibuat (milidetik, dari HP)
--   updated_at        waktu terakhir diubah (milidetik, dari HP), untuk memilih versi terbaru
--   deleted           hapus "lunak", supaya penghapusan ikut tersinkron ke HP lain
--   server_updated_at kapan baris ini terakhir berubah DI SERVER; dipakai HP untuk menarik perubahan
--
-- Relasi memakai foreign key gabungan (user_id, id), jadi baris hanya bisa menunjuk ke data
-- milik akun yang sama.

-- ---------- Tabel ----------

create table public.barang (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  nama text not null check (char_length(nama) between 1 and 80),
  harga_jual bigint not null default 0 check (harga_jual >= 0),
  harga_beli bigint not null default 0 check (harga_beli >= 0),
  unique (user_id, id)
);

create table public.pelanggan (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  nama text not null check (char_length(nama) between 1 and 80),
  telepon text not null default '',
  unique (user_id, id)
);

-- Pergerakan stok. Stok sebuah barang = jumlah semua baris ini (tidak disimpan sebagai satu angka).
create table public.stok_mutasi (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  barang_id uuid not null,
  jumlah integer not null,
  alasan text not null check (alasan in ('awal', 'tambah', 'kurang', 'jual', 'kasbon')),
  ref_id uuid, -- transaksi (jual) atau kasbon (kasbon barang) yang menyebabkan mutasi ini
  tanggal date not null,
  foreign key (user_id, barang_id) references public.barang (user_id, id)
);

create table public.kasbon (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  pelanggan_id uuid not null,
  tipe text not null check (tipe in ('utang', 'bayar')),
  nominal bigint not null check (nominal > 0),
  catatan text not null default '',
  tanggal date not null,
  barang_id uuid,          -- diisi kalau utangnya berupa barang
  jumlah integer,
  modal bigint,            -- harga beli x jumlah, untuk menghitung untung
  transaksi_id uuid,       -- uang masuk yang tercatat saat bayar (tanpa FK: dikirim sesudah kasbon)
  unique (user_id, id),
  foreign key (user_id, pelanggan_id) references public.pelanggan (user_id, id),
  foreign key (user_id, barang_id) references public.barang (user_id, id)
);

create table public.transaksi (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  tipe text not null check (tipe in ('masuk', 'keluar')),
  nominal bigint not null check (nominal >= 0),
  catatan text not null default '',
  tanggal date not null,
  sumber text not null default 'manual' check (sumber in ('manual', 'jual', 'bayar_kasbon')),
  barang_id uuid,
  jumlah integer,
  modal bigint,
  kasbon_id uuid,
  pelanggan_id uuid,
  foreign key (user_id, barang_id) references public.barang (user_id, id),
  foreign key (user_id, kasbon_id) references public.kasbon (user_id, id),
  foreign key (user_id, pelanggan_id) references public.pelanggan (user_id, id)
);

-- ---------- Indeks: untuk menarik perubahan dan untuk foreign key ----------

create index barang_tarik on public.barang (user_id, server_updated_at);
create index pelanggan_tarik on public.pelanggan (user_id, server_updated_at);
create index stok_mutasi_tarik on public.stok_mutasi (user_id, server_updated_at);
create index kasbon_tarik on public.kasbon (user_id, server_updated_at);
create index transaksi_tarik on public.transaksi (user_id, server_updated_at);
create index stok_mutasi_barang on public.stok_mutasi (user_id, barang_id);
create index kasbon_pelanggan on public.kasbon (user_id, pelanggan_id);
create index kasbon_barang on public.kasbon (user_id, barang_id) where barang_id is not null;
create index transaksi_barang on public.transaksi (user_id, barang_id) where barang_id is not null;
create index transaksi_kasbon on public.transaksi (user_id, kasbon_id) where kasbon_id is not null;
create index transaksi_pelanggan on public.transaksi (user_id, pelanggan_id) where pelanggan_id is not null;

-- ---------- Trigger: pemilik, waktu server, dan "versi terbaru yang menang" ----------

create or replace function public.bw_sebelum_tulis()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    new.server_updated_at := clock_timestamp();
    return new;
  end if;

  -- UPDATE: kalau versi yang datang lebih lama dari yang tersimpan, abaikan.
  -- Ini terjadi kalau HP yang lama offline mengirim perubahan lama.
  if new.updated_at < old.updated_at then
    return null;
  end if;

  new.id := old.id;
  new.user_id := old.user_id;
  new.created_at := old.created_at;
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger barang_sebelum_tulis before insert or update on public.barang for each row execute function public.bw_sebelum_tulis();
create trigger pelanggan_sebelum_tulis before insert or update on public.pelanggan for each row execute function public.bw_sebelum_tulis();
create trigger stok_mutasi_sebelum_tulis before insert or update on public.stok_mutasi for each row execute function public.bw_sebelum_tulis();
create trigger kasbon_sebelum_tulis before insert or update on public.kasbon for each row execute function public.bw_sebelum_tulis();
create trigger transaksi_sebelum_tulis before insert or update on public.transaksi for each row execute function public.bw_sebelum_tulis();

-- ---------- Row Level Security: tiap akun hanya bisa melihat dan mengubah datanya sendiri ----------
-- Tidak ada izin DELETE: data dihapus dengan menandai deleted = true.

do $$
declare
  t text;
begin
  foreach t in array array['barang', 'pelanggan', 'stok_mutasi', 'kasbon', 'transaksi'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke delete, truncate on public.%I from authenticated', t);
    execute format(
      'create policy "pemilik bisa membaca" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "pemilik bisa menambah" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "pemilik bisa mengubah" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
  end loop;
end;
$$;
