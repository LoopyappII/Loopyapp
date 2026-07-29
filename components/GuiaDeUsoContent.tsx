"use client";

import { motion } from "framer-motion";
import { UserPlus, SlidersHorizontal, MapPin } from "lucide-react";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import { fadeInUp, staggerContainer } from "@/lib/motion";

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

export default function GuiaDeUsoContent() {
  return (
    <main className="relative min-h-screen flex flex-col">
      <SiteHeader />

      <motion.section
        variants={staggerContainer()}
        initial="hidden"
        animate="show"
        className="max-w-5xl mx-auto w-full px-6 pt-14 pb-16 md:pt-20 text-center"
      >
        <motion.h1
          variants={fadeInUp}
          className="text-3xl md:text-4xl font-extrabold text-loopy-900 mb-10"
        >
          Guía de uso
        </motion.h1>
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

      <SiteFooter />
    </main>
  );
}
