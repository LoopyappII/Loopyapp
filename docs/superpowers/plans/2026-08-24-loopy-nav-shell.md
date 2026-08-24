# Loopy Nav Shell (Fase 0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single 870-line `app/loop/[id]/page.tsx` with a nested-route tab shell (Mapa/Familia/Rutas/SOS + Zonas + Ajustes) that reorganizes existing, already-working functionality into the navigation structure the client already approved — no new data fields, no new features.

**Architecture:** A shared client layout (`app/loop/[id]/layout.tsx`) owns auth, data loading, the 4 Realtime subscriptions, and geolocation tracking, and exposes everything through a `LoopContext`. Six route segments (`mapa`, `mapa/zonas`, `familia`, `rutas`, `sos`, `ajustes`) each render one screen by consuming that context. `app/dashboard/page.tsx` gets a visual-only restyle to match. A committed Playwright E2E suite verifies nothing regressed.

**Tech Stack:** Next.js 14 App Router, React 18, Supabase JS v2 (Postgres + Realtime + Auth), Tailwind CSS, framer-motion, lucide-react, @react-google-maps/api. No unit-test runner exists in this repo (no Jest/RTL) — the established regression method here is manual Playwright E2E, added at the end of this plan as a committed suite.

**Spec:** `docs/superpowers/specs/2026-08-24-loopy-nav-shell-design.md`

## Global Constraints

- Zero Supabase schema changes in this plan.
- Zero new features (no roles/relación/permisos, no zone-type icons, no reverse geocoding, no paginated timeline) — those are future phases 1-4, out of scope here.
- Every Realtime subscription and the geolocation `watchPosition` must keep running regardless of which tab is active — they live in `layout.tsx`, not in per-tab pages.
- Preserve every current behavior exactly unless this plan explicitly calls out a deliberate placement change (e.g. Loop name/invite code moving from the old sticky header into `ajustes/page.tsx`).
- Brand tokens only: `loopy-{50,100,500,600,700,900}`, `glow-{400,500,600}`, `bridge` (see `tailwind.config.ts`) — no new colors.
- Existing single-file `app/loop/[id]/page.tsx` is deleted once its content is fully redistributed (Task 12).

---

### Task 1: `BottomTabBar` component

**Files:**
- Create: `components/loop/BottomTabBar.tsx`

**Interfaces:**
- Consumes: nothing (pure presentational, no context dependency — reviewable standalone).
- Produces: `export default function BottomTabBar({ loopId }: { loopId: string })`, rendering 4 `Link`s to `/loop/${loopId}/{mapa,familia,rutas,sos}`. Task 3 (`layout.tsx`) renders `<BottomTabBar loopId={loopId} />`.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPin, Users, Route as RouteIcon, Siren } from "lucide-react";

const TABS = [
  { key: "mapa", label: "Mapa", Icon: MapPin },
  { key: "familia", label: "Familia", Icon: Users },
  { key: "rutas", label: "Rutas", Icon: RouteIcon },
  { key: "sos", label: "SOS", Icon: Siren },
] as const;

