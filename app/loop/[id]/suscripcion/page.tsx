"use client";

import { useState } from "react";
import { AlertTriangle, CreditCard } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useLoop } from "../LoopContext";
import type { SubscriptionStatus } from "@/lib/types";

const STATUS_COPY: Record<SubscriptionStatus | "none", { title: string; body: string }> = {
  none: {
    title: "Este Loopy no tiene una suscripción activa",
    body: "Para volver a usar el mapa, la familia y las alertas, hay que completar el pago.",
  },
  incomplete: {
    title: "Falta completar el pago",
    body: "El proceso de pago quedó a mitad de camino. Completalo para activar este Loopy.",
  },
  trialing: {
    title: "Suscripción en período de prueba",
    body: "Todo en orden — no deberías ver esta pantalla.",
  },
  active: {
    title: "Suscripción activa",
    body: "Todo en orden — no deberías ver esta pantalla.",
  },
  past_due: {
    title: "Hay un problema con el cobro",
    body: "No pudimos procesar el último cobro. Actualizá el método de pago para no perder el acceso.",
  },
  canceled: {
    title: "Esta suscripción terminó",
    body: "Para seguir usando este Loopy, hay que reactivar la suscripción.",
  },
};

export default function SuscripcionPage({ params }: { params: { id: string } }) {
  const { subscriptionStatus, isAdmin } = useLoop();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = subscriptionStatus ?? "none";
  const copy = STATUS_COPY[status] || STATUS_COPY.none;
  const action: "checkout" | "portal" =
    status === "none" || status === "incomplete" ? "checkout" : "portal";

  async function goToCheckoutOrPortal() {
    setLoading(true);
    setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setError("Tu sesión expiró. Volvé a acceder.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/stripe/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ loopId: params.id }),
      });
      const json = await res.json();
      if (res.ok && json.url) {
        window.location.href = json.url;
        return;
      }
      setError(json.error || "No se pudo continuar");
    } catch {
      setError("No se pudo conectar con el servidor de pagos");
    }
    setLoading(false);
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
      <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
        <AlertTriangle className="text-red-600" size={26} />
      </div>
      <h1 className="text-xl font-bold text-loopy-900 mb-2">{copy.title}</h1>
      <p className="text-loopy-700 max-w-sm mb-6">{copy.body}</p>
      {isAdmin ? (
        <button
          onClick={goToCheckoutOrPortal}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-loopy-700 via-bridge to-glow-500 text-white font-semibold shadow-badge disabled:opacity-60"
        >
          <CreditCard size={18} />
          {loading ? "Un momento..." : "Gestionar pago"}
        </button>
      ) : (
        <p className="text-sm text-loopy-500">Pedile al admin de este Loopy que gestione el pago.</p>
      )}
      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
    </main>
  );
}
