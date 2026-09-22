# Loopy — Registro directo al mapa + invitación por WhatsApp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After signup, land the user directly on their Loopy's map (no
mode-selection step first); move mode selection into the admin's Ajustes
tab; let an admin send a WhatsApp link with a pre-built invite code that
auto-registers/auto-links a guest with location-sharing permission on
accept.

**Architecture:** Two small, independently-reachable additions on top of
the existing Next.js App Router + Supabase app: (1) a shared client helper
(`lib/loopBootstrap.ts`) that either auto-creates a default Loop or accepts
a pending invite right after auth, called from `signup`/`login`/`dashboard`
instead of leaving the user on a list/mode-picker; (2) a new
service-role-backed API route (`/api/loops/accept-invite`) that claims a
pending `loop_members` row by id, mirroring the existing
`start-trial`/`requireLoopAdmin` pattern so it never depends on undocumented
RLS policies.

**Tech Stack:** Next.js 14.2.5 (App Router), TypeScript, Tailwind, Supabase
(`@supabase/supabase-js`), Playwright (`e2e/`, real signups against the
live Supabase project via mailinator.com email confirmation — see
`playwright.config.ts` and `e2e/loop-nav-shell.spec.ts`'s header comment).

**Spec:** `docs/superpowers/specs/2026-09-21-loopy-registro-directo-whatsapp-design.md`

## Global Constraints

- No unit-test framework exists in this repo (`package.json` has only
  `build`, `lint`, `test:e2e`). Every task's fast verification is
  `npm run build` (type-check + compile). Live end-to-end proof comes only
  from Task 6, which extends the real Playwright suite in `e2e/` — do not
  invent a separate unit-test setup.
- `.env.local` is already present in this worktree (copied from the main
  checkout, gitignored) — required for `npm run dev` and
  `npm run test:e2e` to reach the live Supabase project
  (`SUPABASE_SERVICE_ROLE_KEY`, etc.). Never print its contents.
- Every privileged (non-self) database write from an API route goes
  through `supabaseAdmin` (`lib/supabaseAdmin.ts`, service role) after
  verifying the caller's Bearer token — never trust a client-supplied user
  id. Mirror `requireLoopAdmin` in `lib/stripeAuth.ts`.
- Tailwind classes and copy must match existing usage verbatim
  (`loopy-*`, `bridge`, gradient `from-loopy-700 via-bridge to-glow-500`,
  `shadow-card`, `rounded-lg`/`rounded-xl`/`rounded-2xl`,
  `focus:outline-none focus:ring-2 focus:ring-bridge/60`) — copy from
  neighboring markup, never invent new tokens. Spanish UI copy, "tú" tone.
- Task order matters: Task 1 (backend) before Task 4 (auth pages consume
  it); Task 2 (Ajustes) before Task 6 (e2e asserts Ajustes fields); Task 3
  and Task 4 (dashboard/auth redirect changes) before Task 6 (e2e updates
  depend on both being in place). Task 5 (WhatsApp button) before Task 6
  (e2e drives that button).

---

### Task 1: Invite-acceptance backend — API route + shared client helpers

**Files:**
- Modify: `lib/stripeAuth.ts` (add `requireAuthedUser`, after the existing
  `requireLoopAdmin` function)
- Create: `app/api/loops/accept-invite/route.ts`
- Create: `lib/loopBootstrap.ts`

**Interfaces:**
- Produces: `requireAuthedUser(req: NextRequest): Promise<{ ok: true; userId: string; userEmail: string | null } | { ok: false; status: number; error: string }>`
  exported from `lib/stripeAuth.ts`.
- Produces: `POST /api/loops/accept-invite` — body `{ pmId: string; inviteCode: string }`,
  header `Authorization: Bearer <access_token>` → `200 { loopId: string }`
  or `{status: 400|401|404|409|500} { error: string }`.
- Produces: `createDefaultLoop(userId: string, accessToken: string): Promise<{ loopId: string } | { error: string }>`
  and `acceptInvite(pmId: string, inviteCode: string, accessToken: string): Promise<{ loopId: string } | { error: string }>`,
  both exported from `lib/loopBootstrap.ts`. **Exact parameter order
  matters** — `acceptInvite` takes `pmId` first, then `inviteCode`, then
  `accessToken`. Task 4 calls these by name with this exact order.
- Consumes: `supabaseAdmin` (default import site: `import { supabaseAdmin } from "@/lib/supabaseAdmin";`,
  already used by `app/api/loops/start-trial/route.ts`), `supabase` (from
  `lib/supabaseClient.ts`, already used by every client page in this repo),
  `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`createClient` already defined/imported
  at the top of `lib/stripeAuth.ts`.

- [ ] **Step 1: Add `requireAuthedUser` to `lib/stripeAuth.ts`**

Append this after the existing `requireLoopAdmin` function (same file — do
not add new imports, `createClient`/`SUPABASE_URL`/`SUPABASE_ANON_KEY` are
already imported/defined above it):

```ts
export type AuthedUserResult =
  | { ok: true; userId: string; userEmail: string | null }
  | { ok: false; status: number; error: string };

/**
 * Verifica el Bearer token del caller contra Supabase Auth, sin exigir
 * que sea admin de ningún Loopy — lo usan rutas donde cualquier cuenta
 * autenticada puede actuar (p.ej. aceptar una invitación).
 */
export async function requireAuthedUser(req: NextRequest): Promise<AuthedUserResult> {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return { ok: false, status: 401, error: "No autenticado" };
  }

  const supabaseAsUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await supabaseAsUser.auth.getUser(token);
  if (userError || !userData.user) {
    return { ok: false, status: 401, error: "No autenticado" };
  }

  return { ok: true, userId: userData.user.id, userEmail: userData.user.email ?? null };
}
```

- [ ] **Step 2: Create `app/api/loops/accept-invite/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAuthedUser } from "@/lib/stripeAuth";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { pmId?: string; inviteCode?: string };
  const auth = await requireAuthedUser(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!body.pmId || !body.inviteCode) {
    return NextResponse.json({ error: "Falta pmId o inviteCode" }, { status: 400 });
  }

  const { data: pending, error: pendingError } = await supabaseAdmin
    .from("loop_members")
    .select("id, loop_id, user_id")
    .eq("id", body.pmId)
    .single();
  if (pendingError || !pending) {
    return NextResponse.json({ error: "Invitación no encontrada" }, { status: 404 });
  }
  if (pending.user_id) {
    return NextResponse.json({ error: "Esta invitación ya fue aceptada" }, { status: 409 });
  }

  const { data: loop, error: loopError } = await supabaseAdmin
    .from("loops")
    .select("id, invite_code")
    .eq("id", pending.loop_id)
    .single();
  if (loopError || !loop || loop.invite_code !== body.inviteCode) {
    return NextResponse.json({ error: "Código de invitación inválido" }, { status: 400 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("loop_members")
    .update({ user_id: auth.userId })
    .eq("id", body.pmId)
    .is("user_id", null);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ loopId: pending.loop_id });
}
```

- [ ] **Step 3: Create `lib/loopBootstrap.ts`**

```ts
"use client";

