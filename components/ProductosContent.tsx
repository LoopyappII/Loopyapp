"use client";

import { motion } from "framer-motion";
import { Users, ShieldCheck } from "lucide-react";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import { fadeInUp, staggerContainer } from "@/lib/motion";

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

export default function ProductosContent() {
  return (
    <main className="relative min-h-screen flex flex-col">
      <SiteHeader />

      <motion.section
        variants={staggerContainer()}
        initial="hidden"
        animate="show"
        className="max-w-5xl mx-auto w-full px-6 pt-14 pb-16 md:pt-20"
      >
        <motion.h1
          variants={fadeInUp}
          className="text-3xl md:text-4xl font-extrabold text-loopy-900 mb-3 text-center"
        >
          Productos
        </motion.h1>
        <motion.p
          variants={fadeInUp}
          className="text-lg text-loopy-700 text-center max-w-2xl mx-auto mb-10"
        >
          Dos formas de compartir ubicación, según lo que necesites.
        </motion.p>

        <div className="grid gap-6 md:grid-cols-2">
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
        </div>
      </motion.section>

      <SiteFooter />
    </main>
  );
}
