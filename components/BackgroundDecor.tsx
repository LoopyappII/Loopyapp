import { LandingWatermark } from "./LoopyLogo";

// Fondo compartido de toda la app: blanco puro + logo de marca de agua +
// dos blobs sutiles (azul y el tono puente azul/rosa). Se monta una sola
// vez en el layout raíz para que sea idéntico en todas las páginas, en vez
// de repetirse a mano en cada una.
export default function BackgroundDecor() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-white">
      <div className="absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full bg-loopy-500/20 blur-[100px]" />
      <div className="absolute top-1/3 -right-32 w-[480px] h-[480px] rounded-full bg-bridge/16 blur-[110px]" />
      <LandingWatermark className="absolute top-16 left-1/2 -translate-x-1/2 w-[320px] max-w-[70vw] opacity-[0.06] select-none" />
    </div>
  );
}