import { supabase } from "@/lib/supabaseClient";
import type { LoopMode } from "@/lib/types";

const DEFAULT_LOOP_NAME = "Mi Loopy";
const DEFAULT_LOOP_MODE: LoopMode = "mirror";

async function callStartTrial(loopId: string, accessToken: string): Promise<boolean> {
  return fetch("/api/loops/start-trial", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ loopId }),
  })
    .then((res) => res.ok)
    .catch(() => false);
}

export async function createDefaultLoop(
  userId: string,
  accessToken: string
): Promise<{ loopId: string } | { error: string }> {
  const { data: loop, error } = await supabase
    .from("loops")
    .insert({ name: DEFAULT_LOOP_NAME, mode: DEFAULT_LOOP_MODE, admin_id: userId })
    .select()
    .single();
  if (error || !loop) {
    return { error: error?.message || "No se pudo crear el Loopy" };
  }

  const { error: memberError } = await supabase.from("loop_members").insert({
    loop_id: loop.id,
    user_id: userId,
    role: "admin",
  });
  if (memberError) {
    return { error: memberError.message };
  }

  // Un solo reintento, mismo patrón que app/dashboard/page.tsx: un blip de
  // red transitorio no debería costarle el día gratis a nadie — start-trial
  // es un no-op seguro si el Loopy ya tiene fila (ver
  // app/api/loops/start-trial/route.ts).
  const started = await callStartTrial(loop.id, accessToken);
  if (!started) {
    await callStartTrial(loop.id, accessToken);
  }

  return { loopId: loop.id };
}

export async function acceptInvite(
  pmId: string,
  inviteCode: string,
  accessToken: string
): Promise<{ loopId: string } | { error: string }> {
  try {
    const res = await fetch("/api/loops/accept-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ pmId, inviteCode }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { error: data.error || "No se pudo aceptar la invitación" };
    }
    return { loopId: data.loopId };
  } catch {
    return { error: "No se pudo aceptar la invitación" };
  }
}
```

- [ ] **Step 4: Verify clean build**

Run: `npm run build`
Expected: compiles cleanly, no type errors. Nothing else in the repo
imports these new exports yet, so this step only proves the new files
themselves are well-typed.

- [ ] **Step 5: Commit**

```bash
git add lib/stripeAuth.ts app/api/loops/accept-invite/route.ts lib/loopBootstrap.ts
git commit -m "feat: add invite-acceptance API route and loop bootstrap helpers"
```

---

### Task 2: Ajustes — editable name + mode moves here

**Files:**
- Modify: `app/loop/[id]/LoopContext.tsx`
- Modify: `app/loop/[id]/layout.tsx`
- Modify: `app/loop/[id]/ajustes/page.tsx`

**Interfaces:**
- Consumes: `LoopMode` from `lib/types.ts` (already `export type LoopMode = "mirror" | "supervision";` — no change needed there).
- Produces: new `saveLoopSettings` signature —
  `(name: string, mode: LoopMode, speedLimitKmh: number | null, emergencyNumber: string | null, primaryContactNumber: string | null) => Promise<{ error: string | null }>`.
  Only `ajustes/page.tsx` calls this function anywhere in the repo.

- [ ] **Step 1: Extend the `saveLoopSettings` type in `app/loop/[id]/LoopContext.tsx`**

Change the type-only import line:
```ts
import type { Loop, LoopMember, MemberRole, SafeZone, SpeedAlert, SubscriptionStatus } from "@/lib/types";
```
to:
```ts
import type { Loop, LoopMember, LoopMode, MemberRole, SafeZone, SpeedAlert, SubscriptionStatus } from "@/lib/types";
```

Change:
```ts
  saveLoopSettings: (
    speedLimitKmh: number | null,
    emergencyNumber: string | null,
    primaryContactNumber: string | null
  ) => Promise<{ error: string | null }>;
```
to:
```ts
  saveLoopSettings: (
    name: string,
    mode: LoopMode,
    speedLimitKmh: number | null,
    emergencyNumber: string | null,
    primaryContactNumber: string | null
  ) => Promise<{ error: string | null }>;
