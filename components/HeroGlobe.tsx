"use client";

import dynamic from "next/dynamic";
import { useReducedMotion } from "framer-motion";
import type { GlobeConfig } from "./ui/globe";

// three-globe + WebGL no existen en el servidor: se carga solo en cliente.
// Al estar detrás de ssr:false, nada de esto se renderiza durante el SSR,
// así que no hay riesgo de mismatch de hidratación aunque use reduceMotion.
const World = dynamic(() => import("./ui/globe").then((m) => m.World), {
  ssr: false,
});

// Paleta de marca (loopy-500, bridge, glow-500) para que los puntos y arcos
// del globo se lean como "puntos Loopy" en vez del cian/negro por defecto.
const DOT_COLORS = ["#5b6fc4", "#834c9c", "#ec6fc9"];

// Ciudades en los seis continentes: los puntos quedan dispersos por todo el
// mundo en vez de concentrados en una sola región.
const CITY_ARCS: [number, number, number, number, number][] = [
  [40.4168, -3.7038, 40.7128, -74.006, 0.4], // Madrid -> Nueva York
  [40.4168, -3.7038, -34.6037, -58.3816, 0.5], // Madrid -> Buenos Aires
  [40.4168, -3.7038, 6.5244, 3.3792, 0.3], // Madrid -> Lagos
  [40.4168, -3.7038, 1.3521, 103.8198, 0.6], // Madrid -> Singapur
  [51.5074, -0.1278, 35.6762, 139.6503, 0.5], // Londres -> Tokio
  [48.8566, 2.3522, -33.9249, 18.4241, 0.5], // París -> Ciudad del Cabo
  [19.4326, -99.1332, -22.9068, -43.1729, 0.3], // Ciudad de México -> Río
  [30.0444, 31.2357, 19.076, 72.8777, 0.3], // El Cairo -> Bombay
  [-1.2921, 36.8219, 25.2048, 55.2708, 0.3], // Nairobi -> Dubái
  [37.5665, 126.978, -33.8688, 151.2093, 0.4], // Seúl -> Sídney
  [34.0522, -118.2437, 21.3069, -157.8583, 0.3], // Los Ángeles -> Honolulu
  [4.711, -74.0721, 40.4168, -3.7038, 0.4], // Bogotá -> Madrid
  [52.52, 13.405, -1.2921, 36.8219, 0.4], // Berlín -> Nairobi
  [1.3521, 103.8198, -33.8688, 151.2093, 0.3], // Singapur -> Sídney
  [-22.9068, -43.1729, 6.5244, 3.3792, 0.5], // Río -> Lagos
  [40.7128, -74.006, 51.5074, -0.1278, 0.2], // Nueva York -> Londres
];

const GLOBE_DATA = CITY_ARCS.map(
  ([startLat, startLng, endLat, endLng, arcAlt], i) => ({
    order: (i % 6) + 1,
    startLat,
    startLng,
    endLat,
    endLng,
    arcAlt,
    color: DOT_COLORS[i % DOT_COLORS.length],
  }),
);

const BASE_CONFIG: GlobeConfig = {
  pointSize: 2,
  globeColor: "#1c2348",
  showAtmosphere: true,
  atmosphereColor: "#834c9c",
  atmosphereAltitude: 0.24,
  emissive: "#1c2348",
  emissiveIntensity: 0.35,
  shininess: 60,
  // Contorno de continentes casi blanco y bien opaco: contra el navy oscuro
  // del globo resalta claro en vez de perderse en un lavado general.
  polygonColor: "rgba(228,233,252,0.97)",
  ambientLight: "#834c9c",
  directionalLeftLight: "#ec6fc9",
  directionalTopLight: "#f6b8e8",
  pointLight: "#ffffff",
  arcTime: 1400,
  arcLength: 0.9,
  rings: 1,
  maxRings: 3,
  // Arranca mostrando Europa/África: bloque de continente grande y varios
  // puntos loopy (Madrid, Londres, París, Lagos, El Cairo) cerca, en vez del
  // Pacífico vacío que quedaba mirando de entrada.
  initialPosition: { lat: 15, lng: 10 },
};

// El globo no vive en una tarjeta: es puro <World>, sin posicionar. Quien lo
// use decide tamaño/posición del contenedor (distinto en desktop vs. mobile,
// ver MagnifierLanding) — así nunca queda atado a un solo layout que termine
// superponiéndose con el texto. pointer-events-none porque es decorativo, no
// interactivo (si no, el drag para rotar se roba el scroll táctil).
export default function HeroGlobe() {
  const reduceMotion = useReducedMotion();

  return (
    <div aria-hidden="true" className="pointer-events-none h-full w-full">
      <World
        data={GLOBE_DATA}
        globeConfig={{
          ...BASE_CONFIG,
          // Gira siempre (lo pidió explícito el cliente); con reduce-motion
          // solo bajamos la velocidad en vez de apagarlo del todo — es un
          // giro lento y continuo, no el tipo de movimiento que reduce-motion
          // busca evitar.
          autoRotate: true,
          autoRotateSpeed: reduceMotion ? 0.15 : 0.6,
        }}
      />
    </div>
  );
}
