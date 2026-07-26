"use client";

import { useEffect } from "react";

export default function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // silencioso: si falla el registro, la app sigue funcionando como web normal
      });
    }
  }, []);
  return null;
}
