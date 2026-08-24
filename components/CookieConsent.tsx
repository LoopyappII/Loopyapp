"use client";

// Banner de consentimiento de cookies. Guarda la elección del usuario en
// localStorage bajo la key COOKIE_CONSENT_KEY con valor "accepted" o
// "rejected". LanguageSwitcher.tsx lee esa misma key/valores para decidir si
// carga el script de Google Translate (y por lo tanto si setea la cookie
// no esencial googtrans). No cambiar la key ni los valores sin actualizar
// también LanguageSwitcher.tsx.

import { useEffect, useState } from "react";
import Link from "next/link";

const COOKIE_CONSENT_KEY = "loopy-cookie-consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (stored !== "accepted" && stored !== "rejected") {
      setVisible(true);
    }
  }, []);

  function choose(value: "accepted" | "rejected") {
    localStorage.setItem(COOKIE_CONSENT_KEY, value);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-loopy-900 text-white shadow-[0_-8px_28px_rgba(35,42,82,0.25)]">
      {/* sm:pr-20 deja hueco para la burbuja fija de SupportChat (bottom-4
          right-4, ~56px) entre sm y lg, único rango donde este banner pasa
          a fila y sus botones quedan pegados al borde derecho. */}
      <div className="max-w-5xl mx-auto px-4 py-4 sm:px-6 sm:py-5 sm:pr-20 lg:pr-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-white/90 leading-relaxed">
          Usamos cookies esenciales para que el inicio de sesión funcione
          correctamente, y una cookie opcional para recordar el idioma de
          traducción que elijas. Puedes aceptarlas o rechazarlas cuando
          quieras.{" "}
          <Link
            href="/privacidad"
            className="underline underline-offset-2 hover:text-glow-400 transition-colors"
          >
            Más información
          </Link>
          .
        </p>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => choose("rejected")}
            className="px-4 py-2 text-sm font-medium text-white/80 border border-white/30 rounded-full hover:text-white hover:border-white/60 transition-colors"
          >
            Rechazar
          </button>
          <button
            type="button"
            onClick={() => choose("accepted")}
            className="px-5 py-2 text-sm rounded-full bg-gradient-to-r from-loopy-700 via-bridge to-glow-500 text-white font-semibold shadow-cta hover:shadow-cta-hover transition-shadow"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
