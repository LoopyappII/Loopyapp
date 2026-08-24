"use client";

import { useEffect, useRef, useState } from "react";
import { Siren } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useLoop } from "../LoopContext";

export default function SosPage() {
  const { userId, loopId, myPos } = useLoop();
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
      <div className="bg-white rounded-xl border border-red-100 shadow-card p-4">
        <h2 className="font-bold text-loopy-900 mb-1 flex items-center gap-1.5">
          <Siren size={16} className="text-red-600" />
          Botón SOS
        </h2>
        <p className="text-xs text-loopy-700/70 mb-3">
          Mantén presionado para avisar a todo el Loopy y compartir tu ubicación exacta.
        </p>
        <button
          onMouseDown={startHold}
          onMouseUp={cancelHold}
          onMouseLeave={cancelHold}
          onTouchStart={startHold}
          onTouchEnd={cancelHold}
          onTouchCancel={cancelHold}
          disabled={sosSent}
          className="relative w-full overflow-hidden rounded-full bg-red-600 text-white font-bold py-3 select-none disabled:opacity-90"
        >
          <div
            className="absolute inset-y-0 left-0 bg-white/25"
            style={{ width: `${holdPct}%`, transition: "width 20ms linear" }}
          />
          <span className="relative text-sm">{sosSent ? "Alerta enviada ✓" : "Mantén presionado — SOS"}</span>
        </button>
      </div>
    </div>
  );
}
