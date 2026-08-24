"use client";

import { useState } from "react";
import { Route as RouteIcon } from "lucide-react";
import { useLoop, roleLabel } from "../LoopContext";

export default function FamiliaPage() {
  const { members, myAge, saveAge, routeUserId, toggleRoute } = useLoop();
  const [ageInput, setAgeInput] = useState("");

  async function handleSaveAge(e: React.FormEvent) {
    e.preventDefault();
    if (!ageInput) return;
    await saveAge(Number(ageInput));
    setAgeInput("");
  }

  return (
    <div className="flex-1 p-4">
      <div className="bg-white rounded-xl border border-loopy-100 shadow-card p-4">
        <h2 className="font-bold text-loopy-900 mb-2">Miembros</h2>
        <ul className="text-sm space-y-1">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 text-loopy-700">
              <span className="min-w-0 truncate">
                {m.profiles?.name || "Miembro"}
                {m.profiles?.age ? ` · ${m.profiles.age} años` : ""}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-bridge font-medium">{roleLabel(m.role)}</span>
                <button
                  onClick={() => toggleRoute(m.user_id)}
                  aria-label={`Ver recorrido de ${m.profiles?.name || "miembro"}`}
                  title="Ver recorrido de hoy en el mapa"
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                    routeUserId === m.user_id
                      ? "bg-glow-500 text-white"
                      : "text-loopy-700/50 hover:bg-loopy-50 hover:text-bridge"
                  }`}
                >
                  <RouteIcon size={13} />
                </button>
              </span>
            </li>
          ))}
        </ul>
        {!myAge && (
          <form onSubmit={handleSaveAge} className="mt-3 flex gap-2">
            <input
              type="number"
              min={0}
              max={120}
              placeholder="Tu edad (opcional)"
              className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-loopy-50 text-xs focus:outline-none focus:ring-2 focus:ring-bridge/60"
              value={ageInput}
              onChange={(e) => setAgeInput(e.target.value)}
            />
            <button type="submit" className="px-3 py-1.5 rounded-lg bg-bridge/10 text-bridge text-xs font-semibold shrink-0">
              Guardar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
