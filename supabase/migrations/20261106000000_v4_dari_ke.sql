-- Buku Warung v4: setiap catatan adalah uang yang pindah "dari" satu tempat "ke" tempat lain.
--
-- Tabel catatan v3 dan tabel-tabel versi 2 tidak diubah, dibiarkan sebagai arsip.
-- Tabel barang dan pelanggan dipakai bersama, hanya ditambah kolom baru.
-- Polanya sama dengan v3: RLS per pengguna, tanpa izin DELETE (hapus lunak), trigger
-- bw_sebelum_tulis memaksa user_id dan mengisi server_updated_at, foreign key komposit.

-- ---------- Kolom baru ----------
-- Sengaja boleh kosong (null): HP yang masih memakai v3 mengirim baris tanpa kolom ini bersama
-- baris yang memilikinya, dan kolom yang hilang dikirim sebagai null. Kalau dilarang, sinkron v3 gagal.

alter table public.barang
  add column batas_hampir_habis integer default 5 check (batas_hampir_habis >= 0);

alter table public.pelanggan
  add column no_wa text default '';

-- Nomor yang sudah ada ikut pindah. Trigger memperbarui server_updated_at, jadi HP akan menariknya.
update public.pelanggan set no_wa = telepon where coalesce(telepon, '') <> '';

-- ---------- Tabel baru ----------

create table public.catatan2 (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),

  waktu bigint not null,
  dari text not null check (dari in ('laci', 'bon', 'stok', 'pembeli', 'agen', 'biaya', 'pemilik', 'selisih')),
  ke text not null check (ke in ('laci', 'bon', 'stok', 'pembeli', 'agen', 'biaya', 'pemilik', 'selisih')),
  pelanggan_id uuid,
  nominal bigint not null default 0 check (nominal >= 0),
  -- Barang yang terlibat: [{ "barang_id", "nama", "jumlah", "harga", "modal" }]
  item jsonb not null default '[]'::jsonb check (jsonb_typeof(item) = 'array'),
  keterangan text not null default '',

  foreign key (user_id, pelanggan_id) references public.pelanggan (user_id, id),
  check ((dari <> 'bon' and ke <> 'bon') or pelanggan_id is not null)
);

create table public.pengingat (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),

  teks text not null default '',
  keterangan text not null default '',
  waktu_ingat bigint,
  selesai boolean not null default false
);

create table public.memo (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),

  judul text not null default '',
  isi text not null default '',
  warna text not null default 'putih'
);

create index catatan2_tarik on public.catatan2 (user_id, server_updated_at);
create index catatan2_pelanggan on public.catatan2 (user_id, pelanggan_id) where pelanggan_id is not null;
create index pengingat_tarik on public.pengingat (user_id, server_updated_at);
create index memo_tarik on public.memo (user_id, server_updated_at);

-- ---------- Trigger dan Row Level Security ----------

do $$
declare
  t text;
begin
  foreach t in array array['catatan2', 'pengingat', 'memo'] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.bw_sebelum_tulis()', t || '_sebelum_tulis', t);
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
