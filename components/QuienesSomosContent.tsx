"use client";

import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";

export default function QuienesSomosContent() {
  return (
    <main className="relative min-h-screen flex flex-col">
      <SiteHeader />

      <section className="max-w-3xl mx-auto w-full px-6 pt-14 pb-16 md:pt-20 text-center flex-1">
        <h1 className="text-3xl md:text-4xl font-extrabold text-loopy-900 mb-6">
          Quiénes somos
        </h1>
        <p className="text-lg text-loopy-700 leading-relaxed">
          Loopy es un proyecto de LOOPER CASHLINE SL pensado para que compartir tu
          ubicación sea simple, seguro y bajo tu control. Creemos que cuidar a la
          gente que querés no debería requerir apps complicadas — por eso
          construimos algo liviano y claro, donde vos decidís quién ve qué y por
          cuánto tiempo.
        </p>
      </section>

      <SiteFooter />
    </main>
  );
}
