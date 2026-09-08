"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useLoop } from "../LoopContext";

export default function ActivarPage({ params }: { params: { id: string } }) {
  const { userId, isAdmin } = useLoop();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Ingresá tu nombre completo.");
      return;
    }
    setLoading(true);
    setError(null);

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ name: name.trim() })
      .eq("id", userId);
    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setError("Tu sesión expiró. Volvé a acceder.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ loopId: params.id }),
      });
      const json = await res.json();
      if (res.ok && json.url) {
        window.location.href = json.url;
        return;
      }
      if (res.ok && json.bypass) {
        // No debería pasar nunca por este camino (un admin bypass ya recibe
        // acceso permanente al crear el Loopy, en /api/loops/start-trial, y
        // jamás llega a ver /activar) — se cubre igual por simetría con el
        // resto de los llamadores de /api/stripe/checkout.
        window.location.reload();
        return;
      }
      setError(json.error || "No se pudo continuar");
    } catch {
      setError("No se pudo conectar con el servidor de pagos");
    }
    setLoading(false);
  }

  if (!isAdmin) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
        <h1 className="text-xl font-bold text-loopy-900 mb-2">Tu día de prueba gratis terminó</h1>
        <p className="text-loopy-700 max-w-sm">
          Pedile al admin de este Loopy que lo active para seguir usando el mapa, la familia y las alertas.
        </p>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
      <div className="w-14 h-14 rounded-full bg-bridge/10 flex items-center justify-center mb-4">
        <ShieldCheck className="text-bridge" size={26} />
      </div>
      <h1 className="text-xl font-bold text-loopy-900 mb-2">Activá tu Loopy</h1>
      <p className="text-loopy-700 max-w-sm mb-6">
        Tu día de prueba gratis terminó. Completá tu nombre para seguir con el pago.
      </p>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-2xl shadow-card border border-loopy-100 p-6 text-left"
      >
        <label htmlFor="activar-name" className="block text-sm font-medium text-loopy-900 mb-1">
          Nombre completo
        </label>
        <input
          id="activar-name"
          className="w-full mb-4 px-3 py-2 rounded-lg border border-loopy-50 focus:outline-none focus:ring-2 focus:ring-bridge/60"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-full bg-gradient-to-r from-loopy-700 via-bridge to-glow-500 text-white font-semibold shadow-cta hover:shadow-cta-hover disabled:opacity-60"
        >
          {loading ? "Un momento..." : "Continuar al pago"}
        </button>
      </form>
    </main>
  );
}
