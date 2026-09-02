# Loopy Product Polish (Etapa A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the self-contained, non-architectural half of a client feedback batch: copy/branding polish on the Productos and landing pages, and a real feature upgrade to safe-zone creation (by address, not only live GPS).

**Architecture:** Three independent tasks, each touching a disjoint set of files (no shared file between tasks except Task 3's own multi-file change). No new tables, no new routes, no changes to auth/billing/Realtime.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, `@react-google-maps/api` (already installed, v2.20.8), Supabase JS client (already wired via `LoopContext`).

**Spec:** `/Users/sebas1/.claude/plans/revisa-el-proyecto-loopy-parsed-pillow.md` (Plan Mode plan file — Etapa A section only; Etapa B is explicitly out of scope for this plan).

## Global Constraints

- Never touch: Stripe billing code (`app/api/stripe/**`, `lib/stripeClient.ts`, `lib/stripeAuth.ts`), the subscription gate (`app/loop/[id]/layout.tsx`'s gating `useEffect`), Realtime channel subscriptions, or `navigator.geolocation.watchPosition` logic — all working in production, out of scope.
- Only use color values already defined in `tailwind.config.ts` under `loopy`/`glow`/`bridge` — no new hex values invented anywhere.
- Match the existing Spanish copy register per file: `ProductosContent.tsx` and `MagnifierLanding.tsx` use "tú"/"vosotros" (peninsular Spain); do not introduce "vos" (Argentine) into marketing copy.
- Never write copy that promises a feature that doesn't exist in the code (e.g. do not use the word "pausar" for location sharing — already a documented gap, not implemented).
- `npm run build` must stay clean after every task.
- No unit test framework exists in this repo (confirmed convention) — verification is `npm run build` + manual Playwright smoke checks, not new unit tests.

---

### Task 1: Productos page — rename, heading tweak, per-card color, copy

**Files:**
- Modify: `components/ProductosContent.tsx`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing consumed by other tasks (fully self-contained).

- [ ] **Step 1: Update `USE_CASES` — title, per-card accent classes, and the "Tú y alguien más" copy**

Replace the `USE_CASES` array (currently lines 11-32) with:

```tsx
const USE_CASES = [
  {
    icon: Home,
    title: "Familia",
    body: "Sabe que tus hijos llegaron bien al colegio o volvieron a casa, sin tener que preguntar. Zonas seguras, historial del día y un botón SOS a mano para cualquier imprevisto.",
    badgeClass: "bg-loopy-600/15",
    iconClass: "text-loopy-600",
    borderClass: "border-loopy-600/25 hover:border-loopy-600/50",
    shadowClass: "hover:shadow-[0_10px_36px_-6px_rgba(75,88,168,0.45)]",
  },
  {
    icon: Heart,
    title: "Tú y alguien más",
    body: "Compártela en privado, solo entre vosotros: nadie más lo sabe. Para saber que el otro ha llegado bien, coordinar sin dar explicaciones, o simplemente sentiros cerca en la distancia.",
    badgeClass: "bg-glow-500/15",
    iconClass: "text-glow-500",
    borderClass: "border-glow-500/25 hover:border-glow-500/50",
    shadowClass: "hover:shadow-[0_10px_36px_-6px_rgba(236,111,201,0.45)]",
  },
  {
    icon: HeartHandshake,
    title: "Cuidado de mayores",
    body: "Acompaña a un familiar mayor sin invadir su día a día. Modo Supervisión discreto, con alertas y botón de emergencia siempre disponibles.",
    badgeClass: "bg-bridge/15",
    iconClass: "text-bridge",
    borderClass: "border-bridge/25 hover:border-bridge/50",
    shadowClass: "hover:shadow-[0_10px_36px_-6px_rgba(131,76,156,0.45)]",
  },
  {
    icon: Briefcase,
    title: "Empresa / Equipos de trabajo",
    body: "Coordina personal en movimiento — mensajeros, técnicos, vendedores — con visibilidad en tiempo real desde un solo lugar.",
    badgeClass: "bg-bridge-600/15",
    iconClass: "text-bridge-600",
    borderClass: "border-bridge-600/25 hover:border-bridge-600/50",
    shadowClass: "hover:shadow-[0_10px_36px_-6px_rgba(109,63,131,0.45)]",
  },
];
```

Note on the `shadowClass` values: they're `rgba()` conversions of the exact same tokens (`loopy-600 #4b58a8`, `glow-500 #ec6fc9`, `bridge #834c9c`, `bridge-600 #6d3f83`), not new colors. This is necessary because the existing `shadow-card`/`shadow-card-hover` tokens in `tailwind.config.ts` are static rgba values, not built on Tailwind's `--tw-shadow-color` variable — so a `shadow-{color}` utility class cannot recolor them. An arbitrary-value `shadow-[...]` is the only way to get a colored shadow here without editing `tailwind.config.ts` (out of scope for this task).

- [ ] **Step 2: Use the new per-card classes in the render**

In the `USE_CASES.map(...)` block (currently lines 82-93), replace the hardcoded classes with the per-card ones:

```tsx
{USE_CASES.map((c) => (
  <motion.div
    key={c.title}
    variants={fadeInUp}
    className={`bg-white rounded-2xl shadow-card p-6 border-2 ${c.borderClass} ${c.shadowClass} transition-all`}
  >
    <div className={`w-11 h-11 rounded-xl ${c.badgeClass} flex items-center justify-center mb-3`}>
      <c.icon size={20} className={c.iconClass} />
    </div>
    <h3 className="font-bold text-loopy-900 mb-2">{c.title}</h3>
    <p className="text-sm text-loopy-700 leading-relaxed">{c.body}</p>
  </motion.div>
))}
```

(Changed `border border-loopy-100 hover:border-bridge/40 hover:shadow-card-hover` → `border-2 ${c.borderClass} ${c.shadowClass}`, and the badge/icon classes are now per-card instead of the fixed `bg-bridge/12`/`text-bridge`.) Do not touch the `MODES.map(...)` block below it (the two gradient "Cómo funciona" cards) — out of scope.

- [ ] **Step 3: Update the "Cómo funciona" heading**

Line 115 (`Todo se arma como tú quieras`) →

```tsx
Todo se configura como tú quieras
```

- [ ] **Step 4: Verify**

Run `npm run build` — must complete with no type errors (the new `USE_CASES` fields are inferred, no explicit type needed since the array is only consumed via `.map` in the same file). Visually confirm via a quick Playwright screenshot of `/productos` (headless, `npx playwright test` isn't required — a one-off script with `page.goto("/productos")` + `page.screenshot()` against `npm run dev` is enough) that: the 4 cards show visibly different badge/border colors, the fourth card's title reads "Empresa / Equipos de trabajo", and the "Cómo funciona" heading reads "Todo se configura como tú quieras".

- [ ] **Step 5: Commit**

```bash
git add components/ProductosContent.tsx
git commit -m "feat: per-card color accents, renamed team card, discreet copy on Productos"
```

---

### Task 2: Landing hero — admin-control line

**Files:**
- Modify: `components/MagnifierLanding.tsx`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing consumed by other tasks.

- [ ] **Step 1: Add a new line under the existing hero subheading**

Current (lines 56-59):
```tsx
<motion.p variants={fadeInUp} className="mt-5 text-lg text-white/80 max-w-md">
  Crea un Loopy y comparte ubicación entre pares, o supervisa a
  quien más te importa. Tú eliges el modo.
</motion.p>
```

Add a second `motion.p` immediately after it (same `variants={fadeInUp}`, a smaller supporting line — do not replace the existing paragraph):

```tsx
<motion.p variants={fadeInUp} className="mt-5 text-lg text-white/80 max-w-md">
  Crea un Loopy y comparte ubicación entre pares, o supervisa a
  quien más te importa. Tú eliges el modo.
</motion.p>
<motion.p variants={fadeInUp} className="mt-2 text-sm text-white/60 max-w-md">
  El admin siempre tiene el control: decide el modo, quién forma
  parte del Loopy, y gestiona todo desde un solo lugar.
</motion.p>
```

Do not use the word "pausar" anywhere in this copy — location-share pausing is not implemented (documented gap, out of scope).

- [ ] **Step 2: Verify**

`npm run build` clean. Visually confirm the new line renders under the hero subheading on `/` without breaking the hero's layout (check both the `lg:` two-column layout and the mobile stacked layout — resize the viewport or check both breakpoints in the Playwright screenshot).

- [ ] **Step 3: Commit**

```bash
git add components/MagnifierLanding.tsx
git commit -m "feat: add admin-control line to landing hero"
```

---

### Task 3: Zonas seguras — crear por dirección (además de GPS actual)

**Files:**
- Modify: `components/LiveMap.tsx`
- Modify: `app/loop/[id]/LoopContext.tsx`
- Modify: `app/loop/[id]/layout.tsx`
- Modify: `app/loop/[id]/mapa/zonas/page.tsx`

**Interfaces:**
- Consumes: `useLoop()` from `LoopContext.tsx` (existing hook, already used by `zonas/page.tsx`).
- Produces: `addZone`'s new optional third parameter `coords?: { lat: number; lng: number }` — any future caller may pass explicit coordinates instead of relying on the live GPS position.

- [ ] **Step 1: Load the Places library in both `useJsApiLoader` call sites**

`@react-google-maps/api`'s `useJsApiLoader` shares a single loaded script instance keyed by `id`. Both callers must declare the exact same `libraries` array — and it must be a **stable reference** (defined once at module scope, not inline in the hook call), or the library re-triggers a reload on every render.

In `components/LiveMap.tsx`, add near the top of the file (after the existing constants, e.g. after line 8's `containerStyle`):

```tsx
import { GoogleMap, Marker, Circle, Polyline, InfoWindow, useJsApiLoader, type Libraries } from "@react-google-maps/api";
// ...
const MAP_LIBRARIES: Libraries = ["places"];
```

(Add `type Libraries` to the existing import on line 4.) Then update the `useJsApiLoader` call (currently lines 70-73):

```tsx
const { isLoaded, loadError } = useJsApiLoader({
  id: "loopy-google-maps",
  googleMapsApiKey: GOOGLE_MAPS_API_KEY || "",
  libraries: MAP_LIBRARIES,
});
```

- [ ] **Step 2: Widen `addZone`'s signature in `LoopContext.tsx`**

Line 47, current:
```tsx
addZone: (name: string, radiusM: number) => Promise<{ error: string | null }>;
```
New:
```tsx
addZone: (name: string, radiusM: number, coords?: { lat: number; lng: number }) => Promise<{ error: string | null }>;
```

- [ ] **Step 3: Use `coords` when supplied, in `layout.tsx`'s `addZone` implementation**

Current (`app/loop/[id]/layout.tsx:338-348`):
```tsx
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
```
New:
```tsx
async function addZone(
  name: string,
  radiusM: number,
  coords?: { lat: number; lng: number }
): Promise<{ error: string | null }> {
  const center = coords ?? myPos;
  if (!center) return { error: "Esperando tu ubicación para crear la zona..." };
  const { data, error } = await supabase
    .from("safe_zones")
    .insert({ loop_id: loopId, name, lat: center.lat, lng: center.lng, radius_m: radiusM, created_by: userId })
    .select()
    .single();
  if (error || !data) return { error: error?.message || "No se pudo crear la zona" };
  setZones((prev) => [...prev, data]);
  return { error: null };
}
```
This is a backward-compatible change: existing callers passing only `(name, radiusM)` keep using `myPos` exactly as today.

- [ ] **Step 4: Rebuild the zonas page UI — address search + "usar mi ubicación" toggle**

Replace the full contents of `app/loop/[id]/mapa/zonas/page.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { ArrowLeft, MapPin, LocateFixed } from "lucide-react";
import Link from "next/link";
import { Autocomplete, useJsApiLoader, type Libraries } from "@react-google-maps/api";
import { useLoop } from "../../LoopContext";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const ZONAS_LIBRARIES: Libraries = ["places"];

export default function ZonasPage() {
  const { loopId, zones, addZone } = useLoop();
  const [zoneName, setZoneName] = useState("");
  const [zoneRadius, setZoneRadius] = useState(150);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [useAddress, setUseAddress] = useState(false);
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [addressLabel, setAddressLabel] = useState("");
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: "loopy-google-maps",
    googleMapsApiKey: GOOGLE_MAPS_API_KEY || "",
    libraries: ZONAS_LIBRARIES,
  });

  function handlePlaceChanged() {
    if (!autocomplete) return;
    const place = autocomplete.getPlace();
    const loc = place.geometry?.location;
    if (!loc) {
      setAddressCoords(null);
      return;
    }
    setAddressCoords({ lat: loc.lat(), lng: loc.lng() });
    setAddressLabel(place.formatted_address || place.name || "");
  }

  async function handleAddZone(e: React.FormEvent) {
    e.preventDefault();
    if (useAddress && !addressCoords) {
      setError("Elegí una dirección de la lista antes de crear la zona.");
      return;
    }
    setCreating(true);
    setError(null);
    const { error } = await addZone(zoneName, zoneRadius, useAddress ? addressCoords! : undefined);
    if (error) {
      setError(error);
    } else {
      setZoneName("");
      setAddressCoords(null);
      setAddressLabel("");
    }
    setCreating(false);
  }

  return (
    <div className="flex-1 p-4 space-y-4">
      <Link href={`/loop/${loopId}/mapa`} className="flex items-center gap-1 text-loopy-700 text-sm font-medium">
        <ArrowLeft size={15} />
        Mapa
      </Link>

      <form onSubmit={handleAddZone} className="bg-white rounded-xl border border-loopy-100 shadow-card md:shadow-card-hover p-4 md:p-6">
        <h2 className="font-bold text-loopy-900 mb-2 flex items-center gap-1.5">
          <MapPin size={16} className="text-bridge" />
          Nueva zona segura
        </h2>
        <p className="text-xs text-loopy-700/60 mb-3">
          Las zonas seguras no se activan solas: hay que crear al menos una para que el Loopy empiece a avisar entradas y salidas.
        </p>
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

        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={() => setUseAddress(false)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border ${
              !useAddress ? "bg-bridge/10 border-bridge text-bridge" : "border-loopy-100 text-loopy-700"
            }`}
          >
            <LocateFixed size={14} />
            Mi ubicación actual
          </button>
          <button
            type="button"
            onClick={() => setUseAddress(true)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border ${
              useAddress ? "bg-bridge/10 border-bridge text-bridge" : "border-loopy-100 text-loopy-700"
            }`}
          >
            <MapPin size={14} />
            Elegir dirección
          </button>
        </div>

        {useAddress && isLoaded && (
          <Autocomplete onLoad={setAutocomplete} onPlaceChanged={handlePlaceChanged}>
            <input
              placeholder="Buscar una dirección"
              className="w-full mb-2 px-3 py-2 rounded-lg border border-loopy-50 text-sm focus:outline-none focus:ring-2 focus:ring-bridge/60"
              defaultValue={addressLabel}
            />
          </Autocomplete>
        )}
        {useAddress && !isLoaded && (
          <p className="text-xs text-loopy-700/60 mb-2">Cargando buscador de direcciones...</p>
        )}
        {useAddress && (
          <p className="text-xs text-loopy-700/60 mb-3">
            {addressCoords ? "Dirección seleccionada." : "Se crea centrada en la dirección que elijas de la lista."}
          </p>
        )}
        {!useAddress && (
          <p className="text-xs text-loopy-700/60 mb-3">Se crea centrada en tu ubicación actual.</p>
        )}

        {error && <p className="text-red-600 text-xs mb-3">{error}</p>}
        <button
          type="submit"
          disabled={creating}
          className="w-full py-2 rounded-full bg-gradient-to-r from-loopy-700 via-bridge to-glow-500 text-white text-sm font-semibold shadow-cta hover:shadow-cta-hover disabled:opacity-60"
        >
          {creating ? "Creando..." : "Crear zona"}
        </button>
      </form>

      <div className="bg-white rounded-xl border border-loopy-100 shadow-card md:shadow-card-hover p-4 md:p-6">
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

Key behavior preserved: the default toggle state is `useAddress = false`, so nothing changes for a user who doesn't touch the new toggle — `addZone(zoneName, zoneRadius, undefined)` behaves exactly as before (GPS fallback via `myPos` in `layout.tsx`).

- [ ] **Step 5: Verify**

`npm run build` clean (this is the step most likely to catch a `Libraries`/type mismatch — pay attention to any TS error about `Autocomplete`'s children prop or `google.maps.places` types not being found; if `google.maps.places` types are missing, check whether `@types/google.maps` is already a dependency — it's used elsewhere in the file via `google.maps.LatLngBounds`/`google.maps.Symbol` in `LiveMap.tsx`, so the global `google` namespace should already be available without a new install).

Manual/Playwright check against `npm run dev` (needs `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` set locally, same as prior sessions — check `.env.local` in this worktree; if missing, note it in the task report rather than blocking, since the API key isn't something this task can obtain):
1. Default state ("Mi ubicación actual" selected) — form behaves exactly as before.
2. Click "Elegir dirección" — an address input appears (once `isLoaded`), type a real address, select a suggestion, submit — confirm the new zone's `lat`/`lng` (visible via the zone circle on `/loop/[id]/mapa`, or by checking the `safe_zones` row if DB access is available) matches the searched address, not the device's current GPS position.
3. Confirm the "no se activan solas" notice renders above the form.

- [ ] **Step 6: Commit**

```bash
git add components/LiveMap.tsx app/loop/[id]/LoopContext.tsx app/loop/[id]/layout.tsx app/loop/[id]/mapa/zonas/page.tsx
git commit -m "feat: create safe zones by address, not only live GPS"
```
