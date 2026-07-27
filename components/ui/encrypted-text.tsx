"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

const GLYPHS = "!<>-_\\/[]{}—=+*^?#";
const TICK_MS = 35;
const SCRAMBLE_TICKS = 6;

function randomGlyph() {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
}

interface EncryptedTextProps {
  text: string;
  className?: string;
  encryptedClassName?: string;
  revealedClassName?: string;
  /** Tiempo aproximado (ms) entre la revelación de cada carácter sucesivo. */
  revealDelayMs?: number;
  /** Si es true, la animación arranca recién cuando el texto entra en viewport. */
  startOnView?: boolean;
  /** Si es true, tras revelarse el texto vuelve a cifrarse y repite en bucle. */
  loop?: boolean;
  /** Tiempo (ms) que el texto queda revelado antes de volver a cifrarse, cuando loop=true. */
  holdMs?: number;
}

export function EncryptedText({
  text,
  className = "",
  encryptedClassName = "",
  revealedClassName = "",
  revealDelayMs = 40,
  startOnView = true,
  loop = false,
  holdMs = 2200,
}: EncryptedTextProps) {
  const reduceMotion = useReducedMotion();
  const chars = text.split("");
  const stepTicks = Math.max(1, Math.round(revealDelayMs / TICK_MS));
  const totalTicks = chars.length * stepTicks + SCRAMBLE_TICKS;
  const holdTicks = Math.max(1, Math.round(holdMs / TICK_MS));
  const cycleTicks = totalTicks + holdTicks;

  // El estado inicial NUNCA debe depender de reduceMotion: ese valor solo se
  // conoce con certeza en el cliente (lee window.matchMedia), así que usarlo
  // acá haría que el primer render del cliente difiera del HTML del server
  // cada vez que el usuario tiene activada la preferencia de "reducir
  // movimiento" en su sistema, rompiendo la hidratación de React.
  const [tick, setTick] = useState(0);
  const [started, setStarted] = useState(!startOnView);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Recién en el cliente, después de montar, aplicamos reduceMotion "de golpe".
  useEffect(() => {
    if (reduceMotion) {
      setStarted(true);
      setTick(totalTicks);
    }
  }, [reduceMotion, totalTicks]);

  useEffect(() => {
    if (reduceMotion || !startOnView || started) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduceMotion, startOnView, started]);

  useEffect(() => {
    if (!started || reduceMotion) return;
    if (!loop && tick >= totalTicks) return;
    const id = setTimeout(
      () => setTick((t) => (loop ? (t + 1) % cycleTicks : t + 1)),
      TICK_MS
    );
    return () => clearTimeout(id);
  }, [started, reduceMotion, loop, tick, totalTicks, cycleTicks]);

  return (
    <span ref={ref} className={className} aria-label={text}>
      {chars.map((char, i) => {
        if (char === " ") return <span key={i}> </span>;
        const revealTick = i * stepTicks + SCRAMBLE_TICKS;
        const isRevealed = tick >= revealTick;
        return (
          <span
            key={i}
            aria-hidden="true"
            className={isRevealed ? revealedClassName : encryptedClassName}
          >
            {isRevealed ? char : mounted ? randomGlyph() : GLYPHS[i % GLYPHS.length]}
          </span>
        );
      })}
    </span>
  );
}
