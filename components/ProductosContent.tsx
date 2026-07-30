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
    body: "Sabé que tus hijos llegaron bien al colegio o volvieron a casa, sin tener que preguntar. Zonas seguras, historial del día y un botón SOS a mano para cualquier imprevisto.",
  },
  {
    icon: Heart,
    title: "Pareja",
    body: "Compartan la ubicación en Modo Espejo: los dos se ven, sin jerarquías. Para viajes, salidas o simplemente sentirse acompañados a la distancia.",
  },
  {
    icon: HeartHandshake,
    title: "Cuidado de mayores",
    body: "Acompañá a un familiar mayor sin invadir su día a día. Modo Supervisión discreto, con alertas y botón de emergencia siempre disponibles.",
  },
  {
    icon: Briefcase,
    title: "Equipos de trabajo",
    body: "Coordiná personal en movimiento — cadetes, técnicos, vendedores — con visibilidad en tiempo real desde un solo lugar.",
  },
];

const MODES = [
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

export default function ProductosContent() {
  return (
    <main className="relative min-h-screen flex flex-col">
      <SiteHeader />

      <section className="max-w-3xl mx-auto w-full px-6 pt-14 pb-4 md:pt-20 text-center">
        <h1 className="text-3xl md:text-4xl font-extrabold text-loopy-900 mb-4">
          Productos
        </h1>
        <p className="text-lg text-loopy-700 leading-relaxed">
          Loopy se adapta a cada Loop: elegí el caso que más se parece al tuyo.
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
          Para cada tipo de Loop
        </motion.p>
        <motion.h2
          variants={fadeInUp}
          className="text-2xl md:text-3xl font-extrabold text-loopy-900 text-center mb-10"
        >
          ¿Para qué armás tu Loop?
        </motion.h2>

        <div className="grid gap-6 sm:grid-cols-2">
          {USE_CASES.map((c) => (
            <motion.div
              key={c.title}
              variants={fadeInUp}
              className="bg-white rounded-2xl shadow-card p-6 border border-loopy-100 hover:border-bridge/40 hover:shadow-card-hover transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-bridge/12 flex items-center justify-center mb-3">
                <c.icon size={20} className="text-bridge" />
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
          Todo se arma con dos modos
        </motion.h2>

        <div className="grid gap-6 md:grid-cols-2">
          {MODES.map((m) => (
            <motion.div
              key={m.title}
              variants={fadeInUp}
              className="bg-white rounded-2xl shadow-card p-6 border border-loopy-100 hover:border-bridge/40 hover:shadow-card-hover transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-bridge/12 flex items-center justify-center mb-3">
                <m.icon size={20} className="text-bridge" />
              </div>
              <h3 className="font-bold text-loopy-900 mb-2">{m.title}</h3>
              <p className="text-sm text-loopy-700">{m.body}</p>
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
              alt="Pantalla de mapa de Loopy mostrando la ubicación en vivo de los integrantes de un Loop"
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
              Sea cual sea tu Loop, la experiencia es la misma: simple, clara y
              bajo tu control. Mirá todas las funciones en detalle o creá tu
              cuenta y armalo en un minuto.
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
