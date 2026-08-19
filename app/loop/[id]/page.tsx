"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  MapPin,
  LogIn,
  LogOut as LogOutIcon,
  Siren,
  Gauge,
  Route as RouteIcon,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { haversineMeters } from "@/lib/geo";
import type { Loop, LoopMember, SafeZone, SpeedAlert } from "@/lib/types";
import type { MapMember, MapRoute, MapZone } from "@/components/LiveMap";
import { fadeInUp, staggerContainer } from "@/lib/motion";

const ROUTE_COLOR = "#ec6fc9";

const LiveMap = dynamic(() => import("@/components/LiveMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center text-loopy-700">
      Cargando mapa...
    </div>
  ),
});

interface ZoneEventRow {
  id: string;
  event_type: "enter" | "exit";
  created_at: string;
  user_id: string;
  safe_zones: { name: string } | null;
}

function roleLabel(role: string) {
  switch (role) {
    case "admin":
      return "Admin";
    case "supervisor":
      return "Supervisor";
    case "tracked":
      return "Comparte";
    case "member":
      return "Miembro";
    default:
      return role;
  }
}

export default function LoopPage() {
  const params = useParams();
  const router = useRouter();
  const loopId = params.id as string;

  const [userId, setUserId] = useState<string | null>(null);
  const [loop, setLoop] = useState<Loop | null>(null);
  const [members, setMembers] = useState<LoopMember[]>([]);
  const [mapMembers, setMapMembers] = useState<Record<string, MapMember>>({});
  const [zones, setZones] = useState<SafeZone[]>([]);
  const [events, setEvents] = useState<ZoneEventRow[]>([]);
  const [speedAlerts, setSpeedAlerts] = useState<SpeedAlert[]>([]);
  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [zoneName, setZoneName] = useState("");
  const [zoneRadius, setZoneRadius] = useState(150);
  const [banner, setBanner] = useState<string | null>(null);
  const [sosIncoming, setSosIncoming] = useState<{
    name: string;
    lat: number;
    lng: number;
  } | null>(null);

  const [ageInput, setAgeInput] = useState("");
  const [speedLimitInput, setSpeedLimitInput] = useState("");
  const [emergencyNumberInput, setEmergencyNumberInput] = useState("");

  const [holdPct, setHoldPct] = useState(0);
  const [sosSent, setSosSent] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [routeUserId, setRouteUserId] = useState<string | null>(null);
  const [routePoints, setRoutePoints] = useState<{ lat: number; lng: number }[]>([]);
  const [routeLoading, setRouteLoading] = useState(false);

  const insideZonesRef = useRef<Record<string, boolean>>({});
  const lastInsertRef = useRef<number>(0);
  const lastSpeedAlertRef = useRef<number>(0);
  const lastPosForSpeedRef = useRef<{
    lat: number;
    lng: number;
    t: number;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/login");
        return;
      }
      setUserId(userData.user.id);
      await loadLoopData(userData.user.id);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loopId]);

  useEffect(() => {
    if (loop) {
      setSpeedLimitInput(loop.speed_limit_kmh?.toString() || "");
      setEmergencyNumberInput(loop.emergency_number || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop?.id]);

  async function loadLoopData(uid: string) {
    const { data: loopData } = await supabase
      .from("loops")
      .select("*")
      .eq("id", loopId)
      .single();
    setLoop(loopData);

    const { data: memberRows } = await supabase
      .from("loop_members")
      .select("*, profiles!loop_members_user_id_fkey(id, name, avatar_url, age)")
      .eq("loop_id", loopId);
    setMembers((memberRows as unknown as LoopMember[]) || []);

    const { data: zoneRows } = await supabase
      .from("safe_zones")
      .select("*")
      .eq("loop_id", loopId);
    setZones(zoneRows || []);

    const { data: recentLocations } = await supabase
      .from("locations")
      .select("*")
      .eq("loop_id", loopId)
      .order("recorded_at", { ascending: false })
      .limit(200);

    const latest: Record<string, MapMember> = {};
    for (const row of recentLocations || []) {
      if (!latest[row.user_id]) {
        const memberRow = (memberRows as any[] | null)?.find(
          (m) => m.user_id === row.user_id
        );
        latest[row.user_id] = {
          userId: row.user_id,
          name: memberRow?.profiles?.name || "Miembro",
          lat: row.lat,
          lng: row.lng,
          isMe: row.user_id === uid,
        };
      }
    }
    setMapMembers(latest);

    const { data: eventRows } = await supabase
      .from("zone_events")
      .select("id, event_type, created_at, user_id, safe_zones(name)")
      .eq("safe_zones.loop_id", loopId)
      .order("created_at", { ascending: false })
      .limit(20);
    setEvents((eventRows as unknown as ZoneEventRow[]) || []);

    const { data: speedRows } = await supabase
      .from("speed_alerts")
      .select("*")
      .eq("loop_id", loopId)
      .order("created_at", { ascending: false })
      .limit(20);
    setSpeedAlerts(speedRows || []);
  }

  // Realtime: escuchar nuevas ubicaciones del Loop
  useEffect(() => {
    if (!loopId) return;
    const channel = supabase
      .channel(`locations-${loopId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "locations",
          filter: `loop_id=eq.${loopId}`,
        },
        (payload) => {
          const row = payload.new as any;
          setMapMembers((prev) => {
            const memberInfo = members.find((m) => m.user_id === row.user_id);
            return {
              ...prev,
              [row.user_id]: {
                userId: row.user_id,
                name: memberInfo?.profiles?.name || "Miembro",
                lat: row.lat,
                lng: row.lng,
                isMe: row.user_id === userId,
              },
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loopId, members, userId]);

  // Realtime: alertas SOS de otros miembros del Loop
  useEffect(() => {
    if (!loopId) return;
    const channel = supabase
      .channel(`sos-${loopId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sos_alerts",
          filter: `loop_id=eq.${loopId}`,
        },
        (payload) => {
          const row = payload.new as any;
          if (row.user_id === userId) return;
          const memberInfo = members.find((m) => m.user_id === row.user_id);
          setSosIncoming({
            name: memberInfo?.profiles?.name || "Alguien del Loopy",
            lat: row.lat,
            lng: row.lng,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loopId, members, userId]);

  // Realtime: alertas de velocidad de otros miembros del Loop
  useEffect(() => {
    if (!loopId) return;
    const channel = supabase
      .channel(`speed-${loopId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "speed_alerts",
          filter: `loop_id=eq.${loopId}`,
        },
        (payload) => {
          const row = payload.new as SpeedAlert;
          setSpeedAlerts((prev) => [row, ...prev].slice(0, 20));
          if (row.user_id !== userId) {
            const memberInfo = members.find((m) => m.user_id === row.user_id);
            setBanner(
              `${memberInfo?.profiles?.name || "Alguien"} superó el límite de velocidad (${Math.round(
                row.speed_kmh
              )} km/h)`
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loopId, members, userId]);

  // Geolocalización propia + push a Supabase + chequeo de zonas y velocidad
  useEffect(() => {
    if (!userId || !loopId || typeof window === "undefined") return;
    if (!("geolocation" in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setMyPos({ lat, lng });

        const now = Date.now();
        if (now - lastInsertRef.current > 10000) {
          lastInsertRef.current = now;
          await supabase
            .from("locations")
            .insert({ user_id: userId, loop_id: loopId, lat, lng });
        }

        for (const zone of zones) {
          const dist = haversineMeters(lat, lng, zone.lat, zone.lng);
          const isInside = dist <= zone.radius_m;
          const wasInside = insideZonesRef.current[zone.id] ?? false;
          if (isInside !== wasInside) {
            insideZonesRef.current[zone.id] = isInside;
            const eventType = isInside ? "enter" : "exit";
            setBanner(
              `${isInside ? "Entraste a" : "Saliste de"} la zona "${zone.name}"`
            );
            await supabase.from("zone_events").insert({
              zone_id: zone.id,
              user_id: userId,
              event_type: eventType,
            });
          }
        }

        // Velocidad: usamos coords.speed (m/s) si el dispositivo lo provee;
        // si no, la calculamos a partir de la posición anterior.
        let speedKmh: number | null = null;
        if (typeof pos.coords.speed === "number" && pos.coords.speed >= 0) {
          speedKmh = pos.coords.speed * 3.6;
        } else if (lastPosForSpeedRef.current) {
          const prev = lastPosForSpeedRef.current;
          const dtSec = (pos.timestamp - prev.t) / 1000;
          if (dtSec > 1) {
            const distM = haversineMeters(prev.lat, prev.lng, lat, lng);
            speedKmh = (distM / dtSec) * 3.6;
          }
        }
        lastPosForSpeedRef.current = { lat, lng, t: pos.timestamp };

        if (
          speedKmh !== null &&
          loop?.speed_limit_kmh &&
          speedKmh > loop.speed_limit_kmh &&
          now - lastSpeedAlertRef.current > 120000
        ) {
          lastSpeedAlertRef.current = now;
          await supabase.from("speed_alerts").insert({
            loop_id: loopId,
            user_id: userId,
            speed_kmh: speedKmh,
            limit_kmh: loop.speed_limit_kmh,
            lat,
            lng,
          });
        }
      },
      () => {
        // permiso denegado o error de geolocalización: no rompemos la app
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [userId, loopId, zones, loop?.speed_limit_kmh]);

  async function handleAddZone(e: React.FormEvent) {
    e.preventDefault();
    if (!myPos) {
      setBanner("Esperando tu ubicación para crear la zona...");
      return;
    }
    const { data, error } = await supabase
      .from("safe_zones")
      .insert({
        loop_id: loopId,
        name: zoneName,
        lat: myPos.lat,
        lng: myPos.lng,
        radius_m: zoneRadius,
        created_by: userId,
      })
      .select()
      .single();
    if (!error && data) {
      setZones((prev) => [...prev, data]);
      setZoneName("");
    }
  }

  async function handleSaveAge(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !ageInput) return;
    await supabase
      .from("profiles")
      .update({ age: Number(ageInput) })
      .eq("id", userId);
    setAgeInput("");
    await loadLoopData(userId);
  }

  async function handleSaveLoopSettings(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase
      .from("loops")
      .update({
        speed_limit_kmh: speedLimitInput ? Number(speedLimitInput) : null,
        emergency_number: emergencyNumberInput || null,
      })
      .eq("id", loopId)
      .select()
      .single();
    if (!error && data) setLoop(data);
  }

  async function handleToggleRoute(uid: string) {
    if (routeUserId === uid) {
      setRouteUserId(null);
      setRoutePoints([]);
      return;
    }
    setRouteUserId(uid);
    setRoutePoints([]);
    setRouteLoading(true);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("locations")
      .select("lat, lng, recorded_at")
      .eq("loop_id", loopId)
      .eq("user_id", uid)
      .gte("recorded_at", startOfDay.toISOString())
      .order("recorded_at", { ascending: true })
      .limit(1000);
    setRoutePoints((data || []).map((r) => ({ lat: r.lat, lng: r.lng })));
    setRouteLoading(false);
  }

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
    setTimeout(() => {
      setSosSent(false);
      setHoldPct(0);
    }, 4000);
  }

  if (loading || !loop) {
    return (
      <main className="min-h-screen flex items-center justify-center text-loopy-700">
        Cargando Loopy...
      </main>
    );
  }

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
    : [40.4168, -3.7038]; // fallback Madrid

  const myAge = members.find((m) => m.user_id === userId)?.profiles?.age;

  type HistoryItem =
    | { kind: "zone"; id: string; time: string; text: string; positive: boolean; userId: string }
    | { kind: "speed"; id: string; time: string; text: string; userId: string };

  const historyItems: HistoryItem[] = [
    ...events.map(
      (ev): HistoryItem => ({
        kind: "zone",
        id: ev.id,
        time: ev.created_at,
        text: `${ev.event_type === "enter" ? "Entró a" : "Salió de"} ${
          ev.safe_zones?.name || "zona"
        }`,
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

  const routeMemberName = routeUserId
    ? members.find((m) => m.user_id === routeUserId)?.profiles?.name || "Miembro"
    : null;
  const mapRoute: MapRoute | null = routeUserId
    ? { color: ROUTE_COLOR, points: routePoints }
    : null;

  return (
    <main className="relative min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-loopy-100 bg-white/80 backdrop-blur-md">
        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-loopy-700 text-sm font-medium hover:text-loopy-900 transition-colors"
        >
          <ArrowLeft size={15} />
          Mis Loopys
        </Link>
        <div className="text-center">
          <h1 className="font-bold text-loopy-900">{loop.name}</h1>
          <span className="text-xs text-loopy-700/70">
            {loop.mode === "mirror" ? "Modo Espejo" : "Modo Supervisión"} ·
            Código {loop.invite_code}
          </span>
        </div>
        <span className="w-16" />
      </header>

      <AnimatePresence>
        {sosIncoming && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="relative z-20 overflow-hidden bg-red-600 text-white"
          >
            <div className="max-w-3xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-sm">
                🆘 Alerta de {sosIncoming.name} — necesita ayuda
              </span>
              <div className="flex items-center gap-2">
                {loop.emergency_number && (
                  <a
                    href={`tel:${loop.emergency_number}`}
                    className="px-3 py-1.5 rounded-full bg-white text-red-600 text-xs font-bold"
                  >
                    Llamar a emergencias
                  </a>
                )}
                <button
                  onClick={() => setSosIncoming(null)}
                  className="px-3 py-1.5 rounded-full border border-white/40 text-xs font-semibold"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {banner && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="relative z-10 overflow-hidden bg-gradient-to-r from-loopy-700 via-bridge to-glow-500 text-white text-sm text-center shadow-[0_4px_16px_rgba(131,76,156,0.35)]"
          >
            <div className="py-2">{banner}</div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-0 flex-1 grid md:grid-cols-3 gap-4 p-4">
        <div className="relative md:col-span-2 h-[420px] md:h-auto rounded-xl overflow-hidden border border-loopy-100 shadow-card">
          <LiveMap members={memberList} zones={mapZones} center={center} route={mapRoute} />
          {routeMemberName && (
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-white/95 backdrop-blur-sm border border-loopy-100 shadow-card rounded-full pl-3 pr-1.5 py-1.5">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: ROUTE_COLOR }}
              />
              <span className="text-xs font-medium text-loopy-900">
                {routeLoading
                  ? `Cargando recorrido de ${routeMemberName}...`
                  : routePoints.length > 1
                  ? `Recorrido de ${routeMemberName} · hoy`
                  : `Sin movimiento registrado hoy para ${routeMemberName}`}
              </span>
              <button
                onClick={() => handleToggleRoute(routeUserId as string)}
                aria-label="Cerrar recorrido"
                className="w-5 h-5 rounded-full flex items-center justify-center text-loopy-700/60 hover:bg-loopy-50 hover:text-loopy-900"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>

        <motion.div
          variants={staggerContainer(0.08)}
          initial="hidden"
          animate="show"
          className="space-y-4"
        >
          <motion.div
            variants={fadeInUp}
            className="bg-white rounded-xl border border-red-100 shadow-card p-4"
          >
            <h2 className="font-bold text-loopy-900 mb-1 flex items-center gap-1.5">
              <Siren size={16} className="text-red-600" />
              Botón SOS
            </h2>
            <p className="text-xs text-loopy-700/70 mb-3">
              Mantén presionado para avisar a todo el Loopy y compartir tu
              ubicación exacta.
            </p>
            <button
              onMouseDown={startHold}
              onMouseUp={cancelHold}
              onMouseLeave={cancelHold}
              onTouchStart={startHold}
              onTouchEnd={cancelHold}
              disabled={sosSent}
              className="relative w-full overflow-hidden rounded-full bg-red-600 text-white font-bold py-3 select-none disabled:opacity-90"
            >
              <div
                className="absolute inset-y-0 left-0 bg-white/25"
                style={{ width: `${holdPct}%`, transition: "width 20ms linear" }}
              />
              <span className="relative text-sm">
                {sosSent ? "Alerta enviada ✓" : "Mantén presionado — SOS"}
              </span>
            </button>
          </motion.div>

          <motion.div variants={fadeInUp} className="bg-white rounded-xl border border-loopy-100 shadow-card p-4">
            <h2 className="font-bold text-loopy-900 mb-2">Miembros</h2>
            <ul className="text-sm space-y-1">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-loopy-700">
                  <span className="min-w-0 truncate">
                    {m.profiles?.name || "Miembro"}
                    {m.profiles?.age ? ` · ${m.profiles.age} años` : ""}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-bridge font-medium">
                      {roleLabel(m.role)}
                    </span>
                    <button
                      onClick={() => handleToggleRoute(m.user_id)}
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
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-bridge/10 text-bridge text-xs font-semibold shrink-0"
                >
                  Guardar
                </button>
              </form>
            )}
          </motion.div>

          <motion.form
            variants={fadeInUp}
            onSubmit={handleAddZone}
            className="bg-white rounded-xl border border-loopy-100 shadow-card p-4"
          >
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
            <p className="text-xs text-loopy-700/60 mb-3">
              Se crea centrada en tu ubicación actual.
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="w-full py-2 rounded-full bg-gradient-to-r from-loopy-700 via-bridge to-glow-500 text-white text-sm font-semibold shadow-cta hover:shadow-cta-hover"
            >
              Crear zona
            </motion.button>
          </motion.form>

          <motion.div variants={fadeInUp} className="bg-white rounded-xl border border-loopy-100 shadow-card p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-loopy-900">
                {routeMemberName ? `Historial de ${routeMemberName}` : "Historial"}
              </h2>
              {routeUserId && (
                <button
                  onClick={() => handleToggleRoute(routeUserId)}
                  className="text-xs font-medium text-bridge hover:text-loopy-900"
                >
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
            <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
              {historyItems.length === 0 && (
                <li className="text-loopy-700/60">
                  {routeMemberName
                    ? `Sin eventos de ${routeMemberName} todavía.`
                    : "Sin eventos todavía."}
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
          </motion.div>

          {loop.admin_id === userId && (
            <motion.form
              variants={fadeInUp}
              onSubmit={handleSaveLoopSettings}
              className="bg-white rounded-xl border border-loopy-100 shadow-card p-4"
            >
              <h2 className="font-bold text-loopy-900 mb-2">
                Configuración del Loopy
              </h2>
              <label className="block text-xs text-loopy-700/70 mb-1">
                Límite de velocidad (km/h)
              </label>
              <input
                type="number"
                min={0}
                placeholder="Ej. 120"
                className="w-full mb-3 px-3 py-2 rounded-lg border border-loopy-50 text-sm focus:outline-none focus:ring-2 focus:ring-bridge/60"
                value={speedLimitInput}
                onChange={(e) => setSpeedLimitInput(e.target.value)}
              />
              <label className="block text-xs text-loopy-700/70 mb-1">
                Número de emergencia
              </label>
              <input
                type="tel"
                placeholder="Ej. 911"
                className="w-full mb-3 px-3 py-2 rounded-lg border border-loopy-50 text-sm focus:outline-none focus:ring-2 focus:ring-bridge/60"
                value={emergencyNumberInput}
                onChange={(e) => setEmergencyNumberInput(e.target.value)}
              />
              <button
                type="submit"
                className="w-full py-2 rounded-full bg-loopy-900 text-white text-sm font-semibold shadow-[0_8px_24px_rgba(35,42,82,0.35)] hover:shadow-[0_10px_32px_rgba(35,42,82,0.5)]"
              >
                Guardar
              </button>
            </motion.form>
          )}
        </motion.div>
      </div>
    </main>
  );
}
