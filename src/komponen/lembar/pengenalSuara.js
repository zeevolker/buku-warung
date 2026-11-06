// pengenalSuara.js: memakai pengenal suara bawaan browser (Web Speech API).
// Hasilnya hanya teks; yang mengartikannya data/suara.js.

import { useEffect, useRef, useState } from "react";

const BATAS_TANPA_RESPONS = 12000; // Safari di iPhone kadang diam saja tanpa hasil dan tanpa galat
const BATAS_SETELAH_BERHENTI = 2000; // kalau browser tidak memberi tanda selesai, pakai teks yang ada

const ambilPengenal = () => globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;

const PESAN_GALAT = {
  "not-allowed": "Izin mikrofon ditolak. Izinkan mikrofon untuk situs ini di pengaturan browser, atau ketik manual.",
  "service-not-allowed": "Pengenal suara belum aktif. Di iPhone, nyalakan Siri atau Dikte di Pengaturan, lalu coba lagi, atau ketik manual.",
  "no-speech": "Suara belum terdengar. Coba lagi lebih dekat ke HP.",
  network: "Pengenal suara butuh internet. Periksa sinyal lalu coba lagi, atau ketik manual.",
  "audio-capture": "Mikrofon tidak ditemukan. Coba lagi atau ketik manual.",
};
const PESAN_DIAM = "Pengenal suara tidak merespons. Pastikan mikrofon tidak sedang dipakai telepon, dan Siri atau Dikte menyala, atau ketik manual.";

// Tombol mikrofon hanya muncul kalau browser mendukung dan sedang online
export function useSuaraTersedia() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const ubah = () => setOnline(navigator.onLine);
    addEventListener("online", ubah);
    addEventListener("offline", ubah);
    return () => {
      removeEventListener("online", ubah);
      removeEventListener("offline", ubah);
    };
  }, []);
  return Boolean(ambilPengenal()) && online;
}

// onSelesai(teks) dipanggil saat ada teks; onGalat(pesan) saat gagal.
// mulai() harus dipanggil langsung dari tombol yang ditekan, karena browser memintanya begitu.
export function usePengenalSuara({ onSelesai, onGalat }) {
  const [teks, setTeks] = useState("");
  const sesiAktif = useRef(null);
  const timer = useRef(null);
  const panggilan = useRef({ onSelesai, onGalat });
  panggilan.current = { onSelesai, onGalat };

  const bersihkan = () => {
    clearTimeout(timer.current);
    sesiAktif.current = null;
  };

  function mulai() {
    const Pengenal = ambilPengenal();
    const sesi = new Pengenal();
    let hasil = "";
    sesi.lang = "id-ID";
    sesi.interimResults = true;
    sesi.continuous = false;
    sesi.onresult = (e) => {
      hasil = Array.from(e.results, (r) => r[0].transcript).join(" ").trim();
      if (sesiAktif.current === sesi) setTeks(hasil);
    };
    sesi.onerror = (e) => {
      if (sesiAktif.current !== sesi) return; // sesi lama yang sudah dibatalkan
      bersihkan();
      // "aborted" berarti dibatalkan, jadi tidak perlu pesan
      if (e.error !== "aborted") panggilan.current.onGalat(PESAN_GALAT[e.error] || `Pengenal suara belum bisa dipakai (${e.error}). Coba lagi atau ketik manual.`);
    };
    sesi.onend = () => {
      if (sesiAktif.current !== sesi) return;
      bersihkan();
      sesi.abort(); // Safari bisa tetap memakai mikrofon setelah selesai
      if (hasil) panggilan.current.onSelesai(hasil);
      else panggilan.current.onGalat(PESAN_GALAT["no-speech"]);
    };

    setTeks("");
    sesiAktif.current = sesi;
    try {
      sesi.start();
    } catch (e) {
      console.error(e);
      bersihkan();
      panggilan.current.onGalat("Pengenal suara belum bisa dipakai. Coba lagi atau ketik manual.");
      return;
    }
    timer.current = setTimeout(() => {
      if (sesiAktif.current !== sesi || hasil) return;
      bersihkan();
      sesi.abort();
      panggilan.current.onGalat(PESAN_DIAM);
    }, BATAS_TANPA_RESPONS);
  }

  function berhenti() {
    const sesi = sesiAktif.current;
    if (!sesi) return;
    sesi.stop(); // hasil terakhir tetap datang, lalu onend
    clearTimeout(timer.current);
    timer.current = setTimeout(() => sesi.onend(), BATAS_SETELAH_BERHENTI);
  }

  function batal() {
    const sesi = sesiAktif.current;
    if (!sesi) return;
    bersihkan();
    sesi.abort();
  }

  useEffect(() => () => {
    clearTimeout(timer.current);
    sesiAktif.current?.abort();
    sesiAktif.current = null;
  }, []);

  return { teks, mulai, berhenti, batal };
}
