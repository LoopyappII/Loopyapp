"use client";

import { LogIn, LogOut as LogOutIcon, Gauge, Route as RouteIcon } from "lucide-react";
import { useLoop } from "../LoopContext";

type HistoryItem =
  | { kind: "zone"; id: string; time: string; text: string; positive: boolean; userId: string }
  | { kind: "speed"; id: string; time: string; text: string; userId: string };

export default function RutasPage() {
  const { events, speedAlerts, routeUserId, toggleRoute, members } = useLoop();

  const routeMemberName = routeUserId
    ? members.find((m) => m.user_id === routeUserId)?.profiles?.name || "Miembro"
    : null;

  const historyItems: HistoryItem[] = [
    ...events.map(
      (ev): HistoryItem => ({
        kind: "zone",
        id: ev.id,
        time: ev.created_at,
        text: `${ev.event_type === "enter" ? "Entró a" : "Salió de"} ${ev.safe_zones?.name || "zona"}`,
        positive: ev.event_type === "enter",
        userId: ev.user_id,
      })
    ),
    ...speedAlerts.map(
      (sa): HistoryItem => ({
        kind: "speed",
        id: sa.id,
        time: sa.created_at,
        text: `Alerta de velocidad — ${Math.round(sa.speed_kmh)} km/h (límite ${sa.limit_kmh} km/h)`,
        userId: sa.user_id,
      })
    ),
  ]
    .filter((it) => !routeUserId || it.userId === routeUserId)
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 20);

  return (
    <div className="flex-1 p-4">
      <div className="bg-white rounded-xl border border-loopy-100 shadow-card p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-loopy-900">{routeMemberName ? `Historial de ${routeMemberName}` : "Historial"}</h2>
          {routeUserId && (
            <button onClick={() => toggleRoute(routeUserId)} className="text-xs font-medium text-bridge hover:text-loopy-900">
              Ver todos
            </button>
          )}
        </div>
        {routeUserId && (
          <p className="text-[11px] text-loopy-700/60 mb-2 flex items-center gap-1">
            <RouteIcon size={11} className="text-glow-600 shrink-0" />
            Recorrido de hoy marcado en el mapa
          </p>
        )}
        <ul className="text-xs space-y-1">
          {historyItems.length === 0 && (
            <li className="text-loopy-700/60">
              {routeMemberName ? `Sin eventos de ${routeMemberName} todavía.` : "Sin eventos todavía."}
            </li>
          )}
          {historyItems.map((it) => (
            <li key={it.id} className="flex items-center gap-1.5 text-loopy-700">
              {it.kind === "speed" ? (
                <Gauge size={13} className="text-amber-500 shrink-0" />
              ) : it.positive ? (
                <LogIn size={13} className="text-emerald-500 shrink-0" />
              ) : (
                <LogOutIcon size={13} className="text-glow-600 shrink-0" />
              )}
              {it.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
