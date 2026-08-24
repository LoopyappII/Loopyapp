"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

interface Slide {
  src: string;
  alt: string;
}

function offsetOf(i: number, index: number, n: number) {
  let off = i - index;
  if (off > n / 2) off -= n;
  if (off < -n / 2) off += n;
  return off;
}

function stateForOffset(off: number) {
  if (off === 0) {
    return { x: "0%", z: 0, rotateY: 0, scale: 1, opacity: 1, zIndex: 5 };
  }
  if (Math.abs(off) === 1) {
    return {
      x: off < 0 ? "-78%" : "78%",
      z: -90,
      rotateY: off < 0 ? 38 : -38,
      scale: 0.82,
      opacity: 0.75,
      zIndex: 4,
    };
  }
  return {
    x: off < 0 ? "-130%" : "130%",
    z: -160,
    rotateY: off < 0 ? 45 : -45,
    scale: 0.7,
    opacity: 0,
    zIndex: 1,
  };
}

export default function PhotoCarousel({
  slides,
  intervalMs = 4000,
}: {
  slides: Slide[];
  intervalMs?: number;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = slides.length;

  useEffect(() => {
    if (paused || n <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % n), intervalMs);
    return () => clearInterval(id);
  }, [paused, n, intervalMs]);

  return (
    <div
      className="relative aspect-[4/3] sm:aspect-[16/9] w-full bg-loopy-50 rounded-2xl overflow-hidden"
      style={{ perspective: 1000 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="absolute inset-0" style={{ transformStyle: "preserve-3d" }}>
        {slides.map((s, i) => {
          const off = offsetOf(i, index, n);
          const st = stateForOffset(off);
          return (
            <motion.div
              key={s.src}
              className="absolute inset-y-0 left-[19%] right-[19%] rounded-2xl overflow-hidden shadow-card border border-loopy-100 pointer-events-none"
              animate={{
                x: st.x,
                z: st.z,
                rotateY: st.rotateY,
                scale: st.scale,
                opacity: st.opacity,
              }}
              transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
              style={{ zIndex: st.zIndex }}
            >
              <Image
                src={s.src}
                alt={s.alt}
                fill
                className="object-cover"
                sizes="(min-width: 768px) 460px, 62vw"
                priority={i === 0}
              />
            </motion.div>
          );
        })}
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
        {slides.map((s, i) => (
          <button
            key={s.src}
            onClick={() => setIndex(i)}
            aria-label={`Ver foto ${i + 1}`}
            className={`h-2 rounded-full transition-all ${
              i === index ? "w-6 bg-bridge" : "w-2 bg-loopy-100 hover:bg-bridge/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
