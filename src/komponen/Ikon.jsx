// Ikon.jsx: ikon garis yang dipakai di banyak tempat.
const GAMBAR = {
  beranda: <path d="M3 11 12 4l9 7v9H3z" />,
  laporan: <path d="M5 20V10M12 20V4M19 20v-7" />,
  barang: (
    <>
      <path d="M4 8l8-4 8 4v8l-8 4-8-4z" />
      <path d="M4 8l8 4 8-4M12 12v8" />
    </>
  ),
  pelanggan: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
    </>
  ),
  panah: <path d="M5 12h14M13 6l6 6-6 6" />,
};

export default function Ikon({ nama, ukuran = 20 }) {
  return (
    <svg
      width={ukuran}
      height={ukuran}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {GAMBAR[nama]}
    </svg>
  );
}
