// Catatan.jsx: Pengingat dan Catatan saya. Berdiri sendiri, tidak memengaruhi angka lain.
import { useState } from "react";
import KerangkaLayar from "../../komponen/KerangkaLayar.jsx";
import Geser from "../../komponen/Geser.jsx";
import { usePengingat } from "../../data/pakai.js";
import TabPengingat from "./TabPengingat.jsx";
import TabMemo from "./TabMemo.jsx";

export default function Catatan() {
  const pengingat = usePengingat();
  const [tab, setTab] = useState("pengingat");
  const belum = pengingat.filter((p) => !p.selesai).length;

  return (
    <KerangkaLayar judul="Catatan" kembali="/">
      <Geser
        label="Jenis catatan"
        pilihan={[
          { nilai: "pengingat", label: belum ? `Pengingat · ${belum}` : "Pengingat" },
          { nilai: "memo", label: "Catatan saya" },
        ]}
        nilai={tab}
        onUbah={setTab}
        warna="var(--teks)"
      />
      {tab === "pengingat" ? <TabPengingat daftar={pengingat} /> : <TabMemo />}
    </KerangkaLayar>
  );
}
