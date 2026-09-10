"use client";

// Prompt de instalación PWA. Aparece abajo, con el estilo de marca (vidrio
// translúcido + acento de gradiente Loopy), una vez resuelto el banner de
// cookies. La lógica de detección/persistencia vive en lib/useInstallPrompt.
//
// - Android / Chromium escritorio: botón "Instalar" -> diálogo nativo.
// - Safari iOS: botón "Cómo instalar" -> guía "Añadir a pantalla de inicio".
// - X / "Ahora no": lo silencia 7 días.  "No volver a mostrar": permanente.
// - No se muestra en /login ni /signup, ni si la app ya está instalada.

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowDownToLine, Plus, Share, X } from "lucide-react";
import { easeOut } from "@/lib/motion";
import { useInstallPrompt } from "@/lib/useInstallPrompt";

const AUTH_ROUTES = ["/login", "/signup"];

function LoopMark({ className }: { className?: string }) {
  // Mismo trazo que public/icons/icon-any.svg, en versión chica para el tile.
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="install-loopmark" x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f6b8e8" />
          <stop offset="55%" stopColor="#a06bb8" />
          <stop offset="100%" stopColor="#5b6fc4" />
        </linearGradient>
      </defs>
      <circle
        cx="32"
        cy="32"
        r="21"
        fill="none"
        stroke="url(#install-loopmark)"
        strokeWidth="5"
        strokeDasharray="9 8"
        strokeLinecap="round"
      />
      <circle cx="32" cy="32" r="9" fill="url(#install-loopmark)" />
      <circle cx="32" cy="32" r="3" fill="#232a52" />
    </svg>
  );
}

function IosSteps({ onDone }: { onDone: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[13px] text-loopy-700/80">
      <p className="text-[15px] font-bold leading-snug text-loopy-900">Añádela a tu pantalla de inicio</p>
      <ol className="mt-2 space-y-2">
        <li className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-bridge/10 text-bridge">
            <Share size={14} />
          </span>
          <span>
            Toca <strong className="font-semibold text-loopy-900">Compartir</strong> en la barra del navegador
          </span>
        </li>
        <li className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-bridge/10 text-bridge">
            <Plus size={14} />
          </span>
          <span>
            Elige <strong className="font-semibold text-loopy-900">Añadir a pantalla de inicio</strong>
          </span>
        </li>
      </ol>
      <button
        type="button"
        onClick={onDone}
        className="mt-3 rounded-full bg-gradient-to-r from-loopy-700 via-bridge to-glow-500 px-5 py-2 text-sm font-semibold text-white shadow-cta transition-shadow hover:shadow-cta-hover"
      >
        Entendido
      </button>
    </motion.div>
  );
}

export default function InstallPrompt() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const { mode, visible, promptInstall, snooze, dismissForever } = useInstallPrompt();
  const [showIosSteps, setShowIosSteps] = useState(false);

  const onAuthRoute = AUTH_ROUTES.includes(pathname ?? "");
  const isLoopRoute = pathname?.startsWith("/loop/") ?? false;
  const show = visible && !onAuthRoute;

  const enter = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 24 } };

  function handlePrimary() {
    if (mode === "ios") {
      setShowIosSteps(true);
      return;
    }
    void promptInstall();
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="install-prompt"
          initial={enter.initial}
          animate={enter.animate}
          exit={enter.exit}
          transition={easeOut}
          className={[
            // Franja inferior, encima de BottomTabBar en /loop/* (mismo
            // offset de 4.5rem que usan CookieConsent y SupportChat). La
            // burbuja de SupportChat (z superior, esquina inferior derecha)
            // se solapa con la esquina vacía de la card, igual que con el
            // banner de cookies — es el patrón ya establecido.
            "fixed left-3 right-3 z-50",
            isLoopRoute
              ? "bottom-[calc(4.5rem+env(safe-area-inset-bottom)+0.75rem)]"
              : "bottom-[calc(env(safe-area-inset-bottom)+1rem)]",
            "md:left-4 md:right-auto md:bottom-4",
          ].join(" ")}
        >
          <div
            role="dialog"
            aria-label="Instalar Loopy"
            data-testid="install-prompt"
            className="relative w-full max-w-[440px] overflow-hidden rounded-3xl bg-white/85 shadow-[0_16px_50px_-12px_rgba(35,42,82,0.45)] ring-1 ring-loopy-900/10 backdrop-blur-md md:max-w-sm"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-loopy-500/40 via-bridge-400/30 to-glow-400/40 blur-2xl"
            />
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-loopy-700 via-bridge to-glow-500"
            />

            <button
              type="button"
              onClick={snooze}
              aria-label="Cerrar"
              className="absolute right-2 top-2.5 z-10 rounded-full p-1 text-loopy-700/40 transition-colors hover:text-loopy-700"
            >
              <X size={16} />
            </button>

            <div className="relative flex gap-3 p-4 pr-9">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-loopy-900">
                <LoopMark className="h-6 w-6" />
              </div>

              <div className="min-w-0 flex-1">
                {showIosSteps ? (
                  <IosSteps onDone={snooze} />
                ) : (
                  <>
                    <p className="text-[15px] font-bold leading-snug text-loopy-900">Instala la app de Loopy</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-loopy-700/80">
                      {mode === "ios"
                        ? "Añádela a tu pantalla de inicio para abrirla como una app, a pantalla completa."
                        : "Se abre a pantalla completa y la tienes a un toque en tu inicio. Puedes seguir usándola en el navegador si lo prefieres."}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <motion.button
                        type="button"
                        onClick={handlePrimary}
                        whileHover={reduceMotion ? undefined : { scale: 1.03 }}
                        whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                        className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-loopy-700 via-bridge to-glow-500 px-5 py-2 text-sm font-semibold text-white shadow-cta transition-shadow hover:shadow-cta-hover"
                      >
                        <ArrowDownToLine size={16} />
                        {mode === "ios" ? "Cómo instalar" : "Instalar"}
                      </motion.button>
                      <button
                        type="button"
                        onClick={snooze}
                        className="px-3 py-2 text-sm font-medium text-loopy-700/70 transition-colors hover:text-loopy-900"
                      >
                        Ahora no
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={dismissForever}
                      className="mt-1 text-[12px] text-loopy-700/50 underline underline-offset-2 transition-colors hover:text-loopy-700"
                    >
                      No volver a mostrar
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
