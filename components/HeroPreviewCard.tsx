"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Users } from "lucide-react";
import { fadeInUp } from "@/lib/motion";

interface Pin {
  name: string;
  top: string;
  left: string;
  color: string;
}

const PINS: Pin[] = [
  { name: "Vos", top: "38%", left: "28%", color: "#5b6fc4" },
  { name: "Ana", top: "58%", left: "62%", color: "#834c9c" },
  { name: "Leo", top: "22%", left: "68%", color: "#ec6fc9" },
];

export default function HeroPreviewCard() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      variants={fadeInUp}
      animate={
        reduceMotion
          ? undefined
          : { y: [0, -10, 0] }
      }
      transition={
        reduceMotion
          ? undefined
          : { y: { duration: 5, repeat: Infinity, ease: "easeInOut" } }
      }
      className="relative w-full max-w-sm rounded-[2rem] bg-white border border-loopy-100 shadow-card-hover p-4"
    >
      <div className="relative h-64 rounded-2xl overflow-hidden bg-gradient-to-br from-loopy-50 via-white to-bridge/10">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(rgba(91,111,196,0.35) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        />

        {/* Zona segura */}
        <div className="absolute top-[30%] left-[52%] w-28 h-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-bridge/40" />

        {PINS.map((pin) => (
          <div
            key={pin.name}
            className="absolute flex flex-col items-center gap-1 -translate-x-1/2 -translate-y-1/2"
            style={{ top: pin.top, left: pin.left }}
          >
            <span
              className="block w-3.5 h-3.5 rounded-full animate-pulseRing"
              style={{ backgroundColor: pin.color }}
            />
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/90 text-loopy-900 shadow-sm">
              {pin.name}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 px-1">
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        <span className="text-xs text-loopy-700 font-medium flex items-center gap-1">
          <Users size={13} className="text-bridge" />
          3 personas en línea
        </span>
      </div>
    </motion.div>
  );
}
