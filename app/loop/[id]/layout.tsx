"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Settings } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { haversineMeters } from "@/lib/geo";
import { NavbarLogo } from "@/components/LoopyLogo";
import type { MapMember } from "@/components/LiveMap";
import type { Loop, LoopMember, MemberRole, SafeZone, SpeedAlert, SubscriptionStatus } from "@/lib/types";
import { hasLoopAccess } from "@/lib/types";
import BottomTabBar from "@/components/loop/BottomTabBar";
import { LoopContext, type LoopContextValue, type ZoneEventRow } from "./LoopContext";

export default function LoopLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const loopId = params.id as string;
  const pathname = usePathname();

  const [userId, setUserId] = useState<string | null>(null);
  const [loop, setLoop] = useState<Loop | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [members, setMembers] = useState<LoopMember[]>([]);
  const [mapMembers, setMapMembers] = useState<Record<string, MapMember>>({});
  const [zones, setZones] = useState<SafeZone[]>([]);
  const [events, setEvents] = useState<ZoneEventRow[]>([]);
  const [speedAlerts, setSpeedAlerts] = useState<SpeedAlert[]>([]);
  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);
  const [sosIncoming, setSosIncoming] = useState<{
    name: string;
    lat: number;
    lng: number;
  } | null>(null);

  const [routeUserId, setRouteUserId] = useState<string | null>(null);
  const [routePoints, setRoutePoints] = useState<{ lat: number; lng: number }[]>([]);
  const [routeLoading, setRouteLoading] = useState(false);

  const insideZonesRef = useRef<Record<string, boolean>>({});
  const lastInsertRef = useRef<number>(0);
  const lastSpeedAlertRef = useRef<number>(0);
  const lastPosForSpeedRef = useRef<{ lat: number; lng: number; t: number } | null>(null);

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

  async function loadLoopData(uid: string) {
    const { data: loopData } = await supabase
      .from("loops")
      .select("*")
      .eq("id", loopId)
      .single();
    setLoop(loopData);

    const { data: subRow } = await supabase
      .from("loop_subscriptions")
      .select("status")
      .eq("loop_id", loopId)
      .maybeSingle();
    setSubscriptionStatus((subRow?.status as SubscriptionStatus | undefined) ?? null);

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
        const memberRow = (memberRows as any[] | null)?.find((m) => m.user_id === row.user_id);
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

  useEffect(() => {
    if (!loopId) return;
    const channel = supabase
      .channel(`locations-${loopId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "locations", filter: `loop_id=eq.${loopId}` },
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

  useEffect(() => {
    if (!loopId) return;
    const channel = supabase
      .channel(`sos-${loopId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sos_alerts", filter: `loop_id=eq.${loopId}` },
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

  useEffect(() => {
    if (!loopId) return;
    const channel = supabase
      .channel(`speed-${loopId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "speed_alerts", filter: `loop_id=eq.${loopId}` },
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

  useEffect(() => {
    if (!loopId) return;
    const channel = supabase
      .channel(`zones-${loopId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "safe_zones", filter: `loop_id=eq.${loopId}` },
        (payload) => {
          const row = payload.new as SafeZone;
          setZones((prev) => (prev.some((z) => z.id === row.id) ? prev : [...prev, row]));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loopId]);

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
          await supabase.from("locations").insert({ user_id: userId, loop_id: loopId, lat, lng });
        }

        for (const zone of zones) {
          const dist = haversineMeters(lat, lng, zone.lat, zone.lng);
          const isInside = dist <= zone.radius_m;
          const wasInside = insideZonesRef.current[zone.id] ?? false;
          if (isInside !== wasInside) {
            insideZonesRef.current[zone.id] = isInside;
            const eventType = isInside ? "enter" : "exit";
            setBanner(`${isInside ? "Entraste a" : "Saliste de"} la zona "${zone.name}"`);
            await supabase.from("zone_events").insert({ zone_id: zone.id, user_id: userId, event_type: eventType });
          }
        }

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

  useEffect(() => {
    if (loading || !loop) return;
    const onSuscripcion = pathname === `/loop/${loopId}/suscripcion`;
    if (!onSuscripcion && !hasLoopAccess(subscriptionStatus)) {
      router.replace(`/loop/${loopId}/suscripcion`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, loop, subscriptionStatus, pathname, loopId]);

  async function addZone(name: string, radiusM: number): Promise<{ error: string | null }> {
    if (!myPos) return { error: "Esperando tu ubicación para crear la zona..." };
    const { data, error } = await supabase
      .from("safe_zones")
      .insert({ loop_id: loopId, name, lat: myPos.lat, lng: myPos.lng, radius_m: radiusM, created_by: userId })
      .select()
      .single();
    if (error || !data) return { error: error?.message || "No se pudo crear la zona" };
    setZones((prev) => [...prev, data]);
    return { error: null };
  }

  async function saveAge(age: number): Promise<void> {
    if (!userId) return;
    await supabase.from("profiles").update({ age }).eq("id", userId);
    await loadLoopData(userId);
  }

  async function saveLoopSettings(
    speedLimitKmh: number | null,
    emergencyNumber: string | null,
    primaryContactNumber: string | null
  ): Promise<{ error: string | null }> {
    const { data, error } = await supabase
      .from("loops")
      .update({
        speed_limit_kmh: speedLimitKmh,
        emergency_number: emergencyNumber,
        primary_contact_number: primaryContactNumber,
      })
      .eq("id", loopId)
      .select()
      .single();
    if (error || !data) return { error: error?.message || "No se pudo guardar" };
    setLoop(data);
    return { error: null };
  }

  async function addPendingMember(
    name: string,
    phone: string,
    colorSlug: string,
    role: MemberRole
  ): Promise<{ error: string | null }> {
    const alreadyExists = members.some(
      (m) => m.pending_phone === phone || m.profiles?.phone === phone
    );
    if (alreadyExists) {
      return { error: "Ese teléfono ya es miembro de este Loopy." };
    }
    const { data, error } = await supabase
      .from("loop_members")
      .insert({
        loop_id: loopId,
        user_id: null,
        role,
        pending_name: name,
        pending_phone: phone,
        member_color: colorSlug,
      })
      .select()
      .single();
    if (error || !data) return { error: error?.message || "No se pudo agregar el miembro" };
    setMembers((prev) => [...prev, data as LoopMember]);
    return { error: null };
  }

  async function updatePendingMemberPhone(
    memberId: string,
    phone: string
  ): Promise<{ error: string | null }> {
    const { data, error } = await supabase
      .from("loop_members")
      .update({ pending_phone: phone })
      .eq("id", memberId)
      .is("user_id", null)
      .select()
      .single();
    if (error || !data) return { error: error?.message || "No se pudo actualizar el teléfono" };
    setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, pending_phone: phone } : m)));
    return { error: null };
  }

  async function cancelPendingMember(memberId: string): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from("loop_members")
      .delete()
      .eq("id", memberId)
      .is("user_id", null);
    if (error) return { error: error.message };
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    return { error: null };
  }

  function toggleRoute(uid: string) {
    if (routeUserId === uid) {
      setRouteUserId(null);
      setRoutePoints([]);
      return;
    }
    setRouteUserId(uid);
    setRoutePoints([]);
    setRouteLoading(true);
    router.push(`/loop/${loopId}/mapa`);
    (async () => {
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
    })();
  }

  if (loading || !loop || !userId) {
    return (
      <main className="min-h-screen flex items-center justify-center text-loopy-700">
        Cargando Loopy...
      </main>
    );
  }

  const myAge = members.find((m) => m.user_id === userId)?.profiles?.age ?? null;

  const value: LoopContextValue = {
    loopId,
    userId,
    loop,
    members,
    isAdmin: loop.admin_id === userId,
    subscriptionStatus,
    zones,
    mapMembers,
    events,
    speedAlerts,
    myPos,
    myAge,
    routeUserId,
    routePoints,
    routeLoading,
    toggleRoute,
    addZone,
    saveAge,
    saveLoopSettings,
    addPendingMember,
    updatePendingMemberPhone,
    cancelPendingMember,
  };

  return (
    <LoopContext.Provider value={value}>
      <main className="relative min-h-screen flex flex-col md:flex-row bg-loopy-50/40">
        <div className="flex flex-col flex-1 min-w-0">
          <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-loopy-100 bg-white/80 backdrop-blur-md">
            <Link href="/dashboard" aria-label="Volver a Mis Loopys">
              <NavbarLogo size={26} />
            </Link>
            <Link
              href={`/loop/${loopId}/ajustes`}
              aria-label="Ajustes del Loopy"
              className="w-9 h-9 rounded-full flex items-center justify-center text-loopy-700 hover:bg-loopy-50 hover:text-loopy-900 transition-colors"
            >
              <Settings size={18} />
            </Link>
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
                <div className="max-w-md mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2 md:max-w-3xl">
                  <span className="font-semibold text-sm">🆘 Alerta de {sosIncoming.name} — necesita ayuda</span>
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

          <div className="relative z-0 flex-1 max-w-md mx-auto w-full flex flex-col md:max-w-3xl md:mx-0 md:px-8 lg:px-10">{children}</div>
        </div>

        <BottomTabBar loopId={loopId} />
      </main>
    </LoopContext.Provider>
  );
}
