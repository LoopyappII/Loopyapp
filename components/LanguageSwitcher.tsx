"use client";

// Selector de idioma visual: la página fuente (código, base de datos, textos)
// siempre está en español de España. Este componente solo controla una capa
// de traducción visual (Google Website Translator) para quien prefiera leer
// la landing en otro idioma. No modifica el contenido real de la app.

import { useEffect, useState } from "react";

const LANGS: { code: string; label: string }[] = [
  { code: "es", label: "Español" },
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "zh-CN", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "tr", label: "Türkçe" },
];

const COOKIE_CONSENT_KEY = "loopy-cookie-consent";

declare global {
  interface Window {
    google?: any;
    googleTranslateElementInit?: () => void;
  }
}

export default function LanguageSwitcher() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("es");

  useEffect(() => {
    const match = document.cookie.match(/googtrans=\/es\/([\w-]+)/);
    if (match) setCurrent(match[1]);

    if (document.getElementById("google-translate-script")) return;
    // El traductor no es esencial: solo lo cargamos (y solo entonces setea su
    // cookie googtrans) si el usuario ya aceptó cookies en el banner.
    if (localStorage.getItem(COOKIE_CONSENT_KEY) !== "accepted") return;

    window.googleTranslateElementInit = () => {
      if (!window.google?.translate?.TranslateElement) return;
      // eslint-disable-next-line no-new
      new window.google.translate.TranslateElement(
        { pageLanguage: "es", autoDisplay: false },
        "google_translate_element"
      );
    };

    const script = document.createElement("script");
    script.id = "google-translate-script";
    script.src =
      "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  function changeLanguage(code: string) {
    setOpen(false);
    setCurrent(code);
    const host = window.location.hostname;

    if (code === "es") {
      document.cookie =
        "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${host}`;
    } else {
      document.cookie = `googtrans=/es/${code}; path=/;`;
      document.cookie = `googtrans=/es/${code}; path=/; domain=${host}`;
    }
    window.location.reload();
  }

  const currentLabel = LANGS.find((l) => l.code === current)?.label ?? "Español";

  return (
    <div className="relative notranslate">
      <div id="google_translate_element" className="hidden" />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-loopy-100 text-loopy-700 text-xs font-medium hover:border-glow-500/50 hover:text-loopy-900 transition-colors"
      >
        {currentLabel}
        <span className="text-[10px]">▾</span>
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-[0_8px_28px_rgba(236,111,201,0.25)] border border-loopy-100 overflow-hidden z-50">
            {LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => changeLanguage(l.code)}
                className={`block w-full text-left px-4 py-2 text-sm hover:bg-glow-500/10 transition-colors ${
                  l.code === current
                    ? "text-loopy-900 font-semibold"
                    : "text-loopy-700"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
