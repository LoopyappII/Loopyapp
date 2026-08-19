"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ShieldCheck, Lock, Server } from "lucide-react";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import PhotoCarousel from "./PhotoCarousel";
import { fadeInUp, staggerContainer, revealOnce } from "@/lib/motion";

const TEAM_PHOTOS = [
  { src: "/images/quienes-somos/team-1.jpg", alt: "El equipo de Loopy reunido, trabajando en conjunto" },
  { src: "/images/quienes-somos/team-2.jpg", alt: "Desarrolladores de Loopy programando en equipo" },
  { src: "/images/quienes-somos/team-3.jpg", alt: "Oficina de Loopy, un espacio abierto y luminoso" },
  { src: "/images/quienes-somos/team-4.jpg", alt: "Reunión de equipo revisando el producto" },
];

const SECURITY_POINTS = [
  { icon: Lock, text: "Tu ubicación viaja cifrada, siempre." },
  { icon: Server, text: "Guardada en servidores cuidados y monitoreados." },
  { icon: ShieldCheck, text: "Nunca se comparte con nadie que no elijas tú." },
];

export default function QuienesSomosContent() {
  return (
    <main className="relative min-h-screen flex flex-col">
      <SiteHeader />

      <section className="max-w-3xl mx-auto w-full px-6 pt-14 pb-4 md:pt-20 text-center">
        <h1 className="text-3xl md:text-4xl font-extrabold text-loopy-900 mb-6">
          Quiénes somos
        </h1>
        <p className="text-lg text-loopy-700 leading-relaxed">
          Loopy es un proyecto de LOOPER CASHLINE SL pensado para que compartir tu
          ubicación sea simple, seguro y bajo tu control. Creemos que cuidar a la
          gente que quieres no debería requerir apps complicadas — por eso
          construimos algo liviano y claro, donde tú decides quién ve qué y por
          cuánto tiempo.
        </p>
      </section>

      <motion.section
        variants={staggerContainer()}
        initial="hidden"
        whileInView="show"
        viewport={revealOnce}
        className="max-w-4xl mx-auto w-full px-6 py-12"
      >
        <motion.p
          variants={fadeInUp}
          className="text-center text-sm font-bold text-bridge uppercase tracking-wide mb-2"
        >
          Así trabajamos
        </motion.p>
        <motion.h2
          variants={fadeInUp}
          className="text-2xl md:text-3xl font-extrabold text-loopy-900 text-center mb-8"
        >
          Un equipo real, todos los días
        </motion.h2>
        <motion.div variants={fadeInUp}>
          <PhotoCarousel slides={TEAM_PHOTOS} />
        </motion.div>
      </motion.section>

      <motion.section
        variants={staggerContainer()}
        initial="hidden"
        whileInView="show"
        viewport={revealOnce}
        className="max-w-5xl mx-auto w-full px-6 py-12"
      >
        <div className="grid md:grid-cols-2 gap-8 md:gap-10 items-center">
          <motion.div
            variants={fadeInUp}
            className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-card border border-loopy-100 order-1 md:order-2"
          >
            <Image
              src="/images/quienes-somos/server.jpg"
              alt="Uno de los servidores donde Loopy guarda tu información de forma segura"
              fill
              className="object-cover"
              sizes="(min-width: 768px) 560px, 100vw"
            />
          </motion.div>

          <motion.div variants={fadeInUp} className="order-2 md:order-1 text-center md:text-left">
            <p className="text-sm font-bold text-bridge uppercase tracking-wide mb-2">
              Seguridad, sin ruido
            </p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-loopy-900 mb-4">
              Tu información, bien resguardada
            </h2>
            <p className="text-loopy-700 leading-relaxed mb-6">
              Detrás de cada Loopy hay un servidor que cuida tus datos con el
              mismo cuidado que le pondrías tú. No hace falta entender de
              tecnología para sentirte tranquilo — nosotros nos encargamos de
              que todo funcione simple, y seguro, todos los días.
            </p>
            <ul className="space-y-3 inline-block text-left">
              {SECURITY_POINTS.map((p) => (
                <li key={p.text} className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-bridge/12 flex items-center justify-center shrink-0">
                    <p.icon size={16} className="text-bridge" />
                  </span>
                  <span className="text-sm text-loopy-700">{p.text}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </motion.section>

      <SiteFooter />
    </main>
  );
}