```

- [ ] **Step 2: Extend the `saveLoopSettings` implementation in `app/loop/[id]/layout.tsx`**

Same import-line change as Step 1 (add `LoopMode` to the existing type-only
import from `@/lib/types` in this file).

Change:
```ts
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
```
to:
```ts
  async function saveLoopSettings(
    name: string,
    mode: LoopMode,
    speedLimitKmh: number | null,
    emergencyNumber: string | null,
    primaryContactNumber: string | null
  ): Promise<{ error: string | null }> {
    const { data, error } = await supabase
      .from("loops")
      .update({
        name,
        mode,
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
```

- [ ] **Step 3: Rewrite `app/loop/[id]/ajustes/page.tsx`**

Replace the full file content with:

```tsx
"use client";

import { useState } from "react";
import { useLoop } from "../LoopContext";
import type { LoopMode } from "@/lib/types";

export default function AjustesPage() {
  const { loop, isAdmin, saveLoopSettings } = useLoop();
  const [nameInput, setNameInput] = useState(loop.name);
  const [modeInput, setModeInput] = useState<LoopMode>(loop.mode);
  const [speedLimitInput, setSpeedLimitInput] = useState(loop.speed_limit_kmh?.toString() || "");
  const [emergencyNumberInput, setEmergencyNumberInput] = useState(loop.emergency_number || "");
  const [primaryContactInput, setPrimaryContactInput] = useState(loop.primary_contact_number || "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error } = await saveLoopSettings(
      nameInput,
      modeInput,
      speedLimitInput ? Number(speedLimitInput) : null,
      emergencyNumberInput || null,
      primaryContactInput || null
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
          <label className="block text-xs text-loopy-700/70 mb-1">Nombre del Loopy</label>
          <input
            placeholder="Nombre del Loopy"
            className="w-full mb-3 px-3 py-2 rounded-lg border border-loopy-50 text-sm focus:outline-none focus:ring-2 focus:ring-bridge/60"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            required
          />
          <label className="block text-xs text-loopy-700/70 mb-1">Modo</label>
          <select
            className="w-full mb-3 px-3 py-2 rounded-lg border border-loopy-50 text-sm"
            value={modeInput}
            onChange={(e) => setModeInput(e.target.value as LoopMode)}
          >
            <option value="mirror">Modo Espejo (todos se ven)</option>
            <option value="supervision">Modo Supervisión (roles)</option>
          </select>
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
          <label className="block text-xs text-loopy-700/70 mb-1">Número de primer contacto</label>
          <input
            type="tel"
            placeholder="Ej. mamá o papá"
            className="w-full mb-3 px-3 py-2 rounded-lg border border-loopy-50 text-sm focus:outline-none focus:ring-2 focus:ring-bridge/60"
            value={primaryContactInput}
            onChange={(e) => setPrimaryContactInput(e.target.value)}
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
```

- [ ] **Step 4: Verify clean build**

Run: `npm run build`
Expected: compiles cleanly. If it fails on `saveLoopSettings` argument
count/types anywhere, the only legal call site is `ajustes/page.tsx` — grep
the whole repo for `saveLoopSettings` to confirm there are no other callers
(`grep -rn "saveLoopSettings" --include=*.tsx --include=*.ts .`).

- [ ] **Step 5: Commit**

```bash
git add app/loop/\[id\]/LoopContext.tsx app/loop/\[id\]/layout.tsx app/loop/\[id\]/ajustes/page.tsx
git commit -m "feat: move Loopy name/mode editing into Ajustes"
```

---

### Task 3: Dashboard — drop mode picker at creation, redirect to /mapa

**Files:**
- Modify: `app/dashboard/page.tsx`

**Interfaces:**
- Consumes: nothing new. `LoopMode` type import is **removed** from this
  file (no longer used here after this task).
- Produces: nothing new for other tasks — this task only changes redirect
  targets that Task 6's e2e updates need to know about (`/mapa` instead of
  `/familia`/staying put).

- [ ] **Step 1: Drop the `LoopMode` import and `newLoopMode` state**

Change:
```ts
import type { Loop, LoopMode } from "@/lib/types";
```
to:
```ts
import type { Loop } from "@/lib/types";
```

Delete this line entirely:
```ts
  const [newLoopMode, setNewLoopMode] = useState<LoopMode>("mirror");
```

- [ ] **Step 2: Fix the loop mode at creation, redirect to `/mapa`**

In `handleCreateLoop`, change:
```ts
    const { data: loop, error } = await supabase
      .from("loops")
      .insert({ name: newLoopName, mode: newLoopMode, admin_id: userId })
      .select()
      .single();
```
to:
```ts
    const { data: loop, error } = await supabase
      .from("loops")
      .insert({ name: newLoopName, mode: "mirror", admin_id: userId })
      .select()
      .single();
```

At the end of the same function, change:
```ts
    router.push(`/loop/${loop.id}/familia`);
```
to:
```ts
    router.push(`/loop/${loop.id}/mapa`);
```

- [ ] **Step 3: Redirect after joining by code too**

In `handleJoinLoop`, change the end of the function from:
```ts
    setJoinCode("");
    await loadLoops(userId);
    setJoining(false);
```
to:
```ts
    setJoining(false);
    router.push(`/loop/${loop.id}/mapa`);
```

- [ ] **Step 4: Remove the mode `<select>` from the "Crear un Loopy" form JSX**

Delete this block entirely:
```tsx
            <select
              className="w-full mb-4 px-3 py-2 rounded-lg border border-loopy-50"
              value={newLoopMode}
              onChange={(e) => setNewLoopMode(e.target.value as LoopMode)}
            >
              <option value="mirror">Modo Espejo (todos se ven)</option>
              <option value="supervision">Modo Supervisión (roles)</option>
            </select>
```

The `<input placeholder="Nombre del Loopy" .../>` immediately above it
currently has `className="w-full mb-3 ..."` — change its `mb-3` to `mb-4`
so the spacing before the submit button stays the same as before (the
select used to provide that final `mb-4` gap).

- [ ] **Step 5: Verify clean build**

Run: `npm run build`
Expected: compiles cleanly, no unused-import or type errors.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: drop mode picker at Loopy creation, go straight to the map"
```

---

### Task 4: Auth pages — signup direct-to-map, login invite-accept

**Files:**
- Modify: `app/signup/page.tsx`
- Modify: `app/login/page.tsx`

**Interfaces:**
- Consumes: `createDefaultLoop`, `acceptInvite` from `@/lib/loopBootstrap`
  (Task 1) — **exact call order**: `acceptInvite(pmId, inviteCode, accessToken)`.

- [ ] **Step 1: Replace `app/signup/page.tsx` in full**

```tsx
"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { supabase } from "@/lib/supabaseClient";
import { NavbarLogo } from "@/components/LoopyLogo";
import { fadeInUp, scaleIn } from "@/lib/motion";
import { acceptInvite, createDefaultLoop } from "@/lib/loopBootstrap";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get("invite");
  const pmId = searchParams.get("pm");
  const hasInvite = !!(inviteCode && pmId);

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function resolveDestination(userId: string, accessToken: string): Promise<string> {
    if (hasInvite) {
      const accepted = await acceptInvite(pmId!, inviteCode!, accessToken);
      if ("loopId" in accepted) return `/loop/${accepted.loopId}/mapa`;
    }
    const created = await createDefaultLoop(userId, accessToken);
    if ("loopId" in created) return `/loop/${created.loopId}/mapa`;
    return "/dashboard";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone) {
      setError("El teléfono es obligatorio.");
      return;
    }
    setLoading(true);
    setError(null);
    const loginUrl = hasInvite
      ? `https://www.directloopy.com/login?invite=${encodeURIComponent(inviteCode!)}&pm=${encodeURIComponent(pmId!)}`
      : "https://www.directloopy.com/login";
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { phone },
        emailRedirectTo: loginUrl,
      },
    });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }
    if (data.session) {
      const destination = await resolveDestination(data.user!.id, data.session.access_token);
      router.push(destination);
      return;
    }
    setLoading(false);
    setDone(true);
  }

  const loginHref = hasInvite ? `/login?invite=${inviteCode}&pm=${pmId}` : "/login";

  return (
    <main className="relative min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto w-full">
        <Link href="/">
          <NavbarLogo size={32} dark />
        </Link>
        <Link
          href={loginHref}
          className="px-4 py-2 text-loopy-700 font-medium hover:text-loopy-900 transition-colors"
        >
          Acceder
        </Link>
      </header>

      <section className="flex-1 flex items-center justify-center px-6 py-10">
        {done ? (
          <motion.div
            initial="hidden"
            animate="show"
            variants={scaleIn}
            className="w-full max-w-sm bg-white rounded-2xl shadow-card border border-loopy-100 p-8 text-center"
          >
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
              className="mx-auto mb-4 w-14 h-14 rounded-full bg-bridge/10 flex items-center justify-center"
            >
              <CheckCircle2 className="text-bridge" size={30} />
            </motion.div>
            <h1 className="text-xl font-bold text-loopy-900 mb-2">
              ¡Cuenta creada!
            </h1>
            <p className="text-loopy-700">
              Revisa tu email para confirmar la cuenta antes de acceder.
            </p>
            <Link
              href={loginHref}
              className="text-bridge font-medium mt-4 inline-block"
            >
              Ir a acceder
            </Link>
          </motion.div>
        ) : (
          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeInUp}
            className="w-full max-w-sm"
          >
            <div className="flex flex-col items-center mb-6">
              <span className="mb-3 px-4 py-1 rounded-full text-xs font-semibold tracking-wide uppercase bg-bridge/10 text-loopy-700 border border-bridge/30 shadow-badge">
                Crear cuenta
              </span>
              <h1 className="text-2xl font-extrabold text-loopy-900 text-center">
                {hasInvite ? "Te invitaron a un Loopy" : "Súmate a Loopy"}
              </h1>
              <p className="text-sm text-loopy-700 text-center mt-1">
                {hasInvite
                  ? "Crea tu cuenta para aceptar la invitación y compartir ubicación."
                  : "Gratis el primer día, 14,99€/mes después."}
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="w-full bg-white rounded-2xl shadow-card border border-loopy-100 p-8"
            >
              <label className="block text-sm font-medium text-loopy-900 mb-1">
                Teléfono
              </label>
              <PhoneInput
                value={phone}
                onChange={(value) => setPhone(value || "")}
                placeholder="+34 600 000 000"
                international
                required
                className="loopy-phone-input w-full mb-4"
              />
              <label className="block text-sm font-medium text-loopy-900 mb-1">
                Email
              </label>
              <input
                type="email"
                className="w-full mb-4 px-3 py-2 rounded-lg border border-loopy-50 focus:outline-none focus:ring-2 focus:ring-bridge/60"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <label className="block text-sm font-medium text-loopy-900 mb-1">
                Contraseña
              </label>
              <input
                type="password"
                minLength={6}
                className="w-full mb-6 px-3 py-2 rounded-lg border border-loopy-50 focus:outline-none focus:ring-2 focus:ring-bridge/60"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-full bg-gradient-to-r from-loopy-700 via-bridge to-glow-500 text-white font-semibold shadow-cta hover:shadow-cta-hover disabled:opacity-60"
              >
                {loading ? "Creando..." : "Crear cuenta"}
              </motion.button>
              <p className="text-xs text-loopy-700/60 mt-3 text-center">
                Al crear tu cuenta aceptas los{" "}
                <Link href="/terminos" className="text-bridge font-medium hover:underline">
                  Términos
                </Link>{" "}
                y la{" "}
                <Link href="/privacidad" className="text-bridge font-medium hover:underline">
                  Política de Privacidad
                </Link>
                .
              </p>
              <p className="text-sm text-loopy-700 mt-4 text-center">
                ¿Ya tienes cuenta?{" "}
                <Link href={loginHref} className="text-bridge font-medium">
                  Accede
                </Link>
              </p>
            </form>
          </motion.div>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Replace `app/login/page.tsx` in full**

```tsx
"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { NavbarLogo } from "@/components/LoopyLogo";
import { fadeInUp } from "@/lib/motion";
import { acceptInvite } from "@/lib/loopBootstrap";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get("invite");
  const pmId = searchParams.get("pm");
  const hasInvite = !!(inviteCode && pmId);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    if (hasInvite && data.session) {
      const accepted = await acceptInvite(pmId!, inviteCode!, data.session.access_token);
      if ("loopId" in accepted) {
        router.push(`/loop/${accepted.loopId}/mapa`);
        return;
      }
    }
    router.push("/dashboard");
  }

  return (
    <main className="relative min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto w-full">
        <Link href="/">
          <NavbarLogo size={32} dark />
        </Link>
        <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
          <Link
            href={hasInvite ? `/signup?invite=${inviteCode}&pm=${pmId}` : "/signup"}
            className="px-4 py-2 rounded-full bg-gradient-to-r from-loopy-700 via-bridge to-glow-500 text-white font-medium shadow-cta hover:shadow-cta-hover inline-block"
          >
            Crear cuenta
          </Link>
        </motion.div>
      </header>

      <section className="flex-1 flex items-center justify-center px-6 py-10">
        <motion.div
          initial="hidden"
          animate="show"
          variants={fadeInUp}
          className="w-full max-w-sm"
        >
          <div className="flex flex-col items-center mb-6">
            <span className="mb-3 px-4 py-1 rounded-full text-xs font-semibold tracking-wide uppercase bg-bridge/10 text-loopy-700 border border-bridge/30 shadow-badge">
              Iniciar sesión
            </span>
            <h1 className="text-2xl font-extrabold text-loopy-900 text-center">
              Bienvenido de nuevo
            </h1>
            <p className="text-sm text-loopy-700 text-center mt-1">
              {hasInvite
                ? "Accede para aceptar tu invitación y compartir ubicación."
                : "Accede para ver tus Loopys y tu ubicación en tiempo real."}
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="w-full bg-white rounded-2xl shadow-card border border-loopy-100 p-8"
          >
            <label className="block text-sm font-medium text-loopy-900 mb-1">
              Email
            </label>
            <input
              type="email"
              className="w-full mb-4 px-3 py-2 rounded-lg border border-loopy-50 focus:outline-none focus:ring-2 focus:ring-bridge/60"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <label className="block text-sm font-medium text-loopy-900 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              className="w-full mb-6 px-3 py-2 rounded-lg border border-loopy-50 focus:outline-none focus:ring-2 focus:ring-bridge/60"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-full bg-gradient-to-r from-loopy-700 via-bridge to-glow-500 text-white font-semibold shadow-cta hover:shadow-cta-hover disabled:opacity-60"
            >
              {loading ? "Accediendo..." : "Acceder"}
            </motion.button>
            <p className="text-sm text-loopy-700 mt-4 text-center">
              ¿No tienes cuenta?{" "}
              <Link href={hasInvite ? `/signup?invite=${inviteCode}&pm=${pmId}` : "/signup"} className="text-bridge font-medium">
                Crea una
              </Link>
            </p>
          </form>
        </motion.div>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Verify clean build**

Run: `npm run build`
Expected: compiles cleanly, including the `useSearchParams`/`Suspense`
requirement (no "should be wrapped in a suspense boundary" error/warning
for `/signup` or `/login`).

- [ ] **Step 4: Commit**

```bash
git add app/signup/page.tsx app/login/page.tsx
git commit -m "feat: signup lands directly on the map, login completes pending invites"
```

---

### Task 5: Familia — WhatsApp invite button

**Files:**
- Modify: `app/loop/[id]/familia/page.tsx`

**Interfaces:**
- Consumes: `loop.invite_code` (already available via `useLoop()` in this
  file), `m.id`/`m.pending_phone` from the existing `members` list.
- Produces: a button with
  `aria-label={\`Enviar invitación por WhatsApp a ${displayName}\`}` per
  pending row — Task 6's e2e test targets this exact aria-label text.

- [ ] **Step 1: Add imports**

Change:
```ts
import { Route as RouteIcon, UserPlus, Pencil, X, Check, Copy, MapPin } from "lucide-react";
```
to:
```ts
import { Route as RouteIcon, UserPlus, Pencil, X, Check, Copy, MapPin, MessageCircle } from "lucide-react";
```

Change:
```ts
import type { MemberRole } from "@/lib/types";
```
to:
```ts
import type { LoopMember, MemberRole } from "@/lib/types";
```

- [ ] **Step 2: Add the handler**

Add this function inside `FamiliaPage`, near `handleCopyInviteCode` (same
component, same style of small handler):

```ts
  function handleSendWhatsApp(member: LoopMember) {
    if (!member.pending_phone) return;
    const digits = member.pending_phone.replace(/[^0-9]/g, "");
    const inviteUrl = `https://www.directloopy.com/signup?invite=${loop.invite_code}&pm=${member.id}`;
    const text = `Te invité a mi Loopy para compartir ubicación 💙 Aceptá acá: ${inviteUrl}`;
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }
```

- [ ] **Step 3: Add the button to each pending row's action strip**

In the member list's `<span className="flex items-center gap-2 shrink-0">`
block, immediately **after** the existing "Editar teléfono" button and
**before** the "Ubicación aproximada" (`MapPin`) button, insert:

```tsx
                  {isPending && isAdmin && m.pending_phone && (
                    <button
                      type="button"
                      onClick={() => handleSendWhatsApp(m)}
                      aria-label={`Enviar invitación por WhatsApp a ${displayName}`}
                      title="Enviar por WhatsApp"
                      className="w-6 h-6 rounded-full flex items-center justify-center text-loopy-700/50 hover:bg-green-50 hover:text-green-600"
                    >
                      <MessageCircle size={12} />
                    </button>
                  )}
```

- [ ] **Step 4: Verify clean build**

Run: `npm run build`
Expected: compiles cleanly.

- [ ] **Step 5: Commit**

```bash
git add app/loop/\[id\]/familia/page.tsx
git commit -m "feat: add WhatsApp invite button to pending Familia members"
```

---

### Task 6: Update + extend the Playwright e2e suite

**Files:**
- Modify: `e2e/loop-nav-shell.spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 1-5 (this task can only run last — it
  exercises the real, live app).

This is the only task with real, live verification (no unit-test framework
exists in this repo — see Global Constraints). Tasks 3 and 4 change
behavior two existing tests depend on: "Crear Loopy"/"Unirse" now
auto-navigate away from `/dashboard` instead of staying there, and organic
signup now lands on an auto-created Loopy's `/mapa` instead of
`/dashboard`. This task fixes those two tests and adds two new ones.

- [ ] **Step 1: Fix `signUpAndLogin` — organic signup now lands on `/loop/{id}/mapa`, not `/dashboard`**

The helper currently does `page.waitForURL(/\/dashboard/, ...)` twice (once
for the immediate-session case, once after login-post-confirm). After Task
4, an organic signup (no `invite`/`pm` params, which is every call to this
helper in the existing two tests) auto-creates a default Loopy and lands on
its map instead. Change:

```ts
async function signUpAndLogin(page: Page, email: string, phone: string = "+34600000000") {
  await page.goto("/signup");
  await page.locator('input[type="tel"]').pressSequentially(phone, { delay: 20 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  const wentToDashboard = await page
    .waitForURL(/\/dashboard/, { timeout: 15000 })
    .then(() => true)
    .catch(() => false);

  if (!wentToDashboard) {
    // Confirmation required: app/signup/page.tsx shows the "revisa tu
    // email" card instead of redirecting (data.session was null).
    await expect(page.getByText("¡Cuenta creada!")).toBeVisible({ timeout: 5000 });
    await confirmEmailViaMailinator(page, email);

    await page.goto("/login");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: "Acceder" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  }
}
```

to:

```ts
async function signUpAndLogin(page: Page, email: string, phone: string = "+34600000000") {
  await page.goto("/signup");
  await page.locator('input[type="tel"]').pressSequentially(phone, { delay: 20 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  // Organic signup (no invite/pm params) now auto-creates a default Loopy
  // and lands directly on its map (app/signup/page.tsx's
  // resolveDestination -> createDefaultLoop) instead of /dashboard.
  const wentDirect = await page
    .waitForURL(/\/loop\/[^/]+\/mapa/, { timeout: 15000 })
    .then(() => true)
    .catch(() => false);

  if (!wentDirect) {
    // Confirmation required: app/signup/page.tsx shows the "revisa tu
    // email" card instead of redirecting (data.session was null).
    await expect(page.getByText("¡Cuenta creada!")).toBeVisible({ timeout: 5000 });
    await confirmEmailViaMailinator(page, email);

    await page.goto("/login");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: "Acceder" }).click();
    await expect(page).toHaveURL(/\/loop\/[^/]+\/mapa/, { timeout: 15000 });
  }
}
```

- [ ] **Step 2: Fix the first test's loop-creation/join section**

In `test("nav shell: create, join, tabs, map, SOS survive across tabs", ...)`,
change:

```ts
    await signUpAndLogin(page1, USER1.email);
    await signUpAndLogin(page2, USER2.email);

    // Create a Loopy from user1's dashboard. Creating does NOT auto-navigate
    // (app/dashboard/page.tsx's handleCreateLoop only inserts + reloads the
    // list) — the new Loopy shows up as a link in "Tus Loopys" that we then
    // click ourselves.
    const loopName = `QA Shell ${stamp}`;
    await page1.getByPlaceholder(/nombre del loopy/i).fill(loopName);
    await page1.getByRole("button", { name: "Crear Loopy" }).click();

    const loopLink1 = page1.locator("a", { hasText: loopName });
    await expect(loopLink1).toBeVisible({ timeout: 10000 });
    const href = await loopLink1.getAttribute("href");
    loopId = href?.match(/\/loop\/([^/]+)\//)?.[1];
    expect(loopId).toBeTruthy();

    const linkText = await loopLink1.innerText();
    const inviteCode = linkText.match(/Código:\s*(\S+)/)?.[1];
    expect(inviteCode).toBeTruthy();

    // Enter via the bare loop id (not the dashboard link, whose href already
    // points straight at /mapa) so app/loop/[id]/page.tsx's redirect to
    // /mapa actually runs at least once (Finding 7 item 1: this redirect had
    // zero coverage before, since every other entry point in this suite
    // targets a sub-path directly).
    await page1.goto(`/loop/${loopId}`);
    await expect(page1).toHaveURL(new RegExp(`/loop/${loopId}/mapa`), { timeout: 10000 });

    // user2 joins with the invite code — same "no auto-navigate" behavior.
    await page2.getByPlaceholder(/código de invitación/i).fill(inviteCode!);
    await page2.getByRole("button", { name: "Unirme" }).click();

    const loopLink2 = page2.locator("a", { hasText: loopName });
    await expect(loopLink2).toBeVisible({ timeout: 10000 });
    await loopLink2.click();
    await expect(page2).toHaveURL(new RegExp(`/loop/${loopId}/mapa`), { timeout: 10000 });
```

to:

```ts
    await signUpAndLogin(page1, USER1.email);
    await signUpAndLogin(page2, USER2.email);

    // Both users now already have their own auto-created "Mi Loopy" from
    // signUpAndLogin. This test still wants its own named test Loopy, so
    // navigate to /dashboard explicitly (still reachable, just not the
    // default landing spot after signup anymore).
    await page1.goto("/dashboard");

    // Creating a Loopy now auto-navigates straight to its map
    // (app/dashboard/page.tsx's handleCreateLoop -> /mapa, this feature's
    // whole point) instead of staying on /dashboard.
    const loopName = `QA Shell ${stamp}`;
    await page1.getByPlaceholder(/nombre del loopy/i).fill(loopName);
    await page1.getByRole("button", { name: "Crear Loopy" }).click();
    await page1.waitForURL(/\/loop\/[^/]+\/mapa/, { timeout: 10000 });
    loopId = page1.url().match(/\/loop\/([^/]+)\/mapa/)?.[1];
    expect(loopId).toBeTruthy();

    // app/loop/[id]/page.tsx's bare-id redirect to /mapa still exists and
    // still deserves coverage — exercise it explicitly now that the create
    // flow itself no longer goes through it.
    await page1.goto(`/loop/${loopId}`);
    await expect(page1).toHaveURL(new RegExp(`/loop/${loopId}/mapa`), { timeout: 10000 });

    // Read the invite code from Familia (shown there for a fresh Loopy with
    // <=1 member) instead of the old dashboard list-link text, which no
    // longer exists on this path.
    await page1.getByRole("link", { name: "Familia", exact: true }).click();
    await expect(page1).toHaveURL(new RegExp(`/loop/${loopId}/familia$`));
    const codeText = await page1.getByText(/Compartí este código:/).innerText();
    const inviteCode = codeText.match(/Compartí este código:\s*(\S+)/)?.[1];
    expect(inviteCode).toBeTruthy();
    await page1.getByRole("link", { name: "Mapa", exact: true }).click();
    await expect(page1).toHaveURL(new RegExp(`/loop/${loopId}/mapa$`));

    // user2 joins with the invite code from /dashboard — also now
    // auto-navigates straight to the loop's map.
    await page2.goto("/dashboard");
    await page2.getByPlaceholder(/código de invitación/i).fill(inviteCode!);
    await page2.getByRole("button", { name: "Unirme" }).click();
    await expect(page2).toHaveURL(new RegExp(`/loop/${loopId}/mapa`), { timeout: 10000 });
```

- [ ] **Step 3: Fix the second test's loop-creation section**

In `test("familia: admin adds pending member by phone, auto-links on matching signup", ...)`,
change:

```ts
    await signUpAndLogin(page1, `qa.loopy1b.${stamp}@mailinator.com`);

    const loopName = `QA Familia ${stamp}`;
    await page1.getByPlaceholder(/nombre del loopy/i).fill(loopName);
    await page1.getByRole("button", { name: "Crear Loopy" }).click();
    const loopLink = page1.locator("a", { hasText: loopName });
    await expect(loopLink).toBeVisible({ timeout: 10000 });
    const href = await loopLink.getAttribute("href");
    loopId = href?.match(/\/loop\/([^/]+)\//)?.[1];
    expect(loopId).toBeTruthy();
    await loopLink.click();
    await expect(page1).toHaveURL(new RegExp(`/loop/${loopId}/mapa`), { timeout: 10000 });

    await page1.getByRole("link", { name: "Familia", exact: true }).click();
    await expect(page1).toHaveURL(new RegExp(`/loop/${loopId}/familia$`));
```

to:

```ts
    await signUpAndLogin(page1, `qa.loopy1b.${stamp}@mailinator.com`);
    await page1.goto("/dashboard");

    const loopName = `QA Familia ${stamp}`;
    await page1.getByPlaceholder(/nombre del loopy/i).fill(loopName);
    await page1.getByRole("button", { name: "Crear Loopy" }).click();
    await page1.waitForURL(/\/loop\/[^/]+\/mapa/, { timeout: 10000 });
    loopId = page1.url().match(/\/loop\/([^/]+)\/mapa/)?.[1];
    expect(loopId).toBeTruthy();

    await page1.getByRole("link", { name: "Familia", exact: true }).click();
    await expect(page1).toHaveURL(new RegExp(`/loop/${loopId}/familia$`));
```

Further down in the same test, the phone-auto-link sub-flow signs up USER3
organically (no invite/pm params) — after Task 4, USER3's signup
auto-creates their *own* separate default Loopy in addition to being
linked (by the pre-existing phone trigger) into "QA Familia". Change:

```ts
    await signUpAndLogin(page2, USER3.email, AUTO_LINK_PHONE);
    await expect(page2.locator("a", { hasText: loopName })).toBeVisible({ timeout: 15000 });
```

to:

```ts
    await signUpAndLogin(page2, USER3.email, AUTO_LINK_PHONE);
    // USER3's own signup auto-created a separate "Mi Loopy" (Task 4) on top
    // of the phone-trigger auto-link into "QA Familia" — that second Loopy
    // is untracked test debris this suite already accepts for the two
    // mailinator accounts themselves (see cleanupTestData's doc comment);
    // navigate to /dashboard explicitly to see the shared loop as a link.
    await page2.goto("/dashboard");
    await expect(page2.locator("a", { hasText: loopName })).toBeVisible({ timeout: 15000 });
```

- [ ] **Step 4: Run the two updated tests**

Run: `npx playwright test e2e/loop-nav-shell.spec.ts -g "nav shell|familia:"`
Expected: both pass. If a locator times out, read the actual rendered page
via Playwright's HTML report (`npx playwright show-report`) rather than
guessing — the most likely failure mode is a copy/text mismatch (e.g. the
exact "Compartí este código:" string) rather than a logic bug, since the
underlying flows were already proven correct by this same suite before
this task's edits.

- [ ] **Step 5: Add a new test — organic signup auto-creates a default Loopy**

Append this test to the same file (after the two existing `test(...)`
blocks):

```ts
test("signup: organic account auto-creates a default Loopy and lands on its map", async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => localStorage.setItem("loopy-cookie-consent", "accepted"));
  const page = await ctx.newPage();
  await grantGeo(ctx, 40.4168, -3.7038);

  const email = `qa.loopy.organic.${stamp}@mailinator.com`;
  let loopId: string | undefined;

  try {
    await signUpAndLogin(page, email);
    await expect(page).toHaveURL(/\/loop\/[^/]+\/mapa/, { timeout: 15000 });
    loopId = page.url().match(/\/loop\/([^/]+)\/mapa/)?.[1];
    expect(loopId).toBeTruthy();

    // Auto-created default Loopy: name "Mi Loopy", Modo Espejo — no mode
    // picker was ever shown during signup.
    await page.getByRole("link", { name: "Ajustes del Loopy" }).click();
    await expect(page).toHaveURL(new RegExp(`/loop/${loopId}/ajustes$`));
    await expect(page.getByPlaceholder("Nombre del Loopy")).toHaveValue("Mi Loopy");
    await expect(page.locator("text=Modo Espejo")).toBeVisible();
  } finally {
    if (loopId) {
      await cleanupTestData(page, page, loopId).catch((err) => {
        console.warn(
          `[e2e cleanup] best-effort cleanup failed (non-fatal): ${
            err instanceof Error ? err.message : err
          }`
        );
      });
    }
    await ctx.close().catch(() => {});
  }
});
```

Run: `npx playwright test e2e/loop-nav-shell.spec.ts -g "organic account"`
Expected: passes.

- [ ] **Step 6: Add a new test — WhatsApp invite link accept flow**

Append this test to the same file:

```ts
test("invite: admin adds pending member, guest accepts via invite link and gets linked", async ({ browser }) => {
  const ctxAdmin = await browser.newContext();
  await ctxAdmin.addInitScript(() => localStorage.setItem("loopy-cookie-consent", "accepted"));
  const pageAdmin = await ctxAdmin.newPage();
  await grantGeo(ctxAdmin, 40.4168, -3.7038);

  const ctxGuest = await browser.newContext();
  await ctxGuest.addInitScript(() => localStorage.setItem("loopy-cookie-consent", "accepted"));
  const pageGuest = await ctxGuest.newPage();
  await grantGeo(ctxGuest, 40.417, -3.704);

  const adminEmail = `qa.loopy.inviteadmin.${stamp}@mailinator.com`;
  const guestEmail = `qa.loopy.inviteguest.${stamp}@mailinator.com`;

  let loopId: string | undefined;

  try {
    await signUpAndLogin(pageAdmin, adminEmail);
    await pageAdmin.goto("/dashboard");

    const loopName = `QA Invite ${stamp}`;
    await pageAdmin.getByPlaceholder(/nombre del loopy/i).fill(loopName);
    await pageAdmin.getByRole("button", { name: "Crear Loopy" }).click();
    await pageAdmin.waitForURL(/\/loop\/[^/]+\/mapa/, { timeout: 10000 });
    loopId = pageAdmin.url().match(/\/loop\/([^/]+)\/mapa/)?.[1];
    expect(loopId).toBeTruthy();

    await pageAdmin.getByRole("link", { name: "Familia", exact: true }).click();
    await expect(pageAdmin).toHaveURL(new RegExp(`/loop/${loopId}/familia$`));

    await pageAdmin.getByRole("button", { name: "Agregar miembro" }).click();
    await pageAdmin.locator('input[placeholder="Nombre"]').fill("QA Invite Guest");
    await pageAdmin.locator('input[type="tel"]').pressSequentially("+34688777666", { delay: 20 });
    await pageAdmin.getByRole("button", { name: "Agregar", exact: true }).click();
    await expect(pageAdmin.getByText("QA Invite Guest")).toBeVisible({ timeout: 10000 });

    // Stub window.open on the admin's page instead of driving a real
    // WhatsApp popup (unreliable across browser engines, especially with
    // noopener) — this proves the button builds the right wa.me URL
    // without depending on WhatsApp's own site at all.
    await pageAdmin.evaluate(() => {
      (window as unknown as { __capturedWaUrl: string | null }).__capturedWaUrl = null;
      window.open = ((url?: string | URL) => {
        (window as unknown as { __capturedWaUrl: string | null }).__capturedWaUrl = String(url);
        return null;
      }) as typeof window.open;
    });
    await pageAdmin
      .getByRole("button", { name: "Enviar invitación por WhatsApp a QA Invite Guest" })
      .click();
    const waUrlStr = await pageAdmin.evaluate(
      () => (window as unknown as { __capturedWaUrl: string | null }).__capturedWaUrl
    );
    expect(waUrlStr).toBeTruthy();
    const waUrl = new URL(waUrlStr!);
    expect(waUrl.hostname).toBe("wa.me");
    const waText = waUrl.searchParams.get("text") || "";
    const inviteLinkMatch = waText.match(/https:\/\/www\.directloopy\.com\/signup\?invite=\S+/);
    expect(inviteLinkMatch, "WhatsApp message should embed the invite link").toBeTruthy();
    const inviteUrl = new URL(inviteLinkMatch![0]);
    const inviteCode = inviteUrl.searchParams.get("invite");
    const pmId = inviteUrl.searchParams.get("pm");
    expect(inviteCode).toBeTruthy();
    expect(pmId).toBeTruthy();

    // Guest opens the app's own /signup?invite=&pm= — the same path the
    // real WhatsApp link points at (directloopy.com doesn't resolve from
    // this test run, so we hit the local app directly with the same query
    // string instead of following the https://www.directloopy.com host).
    await pageGuest.goto(`/signup?invite=${inviteCode}&pm=${pmId}`);
    await expect(pageGuest.getByRole("heading", { name: "Te invitaron a un Loopy" })).toBeVisible();
    await pageGuest.locator('input[type="tel"]').pressSequentially("+34600111222", { delay: 20 });
    await pageGuest.locator('input[type="email"]').fill(guestEmail);
    await pageGuest.locator('input[type="password"]').fill(PASSWORD);
    await pageGuest.getByRole("button", { name: "Crear cuenta" }).click();

    const wentDirect = await pageGuest
      .waitForURL(new RegExp(`/loop/${loopId}/mapa`), { timeout: 15000 })
      .then(() => true)
      .catch(() => false);

    if (!wentDirect) {
      // Confirmation required — the confirm link must carry invite/pm
      // through emailRedirectTo, and login must complete the acceptance
      // instead of landing on /dashboard.
      await expect(pageGuest.getByText("¡Cuenta creada!")).toBeVisible({ timeout: 5000 });
      await confirmEmailViaMailinator(pageGuest, guestEmail);

      await pageGuest.goto(`/login?invite=${inviteCode}&pm=${pmId}`);
      await pageGuest.locator('input[type="email"]').fill(guestEmail);
      await pageGuest.locator('input[type="password"]').fill(PASSWORD);
      await pageGuest.getByRole("button", { name: "Acceder" }).click();
      await expect(pageGuest).toHaveURL(new RegExp(`/loop/${loopId}/mapa`), { timeout: 15000 });
    }

    // Back on the admin's Familia tab: the pending row is now a real,
    // linked member — no more "Invitado" badge, and the member count is
    // admin + guest = 2.
    await pageAdmin.reload();
    await expect(pageAdmin.getByText("QA Invite Guest")).toHaveCount(0);
    await expect(pageAdmin.getByText("Invitado", { exact: true })).toHaveCount(0);
    await expect(pageAdmin.getByRole("listitem")).toHaveCount(2, { timeout: 10000 });
  } finally {
    if (loopId) {
      await cleanupTestData(pageAdmin, pageGuest, loopId).catch((err) => {
        console.warn(
          `[e2e cleanup] best-effort cleanup failed (non-fatal): ${
            err instanceof Error ? err.message : err
          }`
        );
      });
    }
    await ctxAdmin.close().catch(() => {});
    await ctxGuest.close().catch(() => {});
  }
});
```

Run: `npx playwright test e2e/loop-nav-shell.spec.ts -g "invite:"`
Expected: passes. This is the highest-value test in this plan — it proves
the entire WhatsApp-invite feature end to end against the real app and the
real Supabase project. If `window.open` stubbing doesn't capture the call
(observed to vary across engines in some Playwright setups), fall back to
reading the button's resulting side effect differently: expose
`pending_phone`/`loop.invite_code`/the row's id are not directly visible in
the DOM, so the more robust alternative is asserting on
`page.on("console")`/network — but try the stub approach first, it is the
most direct proof of the actual URL built.

- [ ] **Step 7: Run the full suite once, sequentially**

Run: `npx playwright test e2e/loop-nav-shell.spec.ts --workers=1`
Expected: all four tests pass. `--workers=1` avoids stressing mailinator's
public inbox API / Supabase's built-in email rate limiting by running the
email-confirmation-dependent tests one at a time (see this file's own
header comment on why frequent/concurrent runs can back off delivery).

- [ ] **Step 8: Commit**

```bash
git add e2e/loop-nav-shell.spec.ts
git commit -m "test: update nav-shell e2e for direct-to-map redirects, add signup+invite coverage"
```

---

## Self-Review

**Spec coverage:** Task 3+4 implement spec §1 (direct-to-map, no mode
picker before it). Task 2 implements spec §2 (mode moves into Ajustes).
Task 1+4+5 implement spec §3 (WhatsApp invite: button, URL param
round-trip through signup/login, accept-invite route). Task 6 proves all
three end to end and keeps the pre-existing suite green. No spec
requirement is left without a task.

**Placeholder scan:** every step above contains literal, complete code —
no "TBD"/"add validation"/"similar to Task N" placeholders remain.

**Type consistency:** `acceptInvite(pmId, inviteCode, accessToken)` is
defined once (Task 1) and called with that exact argument order in both
Task 4 call sites (signup, login) and referenced by name (not
re-implemented) in Task 6's e2e comments. `saveLoopSettings(name, mode,
speedLimitKmh, emergencyNumber, primaryContactNumber)` is defined once
(Task 2, `layout.tsx`) and typed once (Task 2, `LoopContext.tsx`) with a
single call site (Task 2, `ajustes/page.tsx`) using that exact order.
`createDefaultLoop(userId, accessToken)` is defined once (Task 1) and
called once (Task 4, signup only — login never auto-creates, per the
approved design). The `invite`/`pm` query-param names are used identically
across Task 4 (signup, login) and Task 5 (the WhatsApp link builder) and
Task 6 (the e2e test reading them back out of the captured `wa.me` URL).
