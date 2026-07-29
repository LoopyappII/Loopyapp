"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import {
  UserPlus,
  SlidersHorizontal,
  MapPin,
  Users,
  ShieldCheck,
  Siren,
  History,
} from "lucide-react";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import { fadeInUp, staggerContainer, revealOnce } from "@/lib/motion";

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

const FUNCTIONS = [
  {
    icon: MapPin,
    title: "Mapa en tiempo real",
    body: "Vas a ver a cada persona de tu Loop en el mapa, en vivo. Cada una aparece con su foto o inicial, y con el nivel de batería de su teléfono — así sabés si se está por quedar sin señal antes de que pase.",
    image: "/images/guia-de-uso/mapa.png",
    alt: "Pantalla de mapa de Loopy mostrando la ubicación en vivo de tres integrantes de la familia",
  },
  {
    icon: Users,
    title: "Perfiles y permisos, por persona",
    body: 'Cada integrante tiene su propio perfil, con su rol (Admin, hijo o hija) y su edad si corresponde. Vos decidís quién comparte ubicación con quién: los chicos, por ejemplo, solo comparten con los adultos del grupo.',
    image: "/images/guia-de-uso/familia.png",
    alt: "Pantalla de perfiles de familia en Loopy con roles y permisos de cada integrante",
  },
  {
    icon: ShieldCheck,
    title: "Zonas seguras",
    body: "Marcá los lugares importantes — la casa, el colegio, el club — y recibí un aviso apenas alguien entra o sale. Sabés al instante si tu hija llegó a casa o si tu hijo salió del colegio, sin tener que preguntar.",
    image: "/images/guia-de-uso/zonas.png",
    alt: "Pantalla de zonas seguras de Loopy con Casa, Colegio y Club marcados en el mapa",
  },
  {
    icon: Siren,
    title: "Botón SOS",
    body: "Ante una emergencia, mantenés presionado el botón SOS y avisás al instante a las personas que elegiste, compartiendo tu ubicación exacta. El sistema también puede marcar automáticamente el número de emergencia de tu zona.",
    image: "/images/guia-de-uso/sos.png",
    alt: "Pantalla del botón de emergencia SOS de Loopy",
  },
  {
    icon: History,
    title: "Historial, rutas y alertas de velocidad",
    body: "Mirá el recorrido del día en una línea de tiempo simple: a qué hora salió de casa, cuándo entró al colegio, cuándo volvió. Si alguien se desplaza más rápido de lo esperado — por encima del límite que vos configures — te llega un aviso al momento.",
    image: "/images/guia-de-uso/rutas.png",
    alt: "Pantalla de historial y alertas de velocidad de Loopy con la línea de tiempo del día",
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

      <section className="max-w-5xl mx-auto w-full px-6 pb-8 text-center">
        <p className="text-sm font-bold text-bridge uppercase tracking-wide mb-2">
          Todo lo que incluye
        </p>
        <h2 className="text-2xl md:text-3xl font-extrabold text-loopy-900">
          Las funciones de Loopy, una por una
        </h2>
      </section>

      <div className="max-w-5xl mx-auto w-full px-6 pb-16 flex flex-col gap-16 md:gap-20">
        {FUNCTIONS.map((f, i) => (
          <motion.section
            key={f.title}
            variants={staggerContainer()}
            initial="hidden"
            whileInView="show"
            viewport={revealOnce}
            className="grid md:grid-cols-2 gap-8 md:gap-12 items-center"
          >
            <motion.div
              variants={fadeInUp}
              className={`relative w-full max-w-[280px] mx-auto aspect-[390/844] overflow-hidden rounded-[2rem] shadow-card border border-loopy-100 ${
                i % 2 === 1 ? "md:order-2" : ""
              }`}
            >
              <Image
                src={f.image}
                alt={f.alt}
                fill
                className="object-cover"
                sizes="280px"
              />
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className={`text-center md:text-left ${
                i % 2 === 1 ? "md:order-1" : ""
              }`}
            >
              <div className="w-11 h-11 rounded-xl bg-bridge/12 flex items-center justify-center mb-4 mx-auto md:mx-0">
                <f.icon size={20} className="text-bridge" />
              </div>
              <h3 className="text-xl md:text-2xl font-extrabold text-loopy-900 mb-3">
                {f.title}
              </h3>
              <p className="text-loopy-700 leading-relaxed">{f.body}</p>
            </motion.div>
          </motion.section>
        ))}
      </div>

      <SiteFooter />
    </main>
  );
}
