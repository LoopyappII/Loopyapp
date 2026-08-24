"use client";

import { useState } from "react";
import { useLoop } from "../LoopContext";

export default function AjustesPage() {
  const { loop, isAdmin, saveLoopSettings } = useLoop();
  const [speedLimitInput, setSpeedLimitInput] = useState(loop.speed_limit_kmh?.toString() || "");
  const [emergencyNumberInput, setEmergencyNumberInput] = useState(loop.emergency_number || "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error } = await saveLoopSettings(
      speedLimitInput ? Number(speedLimitInput) : null,
      emergencyNumberInput || null
    );
    if (error) setError(error);
    setSaving(false);
  }

  return (
    <div className="flex-1 p-4 space-y-4">
      <div className="bg-white rounded-xl border border-loopy-100 shadow-card md:shadow-card-hover p-4 md:p-6">
        <h2 className="font-bold text-loopy-900 mb-1">{loop.name}</h2>
        <p className="text-xs text-loopy-700/70">
          {loop.mode === "mirror" ? "Modo Espejo" : "Modo Supervisión"} · Código: {loop.invite_code}
        </p>
      </div>

      {isAdmin ? (
        <form onSubmit={handleSave} className="bg-white rounded-xl border border-loopy-100 shadow-card md:shadow-card-hover p-4 md:p-6">
          <h2 className="font-bold text-loopy-900 mb-2">Configuración del Loopy</h2>
          <label className="block text-xs text-loopy-700/70 mb-1">Límite de velocidad (km/h)</label>
          <input
            type="number"
            min={0}
            placeholder="Ej. 120"
            className="w-full mb-3 px-3 py-2 rounded-lg border border-loopy-50 text-sm focus:outline-none focus:ring-2 focus:ring-bridge/60"
            value={speedLimitInput}
            onChange={(e) => setSpeedLimitInput(e.target.value)}
          />
          <label className="block text-xs text-loopy-700/70 mb-1">Número de emergencia</label>
          <input
            type="tel"
            placeholder="Ej. 911"
            className="w-full mb-3 px-3 py-2 rounded-lg border border-loopy-50 text-sm focus:outline-none focus:ring-2 focus:ring-bridge/60"
            value={emergencyNumberInput}
            onChange={(e) => setEmergencyNumberInput(e.target.value)}
          />
          {error && <p className="text-red-600 text-xs mb-3">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2 rounded-full bg-gradient-to-r from-loopy-700 via-bridge to-glow-500 text-white text-sm font-semibold shadow-cta hover:shadow-cta-hover disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-loopy-700/70">Solo el admin del Loopy puede cambiar esta configuración.</p>
      )}
    </div>
  );
}
