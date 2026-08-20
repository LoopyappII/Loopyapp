"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// three + WebGL no existen en el servidor: se carga solo en cliente. Al estar
// detrás de ssr:false no hay riesgo de mismatch de hidratación.
const Globe = dynamic(() => import("./ui/globe"), { ssr: false });

// El procesamiento de las 127 features de tierra (curvas + tubos 3D por
// cada contorno de costa) es pesado y 100% síncrono: sin esperar a que el
// hilo principal esté libre, esto bloquea la página entera por varios
// segundos apenas monta — incluyendo el header y el botón de CTA, que
// deberían quedar interactivos de inmediato. requestIdleCallback deja que
// el resto de la página (header, texto del hero, CTA) pinte y se vuelva
// interactivo primero; el globo (decorativo, aria-hidden) aparece un
// instante después sin competir por el hilo principal.
function useIdle(timeout = 1500) {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(() => setIdle(true), { timeout });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(() => setIdle(true), 200);
    return () => clearTimeout(id);
  }, [timeout]);
  return idle;
}

// MagnifierLanding monta dos <HeroGlobe/> (uno para desktop, oculto por
// CSS en mobile, y otro al revés) para poder darle a cada uno una
// posición/tamaño distinto — pero eso significaba construir el globo 3D
// completo DOS VECES en simultáneo aunque solo uno se vea nunca. Este hook
// deja que cada instancia sepa si le toca existir de verdad.
function useMatchMedia(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

// Paleta de marca (loopy-500, bridge, glow-500) para que los puntos y arcos
// del globo se lean como "puntos Loopy" en vez de los colores por defecto.
const DOT_COLORS = ["#5b6fc4", "#834c9c", "#ec6fc9"];

// Ciudades en los seis continentes: los puntos quedan dispersos por todo el
// mundo en vez de concentrados en una sola región.
const CITIES: { name: string; lat: number; lng: number }[] = [
  { name: "Madrid", lat: 40.4168, lng: -3.7038 },
  { name: "Nueva York", lat: 40.7128, lng: -74.006 },
  { name: "Buenos Aires", lat: -34.6037, lng: -58.3816 },
  { name: "Lagos", lat: 6.5244, lng: 3.3792 },
  { name: "Singapur", lat: 1.3521, lng: 103.8198 },
  { name: "Londres", lat: 51.5074, lng: -0.1278 },
  { name: "Tokio", lat: 35.6762, lng: 139.6503 },
  { name: "París", lat: 48.8566, lng: 2.3522 },
  { name: "Ciudad del Cabo", lat: -33.9249, lng: 18.4241 },
  { name: "Ciudad de México", lat: 19.4326, lng: -99.1332 },
  { name: "Río de Janeiro", lat: -22.9068, lng: -43.1729 },
  { name: "El Cairo", lat: 30.0444, lng: 31.2357 },
  { name: "Bombay", lat: 19.076, lng: 72.8777 },
  { name: "Nairobi", lat: -1.2921, lng: 36.8219 },
  { name: "Dubái", lat: 25.2048, lng: 55.2708 },
  { name: "Seúl", lat: 37.5665, lng: 126.978 },
  { name: "Sídney", lat: -33.8688, lng: 151.2093 },
  { name: "Los Ángeles", lat: 34.0522, lng: -118.2437 },
  { name: "Honolulu", lat: 21.3069, lng: -157.8583 },
  { name: "Bogotá", lat: 4.711, lng: -74.0721 },
  { name: "Berlín", lat: 52.52, lng: 13.405 },
];

const MARKERS = CITIES.map((city, i) => ({
  lat: city.lat,
  lng: city.lng,
  color: DOT_COLORS[i % DOT_COLORS.length],
}));

const cityIndex = (name: string) => CITIES.findIndex((c) => c.name === name);

// Mismos pares que antes conectaba el globo anterior, ahora como índices
// dentro de MARKERS.
const CONNECTION_PAIRS: [number, number][] = [
  ["Madrid", "Nueva York"],
  ["Madrid", "Buenos Aires"],
  ["Madrid", "Lagos"],
  ["Madrid", "Singapur"],
  ["Londres", "Tokio"],
  ["París", "Ciudad del Cabo"],
  ["Ciudad de México", "Río de Janeiro"],
  ["El Cairo", "Bombay"],
  ["Nairobi", "Dubái"],
  ["Seúl", "Sídney"],
  ["Los Ángeles", "Honolulu"],
  ["Bogotá", "Madrid"],
  ["Berlín", "Nairobi"],
  ["Singapur", "Sídney"],
  ["Río de Janeiro", "Lagos"],
  ["Nueva York", "Londres"],
].map(([a, b]) => [cityIndex(a), cityIndex(b)] as [number, number]);

// El globo no vive en una tarjeta: ocupa 100% de su contenedor. Quien lo use
// decide tamaño/posición (distinto en desktop vs. mobile, ver
// MagnifierLanding) — así nunca queda atado a un solo layout. pointer-events-
// none porque es decorativo, no interactivo (si no, el drag para rotar se
// roba el scroll táctil).
export default function HeroGlobe({ mediaQuery }: { mediaQuery?: string }) {
  const idle = useIdle();
  const visible = useMatchMedia(mediaQuery || "all");
  const shouldRender = idle && (!mediaQuery || visible);
  return (
    <div aria-hidden="true" className="pointer-events-none h-full w-full">
      {shouldRender && (
      <Globe
        speed={2}
        smoothing={8}
        direction="left"
        initialLatitude={15}
        initialLongitude={-10}
        scale={7.5}
        detail={8}
        stopOnHover={false}
        oceanColor="#1c2348"
        showOutline
        outlineColor="rgba(228,233,252,0.9)"
        outlineWidth={1.4}
        showGrid={false}
        fill="dots"
        dots={{
          color: "rgba(228,233,252,0.85)",
          size: 4,
          density: 7,
          allDots: false,
        }}
        markerConfig={{ markers: MARKERS, color: DOT_COLORS[0], size: 55 }}
        connections={{
          pairs: CONNECTION_PAIRS,
          colors: DOT_COLORS,
          altitude: 0.22,
          tubeRadius: 0.007,
          cycleDuration: 5,
          activeWindow: 2.4,
          baseOpacity: 0.14,
        }}
      />
      )}
    </div>
  );
}
