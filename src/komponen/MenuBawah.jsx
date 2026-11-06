// MenuBawah.jsx: kapsul putih mengambang dengan 4 tab.
import { NavLink } from "react-router";
import Ikon from "./Ikon.jsx";
import gaya from "./MenuBawah.module.css";

const TAB = [
  { ke: "/", nama: "Beranda", ikon: "beranda" },
  { ke: "/laporan", nama: "Laporan", ikon: "laporan" },
  { ke: "/barang", nama: "Barang", ikon: "barang" },
  { ke: "/pelanggan", nama: "Pelanggan", ikon: "pelanggan" },
];

export default function MenuBawah() {
  return (
    <nav className={gaya.menu} aria-label="Menu utama">
      {TAB.map((tab) => (
        <NavLink key={tab.ke} to={tab.ke} end={tab.ke === "/"} className={({ isActive }) => (isActive ? `${gaya.tab} ${gaya.aktif}` : gaya.tab)}>
          <Ikon nama={tab.ikon} />
          {tab.nama}
        </NavLink>
      ))}
    </nav>
  );
}
