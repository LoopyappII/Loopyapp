"use client";

import { motion } from "framer-motion";
import { Phone, Mail, MapPin, ExternalLink } from "lucide-react";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import { HatBadge } from "./LoopyLogo";
import { fadeInUp, staggerContainer, revealOnce } from "@/lib/motion";

const DIRECCION = "Avenida Dr. Pedro Guillén, 5, 30100 Murcia, España";
const MAPS_EMBED_SRC =
  "https://www.google.com/maps?q=Marla+Center,+Avenida+Dr.+Pedro+Guill%C3%A9n+5,+30100+Murcia&output=embed";
const MAPS_LINK = "https://www.google.com/maps/search/?api=1&query=Marla+Center+Murcia";

const TELEFONOS = [
  { label: "+34 690 84 99 75", href: "tel:+34690849975" },
  { label: "+34 620 45 36 38", href: "tel:+34620453638" },
];

export default function ContactoContent() {
  return (
    <main className="relative min-h-screen flex flex-col">
      <SiteHeader />

      <motion.section
        variants={staggerContainer()}
        initial="hidden"
        whileInView="show"
        viewport={revealOnce}
        className="max-w-3xl mx-auto w-full px-6 pt-14 pb-8 md:pt-20 text-center"
      >
        <motion.div variants={fadeInUp} className="flex justify-center mb-5">
          <HatBadge size={48} />
        </motion.div>
        <motion.p
          variants={fadeInUp}
          className="text-sm font-bold text-bridge uppercase tracking-wide mb-2"
        >
          Contacto
        </motion.p>
        <motion.h1
          variants={fadeInUp}
          className="text-3xl md:text-4xl font-extrabold text-loopy-900 mb-6"
        >
          Dónde estamos
        </motion.h1>
        <motion.p
          variants={fadeInUp}
          className="text-lg text-loopy-700 leading-relaxed"
        >
          Nuestra oficina está en Marla Center, centro de negocios en Murcia.
          Escríbenos o llámanos cuando quieras — te leemos y respondemos con
          gusto.
        </motion.p>
      </motion.section>

      <motion.section
        variants={staggerContainer()}
        initial="hidden"
        whileInView="show"
        viewport={revealOnce}
        className="max-w-5xl mx-auto w-full px-6 pb-16"
      >
        <div className="grid md:grid-cols-[1.1fr_0.9fr] gap-8 md:gap-10 items-start">
          <motion.div
            variants={fadeInUp}
            className="relative w-full aspect-square sm:aspect-video overflow-hidden rounded-2xl shadow-card border border-loopy-100"
          >
            <iframe
              src={MAPS_EMBED_SRC}
              title="Ubicación de Marla Center en el mapa"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0 w-full h-full border-0"
            />
          </motion.div>

          <motion.div variants={fadeInUp} className="space-y-6">
            <div className="rounded-2xl border border-loopy-100 shadow-card p-6 bg-white">
              <div className="flex items-start gap-3 mb-5">
                <span className="w-9 h-9 rounded-full bg-bridge/12 flex items-center justify-center shrink-0">
                  <MapPin size={16} className="text-bridge" />
                </span>
                <div>
                  <p className="font-semibold text-loopy-900 mb-1">
                    Marla Center — centro de negocios
                  </p>
                  <p className="text-sm text-loopy-700 leading-relaxed">
                    {DIRECCION}
                  </p>
                  <a
                    href={MAPS_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-bridge hover:text-loopy-900 transition-colors mt-2"
                  >
                    Ver en Google Maps
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3 mb-5">
                <span className="w-9 h-9 rounded-full bg-bridge/12 flex items-center justify-center shrink-0">
                  <Phone size={16} className="text-bridge" />
                </span>
                <div className="flex flex-col gap-1">
                  {TELEFONOS.map((t) => (
                    <a
                      key={t.href}
                      href={t.href}
                      className="text-sm font-medium text-loopy-900 hover:text-bridge transition-colors"
                    >
                      {t.label}
                    </a>
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-full bg-bridge/12 flex items-center justify-center shrink-0">
                  <Mail size={16} className="text-bridge" />
                </span>
                <a
                  href="mailto:info@directloopy.com"
                  className="text-sm font-medium text-loopy-900 hover:text-bridge transition-colors"
                >
                  info@directloopy.com
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      <SiteFooter />
    </main>
  );
}
