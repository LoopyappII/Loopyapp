"use client";

import { useEffect } from "react";

export default function RegisterSW() {
  useEffect(() => {
    // El service worker solo tiene sentido en producción: en desarrollo
    // termina sirviendo respuestas cacheadas de builds anteriores y genera
    // errores fantasma cada vez que se reinicia el servidor local. Si quedó
    // uno registrado de una sesión de dev previa, lo desregistramos.
    if (process.env.NODE_ENV !== "production") {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker
          .getRegistrations()
          .then((regs) => regs.forEach((reg) => reg.unregister()));
      }
      return;
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // silencioso: si falla el registro, la app sigue funcionando como web normal
      });
    }
  }, []);
  return null;
}
