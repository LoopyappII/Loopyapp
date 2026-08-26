"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { supabase } from "@/lib/supabaseClient";
import { NavbarLogo } from "@/components/LoopyLogo";
import { fadeInUp, scaleIn } from "@/lib/motion";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone) {
      setError("El teléfono es obligatorio.");
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, phone },
        emailRedirectTo: "https://loopy.company/login",
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      router.push("/dashboard");
    } else {
      setDone(true);
    }
  }

  return (
    <main className="relative min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto w-full">
        <Link href="/">
          <NavbarLogo size={32} dark />
        </Link>
        <Link
          href="/login"
          className="px-4 py-2 text-loopy-700 font-medium hover:text-loopy-900 transition-colors"
        >
          Acceder
        </Link>
      </header>

      <section className="flex-1 flex items-center justify-center px-6 py-10">
        {done ? (
          <motion.div
            initial="hidden"
            animate="show"
            variants={scaleIn}
            className="w-full max-w-sm bg-white rounded-2xl shadow-card border border-loopy-100 p-8 text-center"
          >
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
              className="mx-auto mb-4 w-14 h-14 rounded-full bg-bridge/10 flex items-center justify-center"
            >
              <CheckCircle2 className="text-bridge" size={30} />
            </motion.div>
            <h1 className="text-xl font-bold text-loopy-900 mb-2">
              ¡Cuenta creada!
            </h1>
            <p className="text-loopy-700">
              Revisa tu email para confirmar la cuenta antes de acceder.
            </p>
            <Link
              href="/login"
              className="text-bridge font-medium mt-4 inline-block"
            >
              Ir a acceder
            </Link>
          </motion.div>
        ) : (
          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeInUp}
            className="w-full max-w-sm"
          >
            <div className="flex flex-col items-center mb-6">
              <span className="mb-3 px-4 py-1 rounded-full text-xs font-semibold tracking-wide uppercase bg-bridge/10 text-loopy-700 border border-bridge/30 shadow-badge">
                Crear cuenta
              </span>
              <h1 className="text-2xl font-extrabold text-loopy-900 text-center">
                Súmate a Loopy
              </h1>
              <p className="text-sm text-loopy-700 text-center mt-1">
                Gratis el primer día, 14,99€/mes después.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="w-full bg-white rounded-2xl shadow-card border border-loopy-100 p-8"
            >
              <label className="block text-sm font-medium text-loopy-900 mb-1">
                Nombre
              </label>
              <input
                className="w-full mb-4 px-3 py-2 rounded-lg border border-loopy-50 focus:outline-none focus:ring-2 focus:ring-bridge/60"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <label className="block text-sm font-medium text-loopy-900 mb-1">
                Teléfono
              </label>
              <PhoneInput
                value={phone}
                onChange={(value) => setPhone(value || "")}
                placeholder="+34 600 000 000"
                international
                required
                className="loopy-phone-input w-full mb-4"
              />
              <label className="block text-sm font-medium text-loopy-900 mb-1">
                Email
              </label>
              <input
                type="email"
                className="w-full mb-4 px-3 py-2 rounded-lg border border-loopy-50 focus:outline-none focus:ring-2 focus:ring-bridge/60"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <label className="block text-sm font-medium text-loopy-900 mb-1">
                Contraseña
              </label>
              <input
                type="password"
                minLength={6}
                className="w-full mb-6 px-3 py-2 rounded-lg border border-loopy-50 focus:outline-none focus:ring-2 focus:ring-bridge/60"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-full bg-gradient-to-r from-loopy-700 via-bridge to-glow-500 text-white font-semibold shadow-cta hover:shadow-cta-hover disabled:opacity-60"
              >
                {loading ? "Creando..." : "Crear cuenta"}
              </motion.button>
              <p className="text-xs text-loopy-700/60 mt-3 text-center">
                Al crear tu cuenta aceptas los{" "}
                <Link href="/terminos" className="text-bridge font-medium hover:underline">
                  Términos
                </Link>{" "}
                y la{" "}
                <Link href="/privacidad" className="text-bridge font-medium hover:underline">
                  Política de Privacidad
                </Link>
                .
              </p>
              <p className="text-sm text-loopy-700 mt-4 text-center">
                ¿Ya tienes cuenta?{" "}
                <Link href="/login" className="text-bridge font-medium">
                  Accede
                </Link>
              </p>
            </form>
          </motion.div>
        )}
      </section>
    </main>
  );
}
