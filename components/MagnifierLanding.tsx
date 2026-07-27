"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Users, ShieldCheck, UserPlus, SlidersHorizontal, MapPin } from "lucide-react";
import { NavbarLogo, HatBadge } from "./LoopyLogo";
import LanguageSwitcher from "./LanguageSwitcher";
import HeroGlobe from "./HeroGlobe";
import { EncryptedText } from "./ui/encrypted-text";
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

const GUIDE_STEPS = [
  {
    icon: UserPlus,
    title: "Creá tu Loop",
    body: "Armá un grupo con la gente que quieras: pareja, familia, amigos o quien cuidás.",
  },
  {
    icon: SlidersHorizontal,
    title: "Elegí el modo",
    body: "Espejo para verse todos entre sí, o Supervisión para acompañar sin ser visto.",
  },
  {
    icon: MapPin,
    title: "Compartí y listo",
    body: "La ubicación se actualiza sola. Vos decidís cuándo pausarla o salir del Loop.",
  },
];

export default function MagnifierLanding() {
  return <LandingContent />;
}

function LandingContent() {
  return (
    <main className="relative min-h-screen flex flex-col">
      <div className="w-full bg-bridge/5 border-b border-loopy-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-1.5 text-center">
          <EncryptedText
            text="Bienvenido a Loopy, seguridad para todos."
            className="text-xs sm:text-sm font-medium tracking-wide"
            encryptedClassName="text-loopy-500/40"
            revealedClassName="text-bridge"
            revealDelayMs={45}
            loop
            holdMs={2400}
          />
        </div>
      </div>

      <header className="sticky top-0 z-20 backdrop-blur-md bg-white/70 border-b border-loopy-50">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-4 max-w-6xl mx-auto w-full">
          <NavbarLogo size={30} dark />

          <nav className="hidden md:flex items-center gap-1">
            <a
              href="#productos"
              className="px-3 py-1.5 text-sm text-loopy-700 font-medium hover:text-loopy-900 transition-colors"
            >
              Productos
            </a>
            <a
              href="#quienes-somos"
              className="px-3 py-1.5 text-sm text-loopy-700 font-medium hover:text-loopy-900 transition-colors"
            >
              Quiénes somos
            </a>
            <a
              href="#guia-de-uso"
              className="px-3 py-1.5 text-sm text-loopy-700 font-medium hover:text-loopy-900 transition-colors"
            >
              Guía de uso
            </a>
          </nav>

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
        className="relative overflow-hidden max-w-6xl mx-auto w-full px-6 py-14 md:py-20 lg:min-h-[760px] bg-gradient-to-br from-loopy-900 via-[#1a2150] to-bridge-600"
      >
        {/* Fondo del banner: solo en pantallas grandes, donde sobra ancho a la
            derecha del texto y el globo nunca llega a tocarlo. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -right-28 hidden lg:block lg:w-[760px] lg:h-[760px] xl:w-[840px] xl:h-[840px]"
        >
          <HeroGlobe />
        </div>

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
            Compartí tu{" "}
            <span className="bg-gradient-to-r from-glow-400 via-bridge-400 to-loopy-500 bg-clip-text text-transparent">
              ubicación
            </span>
            , a tu manera
          </motion.h1>
          <motion.p variants={fadeInUp} className="mt-5 text-lg text-white/80 max-w-md">
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

        {/* Pantallas chicas/medianas: no hay ancho para poner el globo al lado
            del texto sin que lo toque, así que pasa a su propio bloque debajo. */}
        <div className="relative mt-10 h-[300px] sm:h-[380px] w-full overflow-hidden rounded-[2rem] lg:hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-16 -right-14 w-[420px] h-[420px] sm:-bottom-20 sm:-right-16 sm:w-[520px] sm:h-[520px]"
          >
            <HeroGlobe />
          </div>
        </div>
      </motion.section>

      <motion.section
        id="productos"
        variants={staggerContainer()}
        initial="hidden"
        whileInView="show"
        viewport={revealOnce}
        className="scroll-mt-24 max-w-5xl mx-auto w-full px-6 pt-14 pb-16 md:pt-20 grid gap-6 md:grid-cols-2"
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

      <section id="quienes-somos" className="scroll-mt-24 max-w-3xl mx-auto w-full px-6 pb-16 text-center">
        <h2 className="text-2xl md:text-3xl font-extrabold text-loopy-900 mb-4">
          Quiénes somos
        </h2>
        <p className="text-lg text-loopy-700 leading-relaxed">
          Loopy es un proyecto de LOOPER CASHLINE SL pensado para que compartir tu
          ubicación sea simple, seguro y bajo tu control. Creemos que cuidar a la
          gente que querés no debería requerir apps complicadas — por eso
          construimos algo liviano y claro, donde vos decidís quién ve qué y por
          cuánto tiempo.
        </p>
      </section>

      <motion.section
        id="guia-de-uso"
        variants={staggerContainer()}
        initial="hidden"
        whileInView="show"
        viewport={revealOnce}
        className="scroll-mt-24 max-w-5xl mx-auto w-full px-6 pb-16 text-center"
      >
        <h2 className="text-2xl md:text-3xl font-extrabold text-loopy-900 mb-10">
          Guía de uso
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {GUIDE_STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              variants={fadeInUp}
              className="bg-white rounded-2xl shadow-card p-6 border border-loopy-100 text-left"
            >
              <div className="w-11 h-11 rounded-xl bg-bridge/12 flex items-center justify-center mb-3">
                <s.icon size={20} className="text-bridge" />
              </div>
              <span className="text-xs font-bold text-bridge uppercase tracking-wide">
                Paso {i + 1}
              </span>
              <h3 className="font-bold text-loopy-900 mt-1 mb-2">{s.title}</h3>
              <p className="text-sm text-loopy-700">{s.body}</p>
            </motion.div>
          ))}
        </div>
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
