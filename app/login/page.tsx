"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { NavbarLogo } from "@/components/LoopyLogo";
import { fadeInUp } from "@/lib/motion";
import { acceptInvite, createDefaultLoop } from "@/lib/loopBootstrap";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get("invite");
  const pmId = searchParams.get("pm");
  const hasInvite = !!(inviteCode && pmId);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    if (hasInvite && data.session) {
      const accepted = await acceptInvite(pmId!, inviteCode!, data.session.access_token);
      if ("loopId" in accepted) {
        router.push(`/loop/${accepted.loopId}/mapa`);
        return;
      }
    } else if (data.session) {
      // Sin contexto de invitación: si es la primera vez que este usuario
      // entra (cero Loopys), le creamos el Loopy por defecto y lo mandamos
      // directo al mapa, igual que a un registro nuevo. Un usuario que ya
      // tiene Loopys sigue yendo a /dashboard exactamente como hoy.
      const { data: memberships } = await supabase
        .from("loop_members")
        .select("loop_id")
        .eq("user_id", data.session.user.id);
      if ((memberships || []).length === 0) {
        const created = await createDefaultLoop(data.session.user.id, data.session.access_token);
        if ("loopId" in created) {
          router.push(`/loop/${created.loopId}/mapa`);
          return;
        }
      }
    }
    router.push("/dashboard");
  }

  return (
    <main className="relative min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto w-full">
        <Link href="/">
          <NavbarLogo size={32} dark />
        </Link>
        <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
          <Link
            href={hasInvite ? `/signup?invite=${inviteCode}&pm=${pmId}` : "/signup"}
            className="px-4 py-2 rounded-full bg-gradient-to-r from-loopy-700 via-bridge to-glow-500 text-white font-medium shadow-cta hover:shadow-cta-hover inline-block"
          >
            Crear cuenta
          </Link>
        </motion.div>
      </header>

      <section className="flex-1 flex items-center justify-center px-6 py-10">
        <motion.div
          initial="hidden"
          animate="show"
          variants={fadeInUp}
          className="w-full max-w-sm"
        >
          <div className="flex flex-col items-center mb-6">
            <span className="mb-3 px-4 py-1 rounded-full text-xs font-semibold tracking-wide uppercase bg-bridge/10 text-loopy-700 border border-bridge/30 shadow-badge">
              Iniciar sesión
            </span>
            <h1 className="text-2xl font-extrabold text-loopy-900 text-center">
              Bienvenido de nuevo
            </h1>
            <p className="text-sm text-loopy-700 text-center mt-1">
              {hasInvite
                ? "Accede para aceptar tu invitación y compartir ubicación."
                : "Accede para ver tus Loopys y tu ubicación en tiempo real."}
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="w-full bg-white rounded-2xl shadow-card border border-loopy-100 p-8"
          >
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
              {loading ? "Accediendo..." : "Acceder"}
            </motion.button>
            <p className="text-sm text-loopy-700 mt-4 text-center">
              ¿No tienes cuenta?{" "}
              <Link href={hasInvite ? `/signup?invite=${inviteCode}&pm=${pmId}` : "/signup"} className="text-bridge font-medium">
                Crea una
              </Link>
            </p>
          </form>
        </motion.div>
      </section>
    </main>
  );
}
