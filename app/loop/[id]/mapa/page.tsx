"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { X, ShieldCheck, Siren } from "lucide-react";
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

export default function MapaPage() {
  const { loopId, members, mapMembers, zones, myPos, routeUserId, routePoints, routeLoading, toggleRoute } =
    useLoop();

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

  return (
    <div className="flex-1 flex flex-col">
      <div className="relative flex-1 min-h-[45vh]">
        <LiveMap members={memberList} zones={mapZones} center={center} route={mapRoute} />
        {routeMemberName && (
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-white/95 backdrop-blur-sm border border-loopy-100 shadow-card rounded-full pl-3 pr-1.5 py-1.5">
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
        )}
      </div>

      <div className="bg-white border-t border-loopy-100 rounded-t-2xl -mt-4 relative z-10 p-4 shadow-[0_-8px_28px_rgba(35,42,82,0.10)]">
        <h2 className="font-bold text-loopy-900 mb-3">Tu familia</h2>
        <div className="flex gap-3 overflow-x-auto pb-1 mb-4">
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
        <div className="grid grid-cols-2 gap-3">
          <Link
            href={`/loop/${loopId}/mapa/zonas`}
            className="flex items-center justify-center gap-2 py-2.5 rounded-full border border-loopy-100 text-sm font-semibold text-loopy-900 hover:border-bridge/40 transition-colors"
          >
            <ShieldCheck size={16} className="text-bridge" />
            Zonas
          </Link>
          <Link
            href={`/loop/${loopId}/sos`}
            className="flex items-center justify-center gap-2 py-2.5 rounded-full bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            <Siren size={16} />
            SOS
          </Link>
        </div>
      </div>
    </div>
  );
}
