"use client";

import { useEffect, useRef, useState } from "react";
import { Siren, Phone } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useLoop } from "../LoopContext";

export default function SosPage() {
  const { userId, loopId, myPos, loop, members } = useLoop();
  const notifiedCount = Math.max(0, members.filter((m) => m.user_id !== userId).length);
  const [holdPct, setHoldPct] = useState(0);
  const [sosSent, setSosSent] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // This page lives in a route segment (/loop/[id]/sos) that unmounts on
  // every tab navigation. Without this, a hold in progress (setInterval
  // ticking toward triggerSOS) or the post-trigger reset (setTimeout) could
  // outlive the component — e.g. a touch-cancel gesture, an incoming call,
  // or navigating away mid-press — and still fire a real emergency alert (or
  // a stray state update) from a screen the user already left.
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearInterval(holdTimerRef.current);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  function startHold() {
    if (sosSent) return;
    const start = Date.now();
    holdTimerRef.current = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / 1200) * 100);
      setHoldPct(pct);
      if (pct >= 100) {
        if (holdTimerRef.current) clearInterval(holdTimerRef.current);
        triggerSOS();
      }
    }, 20);
  }

  function cancelHold() {
    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    if (!sosSent) setHoldPct(0);
  }

  async function triggerSOS() {
    if (!userId) return;
    setSosSent(true);
    await supabase.from("sos_alerts").insert({
      loop_id: loopId,
      user_id: userId,
      lat: myPos?.lat ?? 0,
      lng: myPos?.lng ?? 0,
    });
    resetTimerRef.current = setTimeout(() => {
      setSosSent(false);
      setHoldPct(0);
    }, 4000);
  }

  return (
    <div className="flex-1 p-4">
      <div className="bg-white rounded-xl border border-red-100 shadow-card md:shadow-card-hover p-4 md:p-6">
        <h2 className="font-bold text-loopy-900 mb-1 flex items-center gap-1.5">
          <Siren size={16} className="text-red-600" />
          Botón SOS
        </h2>
        <p className="text-xs text-loopy-700/70 mb-1">
          Mantén presionado para avisar a todo el Loopy y compartir tu ubicación exacta.
        </p>
        {notifiedCount > 0 && (
          <p className="text-xs text-loopy-700/50 mb-4">
            Se notifica a {notifiedCount} {notifiedCount === 1 ? "persona" : "personas"}
          </p>
        )}
        <div className="flex items-center justify-center py-2">
          <button
            onMouseDown={startHold}
            onMouseUp={cancelHold}
            onMouseLeave={cancelHold}
            onTouchStart={startHold}
            onTouchEnd={cancelHold}
            onTouchCancel={cancelHold}
            disabled={sosSent}
            className="relative w-48 h-48 rounded-full select-none disabled:opacity-90 focus:outline-none focus:ring-4 focus:ring-red-300"
            style={{ background: `conic-gradient(#ffffff80 ${holdPct}%, transparent ${holdPct}%)` }}
          >
            <span className="absolute inset-2 rounded-full bg-red-600 shadow-[0_10px_36px_rgba(220,38,38,0.45)] flex flex-col items-center justify-center gap-1.5">
              <Siren size={32} className="text-white" />
              <span className="text-white font-bold text-sm px-6 text-center leading-tight">
                {sosSent ? "Alerta enviada ✓" : "Mantén presionado"}
              </span>
            </span>
          </button>
        </div>

        {(loop.emergency_number || loop.primary_contact_number) && (
          <div className="mt-5 space-y-2">
            {loop.emergency_number && (
              <a
                href={`tel:${loop.emergency_number}`}
                className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-loopy-100 hover:border-bridge/40 transition-colors"
              >
                <span className="text-sm font-medium text-loopy-900">Número de emergencia</span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-bridge">
                  <Phone size={14} />
                  {loop.emergency_number}
                </span>
              </a>
            )}
            {loop.primary_contact_number && (
              <a
                href={`tel:${loop.primary_contact_number}`}
                className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-loopy-100 hover:border-bridge/40 transition-colors"
              >
                <span className="text-sm font-medium text-loopy-900">Primer contacto</span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-bridge">
                  <Phone size={14} />
                  {loop.primary_contact_number}
                </span>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
