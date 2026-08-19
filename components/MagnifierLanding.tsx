"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import HeroGlobe from "./HeroGlobe";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import { fadeInUp, staggerContainer } from "@/lib/motion";

const MotionLink = motion.create(Link);

export default function MagnifierLanding() {
  return <LandingContent />;
}

function LandingContent() {
  return (
    <main className="relative min-h-screen flex flex-col">
      <SiteHeader />

      <section className="relative overflow-hidden w-full bg-gradient-to-br from-loopy-900 via-[#1a2150] to-bridge-600">
        {/* Fondo del banner: solo en pantallas grandes, donde sobra ancho a la
            derecha del texto y el globo nunca llega a tocarlo. Anclado al
            borde real de la sección (full-bleed), no al contenedor angosto
            del texto, para que siempre llegue hasta el borde de la pantalla. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -right-28 hidden lg:block lg:w-[900px] lg:h-[900px] xl:w-[1000px] xl:h-[1000px]"
        >
          <HeroGlobe />
        </div>

        <motion.div
          variants={staggerContainer()}
          initial="hidden"
          animate="show"
          className="relative z-10 max-w-6xl mx-auto w-full px-6 py-14 md:py-20 lg:min-h-[760px]"
        >
          <div className="relative z-10 flex flex-col items-center md:items-start text-center md:text-left">
            <motion.span
              variants={fadeInUp}
              className="mb-4 px-4 py-1 rounded-full text-xs font-semibold tracking-wide uppercase bg-white/10 text-white border border-white/30 shadow-badge"
            >
              Ubicación compartida, sin complicaciones
            </motion.span>
            <motion.h1
              variants={fadeInUp}
              className="text-4xl md:text-5xl font-extrabold text-white max-w-xl leading-tight"
            >
              Comparte tu{" "}
              <span className="bg-gradient-to-r from-glow-400 via-bridge-400 to-loopy-500 bg-clip-text text-transparent">
                ubicación
              </span>
              , a tu manera
            </motion.h1>
            <motion.p variants={fadeInUp} className="mt-5 text-lg text-white/80 max-w-md">
              Crea un Loopy y comparte ubicación entre pares, o supervisa a
              quien más te importa. Tú eliges el modo.
            </motion.p>
            <motion.div variants={fadeInUp} className="mt-8">
              <MotionLink
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                href="/signup"
                className="inline-block px-6 py-3 rounded-full bg-gradient-to-r from-loopy-700 via-bridge to-glow-500 text-white font-semibold text-lg shadow-cta hover:shadow-cta-hover"
              >
                Empezar gratis
              </MotionLink>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="mt-10 inline-flex items-baseline gap-2 bg-white border border-bridge/25 rounded-2xl px-6 py-4 shadow-card"
            >
              <span className="text-bridge font-bold text-sm uppercase tracking-wide">
                Gratis
              </span>
              <span className="text-loopy-700 text-sm">los primeros 2 días</span>
              <span className="text-loopy-700/40">·</span>
              <span className="text-loopy-900 font-extrabold text-2xl">14€</span>
              <span className="text-loopy-700 text-sm">/ mes después</span>
            </motion.div>
          </div>

          {/* Pantallas chicas/medianas: no hay ancho para poner el globo al
              lado del texto sin que lo toque, así que pasa a su propio bloque
              debajo. */}
          <div className="relative mt-10 h-[300px] sm:h-[380px] w-full overflow-hidden rounded-[2rem] lg:hidden">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-16 -right-14 w-[420px] h-[420px] sm:-bottom-20 sm:-right-16 sm:w-[520px] sm:h-[520px]"
            >
              <HeroGlobe />
            </div>
          </div>
        </motion.div>
      </section>

      <SiteFooter />
    </main>
  );
}
