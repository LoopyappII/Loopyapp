"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Home, Heart, HeartHandshake, Briefcase, Users, ShieldCheck } from "lucide-react";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import { fadeInUp, staggerContainer, revealOnce } from "@/lib/motion";

const USE_CASES = [
  {
    icon: Home,
    title: "Familia",
    body: "Sabe que tus hijos llegaron bien al colegio o volvieron a casa, sin tener que preguntar. Zonas seguras, historial del día y un botón SOS a mano para cualquier imprevisto.",
    badgeClass: "bg-loopy-600/15",
    iconClass: "text-loopy-600",
    borderClass: "border-loopy-600/25 hover:border-loopy-600/50",
    shadowClass: "hover:shadow-[0_10px_36px_-6px_rgba(75,88,168,0.45)]",
  },
  {
    icon: Heart,
    title: "Tú y alguien más",
    body: "Comparte tu ubicación en privado, solo entre vosotros: nadie más lo sabe. Para saber que el otro ha llegado bien, coordinar sin dar explicaciones, o simplemente sentiros cerca en la distancia.",
    badgeClass: "bg-glow-500/15",
    iconClass: "text-glow-500",
    borderClass: "border-glow-500/25 hover:border-glow-500/50",
    shadowClass: "hover:shadow-[0_10px_36px_-6px_rgba(236,111,201,0.45)]",
  },
  {
    icon: HeartHandshake,
    title: "Cuidado de mayores",
    body: "Acompaña a un familiar mayor sin invadir su día a día. Modo Supervisión discreto, con alertas y botón de emergencia siempre disponibles.",
    badgeClass: "bg-bridge/15",
    iconClass: "text-bridge",
    borderClass: "border-bridge/25 hover:border-bridge/50",
    shadowClass: "hover:shadow-[0_10px_36px_-6px_rgba(131,76,156,0.45)]",
  },
  {
    icon: Briefcase,
    title: "Empresa / Equipos de trabajo",
    body: "Coordina personal en movimiento — mensajeros, técnicos, vendedores — con visibilidad en tiempo real desde un solo lugar.",
    badgeClass: "bg-bridge-600/15",
    iconClass: "text-bridge-600",
    borderClass: "border-bridge-600/25 hover:border-bridge-600/50",
    shadowClass: "hover:shadow-[0_10px_36px_-6px_rgba(109,63,131,0.45)]",
  },
];

const MODES = [
  {
    icon: Users,
    title: "Modo Espejo",
    body: "Eres el responsable del grupo y ves a todos sus miembros en directo, geolocalizados y sin errores — y ellos también te ven a ti. Ideal para amigos, familia o un viaje compartido.",
  },
  {
    icon: ShieldCheck,
    title: "Modo Supervisión",
    body: "Un supervisor ve la ubicación de quienes acompaña. Ideal para familia, cuidado de mayores o seguridad de personal.",
  },
];

export default function ProductosContent() {
  return (
    <main className="relative min-h-screen flex flex-col">
      <SiteHeader />

      <section className="max-w-3xl mx-auto w-full px-6 pt-14 pb-4 md:pt-20 text-center">
        <h1 className="text-3xl md:text-4xl font-extrabold text-loopy-900 mb-4">
          Productos
        </h1>
        <p className="text-lg text-loopy-700 leading-relaxed">
          Loopy se adapta a cada grupo: elige el caso que más se parece al tuyo.
        </p>
      </section>

      <motion.section
        variants={staggerContainer()}
        initial="hidden"
        whileInView="show"
        viewport={revealOnce}
        className="max-w-5xl mx-auto w-full px-6 py-12"
      >
        <motion.p
          variants={fadeInUp}
          className="text-center text-sm font-bold text-bridge uppercase tracking-wide mb-2"
        >
          Para cada tipo de Loopy
        </motion.p>
        <motion.h2
          variants={fadeInUp}
          className="text-2xl md:text-3xl font-extrabold text-loopy-900 text-center mb-10"
        >
          ¿Para qué creas tu Loopy?
        </motion.h2>

        <div className="grid gap-6 sm:grid-cols-2">
          {USE_CASES.map((c) => (
            <motion.div
              key={c.title}
              variants={fadeInUp}
              className={`bg-white rounded-2xl shadow-card p-6 border-2 ${c.borderClass} ${c.shadowClass} transition-all`}
            >
              <div className={`w-11 h-11 rounded-xl ${c.badgeClass} flex items-center justify-center mb-3`}>
                <c.icon size={20} className={c.iconClass} />
              </div>
              <h3 className="font-bold text-loopy-900 mb-2">{c.title}</h3>
              <p className="text-sm text-loopy-700 leading-relaxed">{c.body}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      <motion.section
        variants={staggerContainer()}
        initial="hidden"
        whileInView="show"
        viewport={revealOnce}
        className="max-w-5xl mx-auto w-full px-6 py-12"
      >
        <motion.p
          variants={fadeInUp}
          className="text-center text-sm font-bold text-bridge uppercase tracking-wide mb-2"
        >
          Cómo funciona
        </motion.p>
        <motion.h2
          variants={fadeInUp}
          className="text-2xl md:text-3xl font-extrabold text-loopy-900 text-center mb-10"
        >
          Todo se configura como tú quieras
        </motion.h2>

        <div className="grid gap-6 md:grid-cols-2">
          {MODES.map((m) => (
            <motion.div
              key={m.title}
              variants={fadeInUp}
              className="bg-gradient-to-r from-loopy-700 via-bridge to-glow-500 rounded-2xl shadow-card p-6 border border-white/20 hover:border-white/40 hover:shadow-card-hover transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center mb-3">
                <m.icon size={20} className="text-white" />
              </div>
              <h3 className="font-bold text-white mb-2">{m.title}</h3>
              <p className="text-sm text-white/80">{m.body}</p>
            </motion.div>
          ))}
        </div>
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
            className="relative w-full max-w-[280px] mx-auto aspect-[390/844] overflow-hidden rounded-[2rem] shadow-card border border-loopy-100"
          >
            <Image
              src="/images/guia-de-uso/mapa.png"
              alt="Pantalla de mapa de Loopy mostrando la ubicación en vivo de los integrantes de un Loopy"
              fill
              className="object-cover"
              sizes="280px"
            />
          </motion.div>

          <motion.div variants={fadeInUp} className="text-center md:text-left">
            <p className="text-sm font-bold text-bridge uppercase tracking-wide mb-2">
              Así se ve
            </p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-loopy-900 mb-4">
              La misma app, para cada caso
            </h2>
            <p className="text-loopy-700 leading-relaxed mb-6">
              Sea cual sea tu Loopy, la experiencia es la misma: simple, clara
              y bajo tu control. Mira todas las funciones en detalle o crea
              tu cuenta y móntalo en un minuto.
            </p>
            <div className="flex flex-wrap justify-center md:justify-start gap-3">
              <Link
                href="/guia-de-uso"
                className="px-5 py-2.5 rounded-full border border-loopy-100 text-loopy-700 font-medium hover:border-bridge/40 hover:text-loopy-900 transition-colors"
              >
                Ver guía de uso
              </Link>
              <Link
                href="/signup"
                className="px-5 py-2.5 rounded-full bg-gradient-to-r from-loopy-700 via-bridge to-glow-500 text-white font-medium shadow-cta hover:shadow-cta-hover transition-shadow"
              >
                Crear cuenta
              </Link>
            </div>
          </motion.div>
        </div>
      </motion.section>

      <SiteFooter />
    </main>
  );
}
