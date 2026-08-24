"use client";

import { useState } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import Link from "next/link";
import { useLoop } from "../../LoopContext";

export default function ZonasPage() {
  const { loopId, zones, addZone } = useLoop();
  const [zoneName, setZoneName] = useState("");
  const [zoneRadius, setZoneRadius] = useState(150);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleAddZone(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    const { error } = await addZone(zoneName, zoneRadius);
    if (error) {
      setError(error);
    } else {
      setZoneName("");
    }
    setCreating(false);
  }

  return (
    <div className="flex-1 p-4 space-y-4">
      <Link href={`/loop/${loopId}/mapa`} className="flex items-center gap-1 text-loopy-700 text-sm font-medium">
        <ArrowLeft size={15} />
        Mapa
      </Link>

      <form onSubmit={handleAddZone} className="bg-white rounded-xl border border-loopy-100 shadow-card p-4">
        <h2 className="font-bold text-loopy-900 mb-2 flex items-center gap-1.5">
          <MapPin size={16} className="text-bridge" />
          Nueva zona segura
        </h2>
        <input
          placeholder="Nombre (ej. Casa)"
          className="w-full mb-2 px-3 py-2 rounded-lg border border-loopy-50 text-sm focus:outline-none focus:ring-2 focus:ring-bridge/60"
          value={zoneName}
          onChange={(e) => setZoneName(e.target.value)}
          required
        />
        <input
          type="number"
          min={30}
          step={10}
          placeholder="Radio en metros"
          className="w-full mb-2 px-3 py-2 rounded-lg border border-loopy-50 text-sm focus:outline-none focus:ring-2 focus:ring-bridge/60"
          value={zoneRadius}
          onChange={(e) => setZoneRadius(Number(e.target.value))}
        />
        <p className="text-xs text-loopy-700/60 mb-3">Se crea centrada en tu ubicación actual.</p>
        {error && <p className="text-red-600 text-xs mb-3">{error}</p>}
        <button
          type="submit"
          disabled={creating}
          className="w-full py-2 rounded-full bg-gradient-to-r from-loopy-700 via-bridge to-glow-500 text-white text-sm font-semibold shadow-cta hover:shadow-cta-hover disabled:opacity-60"
        >
          {creating ? "Creando..." : "Crear zona"}
        </button>
      </form>

      <div className="bg-white rounded-xl border border-loopy-100 shadow-card p-4">
        <h2 className="font-bold text-loopy-900 mb-2">Zonas seguras</h2>
        {zones.length === 0 ? (
          <p className="text-sm text-loopy-700/70">Todavía no hay zonas creadas.</p>
        ) : (
          <ul className="text-sm space-y-2">
            {zones.map((z) => (
              <li key={z.id} className="flex items-center justify-between text-loopy-700">
                <span className="font-medium text-loopy-900">{z.name}</span>
                <span className="text-xs text-loopy-700/60">{z.radius_m} m</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
