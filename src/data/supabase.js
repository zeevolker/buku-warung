// supabase.js: koneksi ke Supabase (database dan login).
//
// Alamat dan kunci dibaca dari file .env (lihat .env.example). Kunci "publishable" memang boleh
// ada di kode frontend: data dijaga oleh Row Level Security, jadi tiap akun hanya bisa membaca
// dan mengubah datanya sendiri. Kalau .env kosong, aplikasi tetap jalan dalam mode tamu.

const URL_SUPABASE = import.meta.env?.VITE_SUPABASE_URL || "";
const KUNCI_SUPABASE = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || "";

let janjiKlien = null;

export const supabaseAktif = () => Boolean(URL_SUPABASE && KUNCI_SUPABASE);

// Library Supabase baru dimuat saat dibutuhkan, supaya halaman pertama tetap ringan
export function ambilKlien() {
  if (!supabaseAktif()) return Promise.resolve(null);
  janjiKlien ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(URL_SUPABASE, KUNCI_SUPABASE, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
    })
  );
  return janjiKlien;
}

// Penghubung yang dipakai sync.js. Dipisah supaya sync.js bisa dites dengan server tiruan.
export function remoteSupabase(klien) {
  return {
    async kirim(tabel, daftar) {
      const { error } = await klien.from(tabel).upsert(daftar, { onConflict: "id" });
      if (error) throw error;
    },
    async ambilSejak(tabel, sejakIso, batas) {
      const { data, error } = await klien.from(tabel).select("*").gte("server_updated_at", sejakIso).order("server_updated_at", { ascending: true }).limit(batas);
      if (error) throw error;
      return data;
    },
  };
}