export default function BottomTabBar({ loopId }: { loopId: string }) {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-20 bg-white/95 backdrop-blur-md border-t border-loopy-100 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-md mx-auto grid grid-cols-4">
        {TABS.map(({ key, label, Icon }) => {
          const href = `/loop/${loopId}/${key}`;
          const active = pathname?.startsWith(href) ?? false;
          return (
            <Link
              key={key}
              href={href}
              className={`flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                active ? "text-bridge" : "text-loopy-700/60 hover:text-loopy-900"
              }`}
            >
              <Icon size={20} className={active ? "text-glow-600" : ""} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `BottomTabBar.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/loop/BottomTabBar.tsx
git commit -m "feat: add BottomTabBar component for loop nav shell"
```

---

### Task 2: `LoopContext`

**Files:**
- Create: `app/loop/[id]/LoopContext.tsx`

**Interfaces:**
- Consumes: `Loop`, `LoopMember`, `SafeZone`, `SpeedAlert` from `@/lib/types`; `MapMember` from `@/components/LiveMap`.
- Produces: `LoopContext` (React context), `useLoop()` hook, `LoopContextValue` type, `ZoneEventRow` type, `roleLabel(role: string)` helper. Task 3 provides the value; Tasks 5-10 consume via `useLoop()`.

- [ ] **Step 1: Write the file**

```tsx
"use client";

import { createContext, useContext } from "react";
import type { Loop, LoopMember, SafeZone, SpeedAlert } from "@/lib/types";
import type { MapMember } from "@/components/LiveMap";

export interface ZoneEventRow {
  id: string;
  event_type: "enter" | "exit";
  created_at: string;
  user_id: string;
  safe_zones: { name: string } | null;
}

export function roleLabel(role: string) {
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

export interface LoopContextValue {
  loopId: string;
  userId: string;
  loop: Loop;
  members: LoopMember[];
  isAdmin: boolean;
  zones: SafeZone[];
  mapMembers: Record<string, MapMember>;
  events: ZoneEventRow[];
  speedAlerts: SpeedAlert[];
  myPos: { lat: number; lng: number } | null;
  myAge: number | null;
  routeUserId: string | null;
  routePoints: { lat: number; lng: number }[];
  routeLoading: boolean;
  toggleRoute: (uid: string) => void;
  addZone: (name: string, radiusM: number) => Promise<{ error: string | null }>;
  saveAge: (age: number) => Promise<void>;
  saveLoopSettings: (
    speedLimitKmh: number | null,
    emergencyNumber: string | null
  ) => Promise<{ error: string | null }>;
}

export const LoopContext = createContext<LoopContextValue | null>(null);

export function useLoop(): LoopContextValue {
  const ctx = useContext(LoopContext);
  if (!ctx) {
    throw new Error("useLoop debe usarse dentro de app/loop/[id]/layout.tsx");
  }
  return ctx;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `LoopContext.tsx` (will still show errors from files not yet created in later tasks — ignore those for now).

- [ ] **Step 3: Commit**

```bash
git add app/loop/[id]/LoopContext.tsx
git commit -m "feat: add LoopContext type/hook for loop nav shell"
```

---

### Task 3: `app/loop/[id]/layout.tsx`

**Files:**
- Create: `app/loop/[id]/layout.tsx`

**Interfaces:**
- Consumes: `BottomTabBar` (Task 1) as `<BottomTabBar loopId={loopId} />`; `LoopContext`/`useLoop`/`LoopContextValue`/`ZoneEventRow` (Task 2) from `./LoopContext`; `NavbarLogo` from `@/components/LoopyLogo`; `supabase` from `@/lib/supabaseClient`; `haversineMeters` from `@/lib/geo`.
- Produces: the `LoopContext.Provider` wrapping `{children}` — every task from 5-10 depends on this being mounted to call `useLoop()`. Renders header (logo → `/dashboard`, gear → `/loop/${loopId}/ajustes`), the `sosIncoming` red banner, the `banner` gradient banner, and `<BottomTabBar />`.

- [ ] **Step 1: Write the file**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Settings } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { haversineMeters } from "@/lib/geo";
import { NavbarLogo } from "@/components/LoopyLogo";
import type { MapMember } from "@/components/LiveMap";
import type { Loop, LoopMember, SafeZone, SpeedAlert } from "@/lib/types";
import BottomTabBar from "@/components/loop/BottomTabBar";
import { LoopContext, type LoopContextValue, type ZoneEventRow } from "./LoopContext";

export default function LoopLayout({ children }: { children: React.ReactNode }) {
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
    emergencyNumber: string | null
  ): Promise<{ error: string | null }> {
    const { data, error } = await supabase
      .from("loops")
      .update({ speed_limit_kmh: speedLimitKmh, emergency_number: emergencyNumber })
      .eq("id", loopId)
      .select()
      .single();
    if (error || !data) return { error: error?.message || "No se pudo guardar" };
    setLoop(data);
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
  };

  return (
    <LoopContext.Provider value={value}>
      <main className="relative min-h-screen flex flex-col">
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
              <div className="max-w-md mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
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

        <div className="relative z-0 flex-1 max-w-md mx-auto w-full flex flex-col">{children}</div>

        <BottomTabBar loopId={loopId} />
      </main>
    </LoopContext.Provider>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: errors only from route pages not yet created (Tasks 5-10) — no errors inside `layout.tsx` itself.

- [ ] **Step 3: Commit**

```bash
git add app/loop/[id]/layout.tsx
git commit -m "feat: add shared LoopContext provider layout for loop nav shell"
```

---

### Task 4: Redirect page for `/loop/[id]`

**Files:**
- Create: `app/loop/[id]/page.tsx` (fresh file — the old 870-line one is deleted in Task 12, after its content is fully redistributed)

**Interfaces:**
- Consumes: `redirect` from `next/navigation`.
- Produces: nothing consumed elsewhere — this is a leaf redirect so old links/bookmarks to `/loop/[id]` (without a sub-path) keep working.

- [ ] **Step 1: Write the file**

```tsx
import { redirect } from "next/navigation";

export default function LoopIndexPage({ params }: { params: { id: string } }) {
  redirect(`/loop/${params.id}/mapa`);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/loop/[id]/page.tsx
git commit -m "feat: redirect /loop/[id] to /loop/[id]/mapa"
```

---

### Task 5: `mapa/page.tsx`

**Files:**
- Create: `app/loop/[id]/mapa/page.tsx`

**Interfaces:**
- Consumes: `useLoop()` (Task 2/3) for `mapMembers`, `zones`, `myPos`, `members`, `routeUserId`, `routePoints`, `routeLoading`, `toggleRoute`, `loopId`; `LiveMap` (default export) + `MapMember`/`MapZone`/`MapRoute` types from `@/components/LiveMap`.
- Produces: the `mapa` screen. No other task depends on this file's internals.

- [ ] **Step 1: Write the file**

```tsx
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
```

- [ ] **Step 2: Manual check**

Run: `npm run dev`, log in with a test account that belongs to a Loopy, navigate to `/loop/{id}/mapa`.
Expected: map renders, member avatars appear, tapping a member draws their route, "Zonas"/"SOS" buttons navigate correctly. No new console errors.

- [ ] **Step 3: Commit**

```bash
git add app/loop/[id]/mapa/page.tsx
git commit -m "feat: add mapa tab page for loop nav shell"
```

---

### Task 6: `mapa/zonas/page.tsx`

**Files:**
- Create: `app/loop/[id]/mapa/zonas/page.tsx`

**Interfaces:**
- Consumes: `useLoop()` for `zones`, `addZone`.
- Produces: the zone-creation form + a simple list of existing zones (name + radius only — icon-per-type is Phase 2, out of scope here).

- [ ] **Step 1: Write the file**

```tsx
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
```

- [ ] **Step 2: Manual check**

Run: `npm run dev`, navigate to `/loop/{id}/mapa/zonas`, create a zone.
Expected: zone appears in the list immediately, and also appears as a circle on `/loop/{id}/mapa` (via the shared `zones` state in context). No new console errors.

- [ ] **Step 3: Commit**

```bash
git add app/loop/[id]/mapa/zonas/page.tsx
git commit -m "feat: add zonas page under mapa tab"
```

---

### Task 7: `familia/page.tsx`

**Files:**
- Create: `app/loop/[id]/familia/page.tsx`

**Interfaces:**
- Consumes: `useLoop()` for `members`, `myAge`, `saveAge`, `routeUserId`, `toggleRoute`; `roleLabel` from `../LoopContext`.
- Produces: the Familia tab. No other task depends on this file's internals.

- [ ] **Step 1: Write the file**

```tsx
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
```

- [ ] **Step 2: Manual check**

Run: `npm run dev`, navigate to `/loop/{id}/familia`.
Expected: member list matches what the old side panel showed; saving age works; tapping the route icon navigates to Mapa with the route drawn.

- [ ] **Step 3: Commit**

```bash
git add app/loop/[id]/familia/page.tsx
git commit -m "feat: add familia tab page for loop nav shell"
```

---

### Task 8: `rutas/page.tsx`

**Files:**
- Create: `app/loop/[id]/rutas/page.tsx`

**Interfaces:**
- Consumes: `useLoop()` for `events`, `speedAlerts`, `routeUserId`, `toggleRoute`, `members`; `ZoneEventRow` type from `../LoopContext`.
- Produces: the Rutas tab (historial list). No other task depends on this file's internals.

- [ ] **Step 1: Write the file**

```tsx
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
```

- [ ] **Step 2: Manual check**

Run: `npm run dev`, navigate to `/loop/{id}/rutas`.
Expected: same history items the old side panel showed, filterable by `routeUserId` when a route is active.

- [ ] **Step 3: Commit**

```bash
git add app/loop/[id]/rutas/page.tsx
git commit -m "feat: add rutas tab page for loop nav shell"
```

---

### Task 9: `sos/page.tsx`

**Files:**
- Create: `app/loop/[id]/sos/page.tsx`

**Interfaces:**
- Consumes: `useLoop()` for `userId`, `loopId`, `myPos`; `supabase` from `@/lib/supabaseClient` directly (matches how `triggerSOS` worked in the original file — a direct insert, not routed through context, since it's local, self-contained UI behavior).
- Produces: the SOS tab. No other task depends on this file's internals.

- [ ] **Step 1: Write the file**

```tsx
"use client";

import { useRef, useState } from "react";
import { Siren } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useLoop } from "../LoopContext";

export default function SosPage() {
  const { userId, loopId, myPos } = useLoop();
  const [holdPct, setHoldPct] = useState(0);
  const [sosSent, setSosSent] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
```

- [ ] **Step 2: Manual check**

With two logged-in test users in the same Loopy (one on `/loop/{id}/sos`, the other on `/loop/{id}/familia`), hold the SOS button for 1.2s on the first.
Expected: the second user sees the red `sosIncoming` banner (rendered in `layout.tsx`, so it shows regardless of which tab they're on) with a working `tel:` link.

- [ ] **Step 3: Commit**

```bash
git add app/loop/[id]/sos/page.tsx
git commit -m "feat: add sos tab page for loop nav shell"
```

---

### Task 10: `ajustes/page.tsx`

**Files:**
- Create: `app/loop/[id]/ajustes/page.tsx`

**Interfaces:**
- Consumes: `useLoop()` for `loop`, `isAdmin`, `saveLoopSettings`.
- Produces: the settings screen. Also the new home for Loop name/mode/invite code display, which the old sticky header used to show — a deliberate placement change (see note below), not a removal.

**Design note:** the approved mockup's top header only shows the logo + gear icon, with no Loop name/mode/invite-code visible. The old single-page header showed `{loop.name}` / mode / `Código: {invite_code}` at all times. To match the mockup without losing that capability, this task moves that display into the Ajustes screen (one tap away via the gear icon) instead of dropping it.

- [ ] **Step 1: Write the file**

```tsx
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
      <div className="bg-white rounded-xl border border-loopy-100 shadow-card p-4">
        <h2 className="font-bold text-loopy-900 mb-1">{loop.name}</h2>
        <p className="text-xs text-loopy-700/70">
          {loop.mode === "mirror" ? "Modo Espejo" : "Modo Supervisión"} · Código: {loop.invite_code}
        </p>
      </div>

      {isAdmin ? (
        <form onSubmit={handleSave} className="bg-white rounded-xl border border-loopy-100 shadow-card p-4">
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
            className="w-full py-2 rounded-full bg-loopy-900 text-white text-sm font-semibold shadow-[0_8px_24px_rgba(35,42,82,0.35)] hover:shadow-[0_10px_32px_rgba(35,42,82,0.5)] disabled:opacity-60"
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
```

- [ ] **Step 2: Manual check**

As the Loopy's admin, navigate to `/loop/{id}/ajustes`, change speed limit and emergency number, save, reload.
Expected: values persist (matches `loops` table update). As a non-admin member, navigate to the same URL directly: form is replaced by the "solo el admin" message instead of a broken/empty form.

- [ ] **Step 3: Commit**

```bash
git add app/loop/[id]/ajustes/page.tsx
git commit -m "feat: add ajustes page for loop nav shell"
```

---

### Task 11: Point `/dashboard` at the new route and restyle it

**Files:**
- Modify: `app/dashboard/page.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing consumed elsewhere. This task only touches this one file.

- [ ] **Step 1: Update the Loopy link and restyle to match the shell**

In `app/dashboard/page.tsx`, replace the `Link` at line 176-191 (`href={`/loop/${loop.id}`}` → `/mapa`, plus visual restyle to a phone-width centered layout consistent with the new shell — no functional change to create/join logic):

```tsx
        {loops.length === 0 ? (
          <p className="text-loopy-700 mb-8">
            Todavía no formas parte de ningún Loopy. Crea uno o únete con un
            código de invitación.
          </p>
        ) : (
          <motion.ul
            variants={staggerContainer(0.08)}
            initial="hidden"
            animate="show"
            className="space-y-3 mb-10"
          >
            {loops.map((loop) => (
              <motion.li key={loop.id} variants={fadeInUp}>
                <Link
                  href={`/loop/${loop.id}/mapa`}
                  className="block bg-white rounded-xl border border-loopy-100 shadow-card p-4 hover:border-bridge/40 hover:shadow-card-hover transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-loopy-900">
                      {loop.name}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-bridge/10 text-bridge font-medium">
                      {loop.mode === "mirror" ? "Espejo" : "Supervisión"}
                    </span>
                  </div>
                  <span className="text-xs text-loopy-700/70">
                    Código: {loop.invite_code}
                  </span>
                </Link>
              </motion.li>
            ))}
          </motion.ul>
        )}
```

Also change the page's outer container (line 148, `className="relative z-10 px-6 py-8 max-w-3xl mx-auto"`) to `className="relative z-10 px-6 py-8 max-w-md mx-auto"`, and the two-column form grid (line 201, `className="grid md:grid-cols-2 gap-6"`) to `className="grid gap-6"` — both changes just narrow the layout to the same phone-width column used across `/loop/[id]/*`, no logic change.

- [ ] **Step 2: Manual check**

Run: `npm run dev`, log in, view `/dashboard`.
Expected: layout is a single centered phone-width column; clicking a Loopy card navigates to `/loop/{id}/mapa` and lands on the Mapa tab; create/join forms still work exactly as before.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "style: restyle dashboard to match loop nav shell, link to mapa tab"
```

---

### Task 12: Delete the old single-file loop page

**Files:**
- Delete: none of the content is left unmigrated by this point — verify, then delete the pre-refactor page if it still exists under a different name.

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

**Note:** Task 4 already replaced `app/loop/[id]/page.tsx` with the redirect version, so there is no separate old file left to delete — this task is a verification step, not a deletion of a `.old` copy.

- [ ] **Step 1: Confirm no leftover references to removed page**

Run: `grep -rn "app/loop/\[id\]/page" --include="*.tsx" --include="*.ts" . 2>/dev/null | grep -v node_modules`
Expected: no output (nothing imports the old page directly — Next.js route files are never imported elsewhere).

- [ ] **Step 2: Full production build**

Run: `npm run build`
Expected: build succeeds with no type errors, and the route list printed by Next.js includes `/loop/[id]`, `/loop/[id]/mapa`, `/loop/[id]/mapa/zonas`, `/loop/[id]/familia`, `/loop/[id]/rutas`, `/loop/[id]/sos`, `/loop/[id]/ajustes`.

- [ ] **Step 3: Commit (only if the build step required fixes)**

```bash
git add -A
git commit -m "fix: resolve build issues after loop nav shell split"
```

---

### Task 13: Playwright E2E regression suite

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/loop-nav-shell.spec.ts`
- Modify: `package.json` (add `@playwright/test` devDependency + `"test:e2e": "playwright test"` script)

**Interfaces:**
- Consumes: the full app running via `npm run build && npm run start` (production build, matching how this repo's prior QA passes were run — see project notes on avoiding stale `next-server` processes).
- Produces: a committed regression suite for future phases (1-4) to reuse and extend.

- [ ] **Step 1: Install Playwright**

Run: `npm i -D @playwright/test && npx playwright install chromium`

- [ ] **Step 2: Write `playwright.config.ts`**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
  },
});
```

- [ ] **Step 3: Write `e2e/loop-nav-shell.spec.ts`**

```ts
import { test, expect, type BrowserContext, type Page } from "@playwright/test";

const PASSWORD = "LoopyQA!2026";
const stamp = Date.now();
const USER1 = { email: `qa.loopy1.${stamp}@mailinator.com`, name: "QA Uno" };
const USER2 = { email: `qa.loopy2.${stamp}@mailinator.com`, name: "QA Dos" };

async function signUpAndLogin(page: Page, email: string, name: string) {
  await page.goto("/signup");
  await page.getByPlaceholder(/nombre/i).fill(name);
  await page.getByPlaceholder(/email/i).fill(email);
  await page.getByPlaceholder(/tel/i).fill("+34600000000");
  await page.getByPlaceholder(/contraseñ/i).fill(PASSWORD);
  await page.getByRole("button", { name: /crear cuenta|registrarme|firmar/i }).click();
  await page.goto("/login");
  await page.getByPlaceholder(/email/i).fill(email);
  await page.getByPlaceholder(/contraseñ/i).fill(PASSWORD);
  await page.getByRole("button", { name: /entrar|iniciar sesión/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
}

async function grantGeo(context: BrowserContext, lat: number, lng: number) {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: lat, longitude: lng });
}

test("nav shell: create, join, tabs, map, SOS survive across tabs", async ({ browser }) => {
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const page1 = await ctx1.newPage();
  const page2 = await ctx2.newPage();

  await grantGeo(ctx1, 40.4168, -3.7038);
  await grantGeo(ctx2, 40.417, -3.704);

  await signUpAndLogin(page1, USER1.email, USER1.name);
  await signUpAndLogin(page2, USER2.email, USER2.name);

  await page1.getByPlaceholder(/nombre del loopy/i).fill(`QA Shell ${stamp}`);
  await page1.getByRole("button", { name: /crear loopy/i }).click();
  await expect(page1).toHaveURL(/\/loop\/[^/]+\/mapa/, { timeout: 10000 });

  const code = await page1.locator("text=Código:").first().textContent();
  const inviteCode = code?.replace(/.*Código:\s*/, "").trim();
  expect(inviteCode).toBeTruthy();

  await page2.getByPlaceholder(/código de invitación/i).fill(inviteCode!);
  await page2.getByRole("button", { name: /unirme/i }).click();
  await expect(page2).toHaveURL(/\/loop\/[^/]+\/mapa/, { timeout: 10000 });

  // Tab navigation preserves loop id
  const loopUrl = page1.url();
  const loopId = loopUrl.match(/\/loop\/([^/]+)\//)![1];
  for (const tab of ["familia", "rutas", "sos", "mapa"]) {
    await page1.goto(`/loop/${loopId}/${tab}`);
    await expect(page1).toHaveURL(new RegExp(`/loop/${loopId}/${tab}$`));
    expect(page1.locator("text=Cargando Loopy...")).toHaveCount(0);
  }

  // SOS fires while page2 is on a non-SOS, non-Mapa tab
  await page2.goto(`/loop/${loopId}/familia`);
  await page1.goto(`/loop/${loopId}/sos`);
  const sosButton = page1.getByRole("button", { name: /mantén presionado/i });
  const box = await sosButton.boundingBox();
  await page1.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page1.mouse.down();
  await page1.waitForTimeout(1400);
  await page1.mouse.up();

  await expect(page2.locator("text=necesita ayuda")).toBeVisible({ timeout: 10000 });

  await ctx1.close();
  await ctx2.close();
});
```

- [ ] **Step 4: Add the npm script**

In `package.json`, inside `"scripts"`, add: `"test:e2e": "playwright test"`.

- [ ] **Step 5: Run the suite against a production build**

Run:
```bash
ps aux | grep next-server | grep -v grep
npm run build
npm run start &
sleep 5
npx playwright test
```
Expected: `1 passed`. If it fails, fix the underlying page/layout code (not the test) unless the test itself has a bug, then re-run.

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts e2e/loop-nav-shell.spec.ts package.json package-lock.json
git commit -m "test: add Playwright E2E regression suite for loop nav shell"
```

---

## Self-Review Notes

- **Spec coverage:** every file listed in the spec's "Arquitectura" tree has a task (layout.tsx → Task 3, mapa/familia/rutas/sos/zonas/ajustes → Tasks 5-10, dashboard restyle → Task 11). The spec's one open decision (logo tap → `/dashboard`) is implemented in Task 3 exactly as approved. The Loop name/mode/invite-code placement change is called out explicitly in Task 10 rather than silently dropped.
- **Type consistency checked:** `toggleRoute(uid: string)`, `addZone(name, radiusM)`, `saveAge(age)`, `saveLoopSettings(speedLimitKmh, emergencyNumber)` are defined once in Task 2/3 and consumed with matching signatures in Tasks 5-10.
- **Delegation to subagents with design/animation skills:** Tasks 1, 5, 6, 7, 8, 9, 10, 11 are self-contained UI tasks well-suited to parallel subagent execution (each touches one new file plus `useLoop()`); Tasks 2, 3, 4, 12 are shared-infrastructure/data-flow tasks best done by whoever does Task 3, in order, since everything else depends on them.

---

**Plan complete and saved to `docs/superpowers/plans/2026-08-24-loopy-nav-shell.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration
**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
