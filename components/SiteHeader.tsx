"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { NavbarLogo } from "./LoopyLogo";
import LanguageSwitcher from "./LanguageSwitcher";
import { EncryptedText } from "./ui/encrypted-text";

const MotionLink = motion.create(Link);

// Header + barra de bienvenida compartidos por todas las páginas (landing y
// las pestañas de Productos/Quiénes somos/Guía de uso), para que la
// navegación y la marca se sientan consistentes aunque cada pestaña sea su
// propia página.
export default function SiteHeader() {
  return (
    <>
      <div className="w-full bg-bridge/5 border-b border-loopy-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-1.5 text-center">
          <EncryptedText
            text="Bienvenido a Loopy, seguridad para todos."
            className="text-xs sm:text-sm font-medium tracking-wide"
            encryptedClassName="text-loopy-500/40"
            revealedClassName="text-bridge"
            revealDelayMs={45}
          />
        </div>
      </div>

      <header className="sticky top-0 z-20 backdrop-blur-md bg-white/70 border-b border-loopy-50">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-4 max-w-6xl mx-auto w-full">
          <Link href="/">
            <NavbarLogo size={30} dark />
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <Link
              href="/productos"
              className="px-3 py-1.5 text-sm text-loopy-700 font-medium hover:text-loopy-900 transition-colors"
            >
              Productos
            </Link>
            <Link
              href="/quienes-somos"
              className="px-3 py-1.5 text-sm text-loopy-700 font-medium hover:text-loopy-900 transition-colors"
            >
              Quiénes somos
            </Link>
            <Link
              href="/guia-de-uso"
              className="px-3 py-1.5 text-sm text-loopy-700 font-medium hover:text-loopy-900 transition-colors"
            >
              Guía de uso
            </Link>
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
    </>
  );
}
