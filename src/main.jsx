import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { LazyMotion, MotionConfig } from "motion/react";
import App from "./App.jsx";
import "./gaya/variabel.css";
import "./gaya/dasar.css";

// Fitur animasi dimuat terpisah supaya halaman pertama ringan.
// reducedMotion="user": gerakan dimatikan kalau pengguna memintanya di pengaturan HP.
const muatFiturGerak = () => import("./komponen/fiturGerak.js").then((f) => f.domMax);

createRoot(document.getElementById("akar")).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <LazyMotion features={muatFiturGerak} strict>
        <MotionConfig reducedMotion="user">
          <App />
        </MotionConfig>
      </LazyMotion>
    </BrowserRouter>
  </StrictMode>
);
