"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { NavbarLogo } from "@/components/LoopyLogo";

type GateState = "loading" | "authorized" | "unauthorized";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<GateState>("loading");

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/login");
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setState("unauthorized");
        return;
      }
      try {
        const res = await fetch("/api/admin/is-staff", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const json = await res.json().catch(() => ({}));
        setState(res.ok && json.isStaff ? "authorized" : "unauthorized");
      } catch {
        setState("unauthorized");
      }
    })();
  }, [router]);

  if (state === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center text-loopy-700">
        Cargando...
      </main>
    );
  }

  if (state === "unauthorized") {
    // Nunca redirigir en silencio: alguien puede llegar por un bookmark
    // viejo mientras está legítimamente logueado — explicar qué pasó es
    // mejor que mandarlo de vuelta sin decir nada.
    return (
      <main className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <ShieldAlert className="text-red-600" size={26} />
        </div>
        <h1 className="text-xl font-bold text-loopy-900 mb-2">No autorizado</h1>
        <p className="text-loopy-700 max-w-sm mb-6">
          Esta sección es solo para el equipo de Looper Cashline. Si creés que
          deberías tener acceso, pedile a quien administra Loopy que agregue
          tu email a la lista del backoffice.
        </p>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 rounded-full bg-gradient-to-r from-loopy-700 via-bridge to-glow-500 text-white text-sm font-semibold shadow-cta hover:shadow-cta-hover"
        >
          Volver a Mis Loopys
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-loopy-50/40">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-loopy-100">
          <Link href="/admin" aria-label="Panel de administración" className="flex items-center gap-2.5">
            <NavbarLogo size={26} />
            <span className="hidden sm:inline-block text-[11px] font-semibold uppercase tracking-wide text-bridge bg-bridge/10 rounded-full px-2 py-0.5">
              Staff · Looper Cashline
            </span>
          </Link>
          <Link href="/dashboard" className="text-sm text-loopy-700 hover:text-loopy-900">
            Salir del panel
          </Link>
        </div>
        <div className="h-[3px] bg-gradient-to-r from-loopy-700 via-bridge to-glow-500" />
      </header>
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">{children}</div>
    </main>
  );
}
