"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Users, ShieldCheck } from "lucide-react";
import { NavbarLogo, HatBadge } from "./LoopyLogo";
import LanguageSwitcher from "./LanguageSwitcher";
import HeroPreviewCard from "./HeroPreviewCard";
import { fadeInUp, staggerContainer, revealOnce } from "@/lib/motion";

const MotionLink = motion.create(Link);

const FEATURES = [
  {
    icon: Users,
    title: "Modo Espejo",
    body: "Todos los miembros del Loop se ven entre sí. Ideal para pareja, amigos o compartir un viaje.",
  },
  {
    icon: ShieldCheck,
    title: "Modo Supervisión",
    body: "Un supervisor ve la ubicación de quienes acompaña. Ideal para familia, cuidado de mayores o seguridad de personal.",
  },
];

export default function MagnifierLanding() {
  return <LandingContent />;
}

function LandingContent() {
  return (
    <main className="relative min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 backdrop-blur-md bg-white/70 border-b border-loopy-50">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-4 max-w-6xl mx-auto w-full">
          <NavbarLogo size={30} dark />
          <nav className="flex items-center flex-wrap justify-center gap-2 sm:gap-3">
            <LanguageSwitcher />
            <Link
              href="/login"
              className="px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base text-loopy-700 font-medium hover:text-loopy-900 transition-colors"
            >
              Ingresar
            </Link>
            <MotionLink
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              href="/signup"
              className="px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base rounded-full bg-gradient-to-r from-loopy-700 via-bridge to-glow-500 text-white font-medium shadow-cta hover:shadow-cta-hover"
            >
              Crear cuenta
            </MotionLink>
          </nav>
        </div>
      </header>

      <motion.section
        variants={staggerContainer()}
        initial="hidden"
        animate="show"
        className="max-w-6xl mx-auto w-full px-6 py-14 md:py-20 grid md:grid-cols-2 items-center gap-12"
      >
        <div className="flex flex-col items-center md:items-start text-center md:text-left">
          <motion.span
            variants={fadeInUp}
            className="mb-4 px-4 py-1 rounded-full text-xs font-semibold tracking-wide uppercase bg-bridge/10 text-loopy-700 border border-bridge/30 shadow-badge"
          >
            Ubicación compartida, sin complicaciones
          </motion.span>
          <motion.h1
            variants={fadeInUp}
            className="text-4xl md:text-5xl font-extrabold text-loopy-900 max-w-xl leading-tight"
          >
            Compartí tu{" "}
            <span className="bg-gradient-to-r from-loopy-700 via-bridge to-glow-500 bg-clip-text text-transparent">
              ubicación
            </span>
            , a tu manera
          </motion.h1>
          <motion.p variants={fadeInUp} className="mt-5 text-lg text-loopy-700 max-w-md">
            Creá un Loop y compartí ubicación entre pares, o supervisá a quien
            más te importa. Vos elegís el modo.
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

        <motion.div variants={fadeInUp} className="flex justify-center md:justify-end">
          <HeroPreviewCard />
        </motion.div>
      </motion.section>

      <motion.section
        variants={staggerContainer()}
        initial="hidden"
        whileInView="show"
        viewport={revealOnce}
        className="max-w-5xl mx-auto w-full px-6 pb-16 grid gap-6 md:grid-cols-2"
      >
        {FEATURES.map((f) => (
          <motion.div
            key={f.title}
            variants={fadeInUp}
            className="bg-white rounded-2xl shadow-card p-6 border border-loopy-100 hover:border-bridge/40 hover:shadow-card-hover transition-all"
          >
            <div className="w-11 h-11 rounded-xl bg-bridge/12 flex items-center justify-center mb-3">
              <f.icon size={20} className="text-bridge" />
            </div>
            <h3 className="font-bold text-loopy-900 mb-2">{f.title}</h3>
            <p className="text-sm text-loopy-700">{f.body}</p>
          </motion.div>
        ))}
      </motion.section>

      <footer className="flex flex-col items-center gap-2 text-center text-xs text-loopy-700/70 py-8">
        <HatBadge size={40} />
        <span className="font-semibold text-loopy-900 text-sm">Loopy</span>
        <span>LOOPER CASHLINE SL</span>
        <div className="flex gap-3 mt-1">
          <Link href="/privacidad" className="hover:text-loopy-900 transition-colors underline underline-offset-2">
            Política de privacidad
          </Link>
          <span className="text-loopy-700/30">·</span>
          <Link href="/terminos" className="hover:text-loopy-900 transition-colors underline underline-offset-2">
            Términos y condiciones
          </Link>
        </div>
      </footer>
    </main>
  );
}
