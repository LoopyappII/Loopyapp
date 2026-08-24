"use client";

import dynamic from "next/dynamic";
import { LogIn, LogOut as LogOutIcon, Gauge, X } from "lucide-react";
import type { MapMember, MapRoute, MapZone } from "@/components/LiveMap";
import { useLoop } from "../LoopContext";

const ROUTE_COLOR = "#ec6fc9";

const LiveMap = dynamic(() => import("@/components/LiveMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center text-loopy-700">
      Cargando mapa...
    </div>
  ),
});

type HistoryItem =
  | { kind: "zone"; id: string; time: string; text: string; positive: boolean; userId: string }
  | { kind: "speed"; id: string; time: string; text: string; userId: string };

export default function RutasPage() {
  const {
    members,
    mapMembers,
    zones,
    myPos,
    events,
    speedAlerts,
    routeUserId,
    routePoints,
    routeLoading,
    toggleRoute,
  } = useLoop();

  const memberList: MapMember[] = Object.values(mapMembers);
  const mapZones: MapZone[] = zones.map((z) => ({
    id: z.id,
    name: z.name,
    lat: z.lat,
    lng: z.lng,
    radius_m: z.radius_m,
  }));
  const center: [number, number] = myPos
    ? [myPos.lat, myPos.lng]
    : memberList.length > 0
    ? [memberList[0].lat, memberList[0].lng]
    : [40.4168, -3.7038];

  const routeMemberName = routeUserId
    ? members.find((m) => m.user_id === routeUserId)?.profiles?.name || "Miembro"
    : null;
  const mapRoute: MapRoute | null = routeUserId ? { color: ROUTE_COLOR, points: routePoints } : null;

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
    <div className="flex-1 flex flex-col">
      <div className="relative flex-1 min-h-[40vh]">
        <LiveMap members={memberList} zones={mapZones} center={center} route={mapRoute} />
        {routeMemberName ? (
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-white/95 backdrop-blur-sm border border-loopy-100 shadow-card md:shadow-card-hover rounded-full pl-3 pr-1.5 py-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ROUTE_COLOR }} />
            <span className="text-xs font-medium text-loopy-900">
              {routeLoading
                ? `Cargando recorrido de ${routeMemberName}...`
                : routePoints.length > 1
                ? `Recorrido de ${routeMemberName} · hoy`
                : `Sin movimiento registrado hoy para ${routeMemberName}`}
            </span>
            <button
              onClick={() => toggleRoute(routeUserId as string)}
              aria-label="Cerrar recorrido"
              className="w-5 h-5 rounded-full flex items-center justify-center text-loopy-700/60 hover:bg-loopy-50 hover:text-loopy-900"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className="absolute top-3 left-3 right-3 z-10 bg-white/95 backdrop-blur-sm border border-loopy-100 shadow-card rounded-full px-4 py-1.5 text-center">
            <span className="text-xs font-medium text-loopy-700">Tocá a un miembro para ver su recorrido de hoy</span>
          </div>
        )}
      </div>

      <div className="bg-white border-t border-loopy-100 rounded-t-2xl -mt-4 relative z-10 p-4 md:p-6 shadow-[0_-8px_28px_rgba(35,42,82,0.10)] space-y-4">
        <div className="flex gap-3 overflow-x-auto pb-1">
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => toggleRoute(m.user_id)}
              className="flex flex-col items-center gap-1 shrink-0"
              title={`Ver recorrido de ${m.profiles?.name || "miembro"}`}
            >
              <span
                className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                  routeUserId === m.user_id ? "ring-2 ring-glow-500 ring-offset-2" : ""
                }`}
                style={{ backgroundColor: m.user_id === routeUserId ? "#ec6fc9" : "#5b6fc4" }}
              >
                {(m.profiles?.name || "?").charAt(0).toUpperCase()}
              </span>
              <span className="text-[11px] text-loopy-700 max-w-[56px] truncate">
                {m.profiles?.name || "Miembro"}
              </span>
            </button>
          ))}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-loopy-900">
              {routeMemberName ? `Historial de ${routeMemberName}` : "Historial"}
            </h2>
            {routeUserId && (
              <button
                onClick={() => toggleRoute(routeUserId)}
                className="text-xs font-medium text-bridge hover:text-loopy-900"
              >
                Ver todos
              </button>
            )}
          </div>
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
    </div>
  );
}
