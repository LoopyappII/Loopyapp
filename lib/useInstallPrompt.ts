"use client";

// Detección de plataforma + estado del prompt de instalación PWA.
// Toda la lógica no visual vive acá; components/InstallPrompt.tsx solo pinta.
//
// Reglas de visibilidad (todas se tienen que cumplir):
//   - hay algo que ofrecer: se capturó `beforeinstallprompt` (mode "native")
//     o es Safari iOS fuera de standalone (mode "ios")
//   - el banner de cookies ya se resolvió (no apilar dos cosas abajo)
//   - la app no está ya instalada / abierta en standalone
//   - el usuario no eligió "No volver a mostrar" (localStorage, permanente)
//   - no está dentro de la ventana de "Ahora no" / X (localStorage, 7 días)

import { useCallback, useEffect, useRef, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

export type InstallMode = "native" | "ios" | null;

export const PERMANENT_KEY = "loopy-install-dismissed";
export const SNOOZE_KEY = "loopy-install-snooze";
const COOKIE_CONSENT_KEY = "loopy-cookie-consent";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

function readLS(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLS(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Modo privado / almacenamiento deshabilitado: el ocultado queda solo
    // en memoria para esta sesión, que es aceptable.
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  const ua = window.navigator.userAgent || "";
  const iOSDevice = /iphone|ipad|ipod/i.test(ua);
  // iPadOS 13+ se presenta como "MacIntel" con pantalla táctil.
  const iPadOS = window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
  return iOSDevice || iPadOS;
}

function permanentlyDismissed(): boolean {
  return readLS(PERMANENT_KEY) === "forever";
}

function snoozed(): boolean {
  const raw = readLS(SNOOZE_KEY);
  if (!raw) return false;
  const until = Number(raw);
  return Number.isFinite(until) && Date.now() < until;
}

function cookiesResolved(): boolean {
  const v = readLS(COOKIE_CONSENT_KEY);
  return v === "accepted" || v === "rejected";
}

export interface UseInstallPrompt {
  mode: InstallMode;
  visible: boolean;
  promptInstall: () => Promise<void>;
  snooze: () => void;
  dismissForever: () => void;
}

export function useInstallPrompt(): UseInstallPrompt {
  const [mode, setMode] = useState<InstallMode>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);

  // Capturar el evento nativo y reaccionar a la instalación.
  useEffect(() => {
    if (isStandalone() || permanentlyDismissed()) return;

    const w = window as unknown as { __loopyBIP?: BeforeInstallPromptEvent | null };

    // El script `beforeInteractive` de app/layout.tsx ya pudo haber
    // capturado el evento antes de que montara este componente.
    function captureNative() {
      if (w.__loopyBIP) {
        deferredRef.current = w.__loopyBIP;
        setMode("native");
      }
    }
    captureNative();

    function onAppInstalled() {
      deferredRef.current = null;
      writeLS(PERMANENT_KEY, "forever");
      setDismissed(true);
    }

    window.addEventListener("loopy:bip", captureNative);
    window.addEventListener("appinstalled", onAppInstalled);

    // iOS nunca dispara `beforeinstallprompt`: si no llegó en ~1.2s y es un
    // dispositivo iOS, se cae a la guía manual "Añadir a pantalla de inicio".
    let iosTimer: number | undefined;
    if (isIOS()) {
      iosTimer = window.setTimeout(() => {
        if (!deferredRef.current) setMode("ios");
      }, 1200);
    }

    return () => {
      window.removeEventListener("loopy:bip", captureNative);
      window.removeEventListener("appinstalled", onAppInstalled);
      if (iosTimer) window.clearTimeout(iosTimer);
    };
  }, []);

  // Esperar a que el banner de cookies se resuelva antes de abrir la puerta.
  // CookieConsent escribe en localStorage en la misma pestaña, y el evento
  // `storage` no dispara same-tab, así que se sondea (barato: una lectura
  // cada 800ms, se limpia apenas resuelve).
  useEffect(() => {
    if (isStandalone() || permanentlyDismissed() || snoozed()) return;

    if (cookiesResolved()) {
      setGateOpen(true);
      return;
    }
    const id = window.setInterval(() => {
      if (cookiesResolved()) {
        setGateOpen(true);
        window.clearInterval(id);
      }
    }, 800);
    return () => window.clearInterval(id);
  }, []);

  const snooze = useCallback(() => {
    writeLS(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    setDismissed(true);
  }, []);

  const dismissForever = useCallback(() => {
    writeLS(PERMANENT_KEY, "forever");
    setDismissed(true);
  }, []);

  const promptInstall = useCallback(async () => {
    const deferred = deferredRef.current;
    if (!deferred) return;
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferredRef.current = null;
      if (outcome === "accepted") {
        setDismissed(true);
      } else {
        // "dismissed" en el diálogo nativo: lo tratamos como "Ahora no".
        writeLS(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
        setDismissed(true);
      }
    } catch {
      setDismissed(true);
    }
  }, []);

  const visible = mode !== null && gateOpen && !dismissed;

  return { mode, visible, promptInstall, snooze, dismissForever };
}
