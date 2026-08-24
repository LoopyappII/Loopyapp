# Familia: alta de miembros por teléfono — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the admin of a Loopy add a family member by name + phone + color before that person has an account; when someone signs up with that exact phone, they're linked to the Loopy automatically.

**Architecture:** `loop_members.user_id` becomes nullable to represent a "pending" seat (name/phone/color stored on the row itself); a new, independent Postgres trigger on `profiles` links pending rows to a real user the moment their phone matches. All application code changes are additive to the existing `LoopContext` pattern established in the Fase 0 shell — no existing method signature changes except `saveLoopSettings` (already done in the prior Group 1 work) stays untouched.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + Realtime + Auth), Tailwind, `react-phone-number-input` (already a dependency), Playwright.

**Spec:** `docs/superpowers/specs/2026-08-24-loopy-familia-alta-miembros-design.md`

## Global Constraints

- Zero changes to any Realtime subscription, geolocation logic, or existing `LoopContext` method signature (`addZone`, `saveAge`, `saveLoopSettings`, `toggleRoute` all stay exactly as they are today).
- New member colors come only from the 6 fixed gradients in the spec — no new hex values invented anywhere else in the diff.
- A pending member (`user_id === null`) never appears in Mapa's or Rutas' member strips (both are driven by live location data a pending member cannot have).
- The migration SQL (schema + trigger) is run by the user directly in Supabase — no task in this plan attempts to run it. Tasks 1-3 don't depend on it at all (pure TypeScript/React); Tasks 4-7 write code that *assumes* it has already been applied, but can't be functionally verified until it has.
- Every new interactive element needs a real `aria-label` or visible text a Playwright test can select by role — this codebase's established convention (see every existing button in `familia/page.tsx`, `sos/page.tsx`).

---

### Task 1: Member color palette

**Files:**
- Create: `lib/memberColors.ts`

**Interfaces:**
- Produces: `MEMBER_COLOR_OPTIONS: { slug: string; from: string; to: string }[]`, `getMemberGradient(slug: string | null | undefined): string` — both consumed by Tasks 5 and 6.

- [ ] **Step 1: Write the file**

```ts
export interface MemberColorOption {
  slug: string;
  from: string;
  to: string;
}

// All 6 pairs are built only from colors already defined in
// tailwind.config (loopy/glow/bridge) — no new hex values.
export const MEMBER_COLOR_OPTIONS: MemberColorOption[] = [
  { slug: "loopy-bridge", from: "#3d4a8a", to: "#834c9c" },
  { slug: "bridge-glow", from: "#834c9c", to: "#ec6fc9" },
  { slug: "loopy-glow", from: "#5b6fc4", to: "#ec6fc9" },
  { slug: "glow-soft", from: "#c94fae", to: "#f6b8e8" },
  { slug: "loopy-deep", from: "#232a52", to: "#4b58a8" },
  { slug: "bridge-soft", from: "#6d3f83", to: "#a06bb8" },
];

export function getMemberGradient(slug: string | null | undefined): string {
  const option = MEMBER_COLOR_OPTIONS.find((o) => o.slug === slug) ?? MEMBER_COLOR_OPTIONS[0];
  return `linear-gradient(135deg, ${option.from}, ${option.to})`;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: succeeds (this file has no dependents yet, so it just needs to type-check on its own).

- [ ] **Step 3: Commit**

```bash
git add lib/memberColors.ts
git commit -m "feat: add fixed gradient palette for member avatars"
```

---

### Task 2: Extend `LoopMember` type

**Files:**
- Modify: `lib/types.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `LoopMember.user_id: string | null` (was `string`), plus `pending_name`, `pending_phone`, `member_color: string | null` — consumed by every later task that reads or writes a `loop_members` row.

- [ ] **Step 1: Edit the `LoopMember` interface**

In `lib/types.ts`, replace:

```ts
export interface LoopMember {
  id: string;
  loop_id: string;
  user_id: string;
  role: MemberRole;
  profiles?: Profile;
}
```

with:

```ts
export interface LoopMember {
  id: string;
  loop_id: string;
  user_id: string | null;
  role: MemberRole;
  pending_name: string | null;
  pending_phone: string | null;
  member_color: string | null;
  profiles?: Profile;
}
```

- [ ] **Step 2: Verify — this WILL fail the build**

Run: `npm run build`
Expected: type errors in `app/loop/[id]/layout.tsx`, `app/loop/[id]/mapa/page.tsx`, `app/loop/[id]/rutas/page.tsx`, `app/loop/[id]/familia/page.tsx` — every place that reads `m.user_id` as a bare `string` (e.g. passed straight into `toggleRoute(uid: string)`). **This is expected and correct** — those call sites get fixed in Tasks 4-6, which is why this task's build is allowed to fail. Do not "fix" this by loosening the type back to `string`; that's the whole point of the migration this type change tracks.

- [ ] **Step 3: Commit anyway**

The failing build is the honest state between this task and the ones that consume it — later tasks fix each error as they touch that file. Commit so the type change has its own reviewable diff.

```bash
git add lib/types.ts
git commit -m "feat: loop_members.user_id becomes nullable for pending members"
```

---

### Task 3: Extend `LoopContextValue`

**Files:**
- Modify: `app/loop/[id]/LoopContext.tsx`

**Interfaces:**
- Consumes: `MemberRole` from `@/lib/types` (already exported, just needs importing here).
- Produces: `addPendingMember`, `updatePendingMemberPhone`, `cancelPendingMember` signatures on `LoopContextValue` — consumed by Task 4 (implementation) and Task 5 (UI).

- [ ] **Step 1: Add the import**

Change:

```ts
import type { Loop, LoopMember, SafeZone, SpeedAlert } from "@/lib/types";
```

to:

```ts
import type { Loop, LoopMember, MemberRole, SafeZone, SpeedAlert } from "@/lib/types";
```

- [ ] **Step 2: Add the three method signatures**

In `LoopContextValue`, right after `saveLoopSettings`'s closing `;`, add:

```ts
  addPendingMember: (
    name: string,
    phone: string,
    colorSlug: string,
    role: MemberRole
  ) => Promise<{ error: string | null }>;
  updatePendingMemberPhone: (memberId: string, phone: string) => Promise<{ error: string | null }>;
  cancelPendingMember: (memberId: string) => Promise<{ error: string | null }>;
```

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: a NEW error, in `app/loop/[id]/layout.tsx`, that the `value: LoopContextValue` object literal is missing `addPendingMember`/`updatePendingMemberPhone`/`cancelPendingMember`. Still expected — fixed in Task 4.

- [ ] **Step 4: Commit**

```bash
git add "app/loop/[id]/LoopContext.tsx"
git commit -m "feat: declare pending-member methods on LoopContextValue"
```

---

### Task 4: Implement the pending-member methods in `layout.tsx`

**Files:**
- Modify: `app/loop/[id]/layout.tsx`

**Interfaces:**
- Consumes: `LoopContextValue`'s new signatures from Task 3, `LoopMember` from Task 2.
- Produces: working `addPendingMember`/`updatePendingMemberPhone`/`cancelPendingMember`, wired into the context `value` object — consumed by Task 5's UI.

- [ ] **Step 1: Add the import**

Change:

```ts
import type { Loop, LoopMember, SafeZone, SpeedAlert } from "@/lib/types";
```

to:

```ts
import type { Loop, LoopMember, MemberRole, SafeZone, SpeedAlert } from "@/lib/types";
```

- [ ] **Step 2: Add the three functions**

Insert right after `saveLoopSettings`'s closing `}` (before `function toggleRoute`):

```ts
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
```

- [ ] **Step 3: Wire into the context value**

In the `value: LoopContextValue = { ... }` object literal, change:

```ts
    addZone,
    saveAge,
    saveLoopSettings,
  };
```

to:

```ts
    addZone,
    saveAge,
    saveLoopSettings,
    addPendingMember,
    updatePendingMemberPhone,
    cancelPendingMember,
  };
```

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: succeeds — this clears the error Task 3 introduced. This only proves the code **compiles**; it does NOT prove the `insert`/`update`/`delete` calls actually succeed against the real Supabase project (that needs the user's migration applied, and is only provable end-to-end in Task 7).

- [ ] **Step 5: Commit**

```bash
git add "app/loop/[id]/layout.tsx"
git commit -m "feat: implement addPendingMember/updatePendingMemberPhone/cancelPendingMember"
```

**Troubleshooting note (read before Task 7, act on it only if needed):** The spec flags an unverifiable risk — `loop_members`'s current Row Level Security policy for INSERT may assume `user_id = auth.uid()` (i.e. "you can only insert a row for yourself"), which would reject `addPendingMember`'s `user_id: null` insert with a permission-denied error. This can only be discovered by actually running Task 7's end-to-end test against the real database. If that test's "admin adds a pending member" step fails with an RLS/permission error (not a network or typo issue), hand the user this policy to run in the Supabase SQL editor, then re-run Task 7's test — do not modify application code to work around an RLS rejection:

```sql
create policy "admin can add pending members"
  on public.loop_members
  for insert
  with check (
    user_id is null
    and exists (
      select 1 from public.loops
      where loops.id = loop_members.loop_id
        and loops.admin_id = auth.uid()
    )
  );
```

---

### Task 5: Familia tab — add-member form and pending-member display

**Files:**
- Modify: `app/loop/[id]/familia/page.tsx`

**Interfaces:**
- Consumes: `addPendingMember`/`updatePendingMemberPhone`/`cancelPendingMember`/`loop`/`isAdmin` from `useLoop()` (Tasks 3-4), `MEMBER_COLOR_OPTIONS`/`getMemberGradient` from `@/lib/memberColors` (Task 1), `MemberRole` from `@/lib/types`.
- Produces: nothing consumed elsewhere — this is a leaf page.

- [ ] **Step 1: Replace the entire file**

```tsx
"use client";

import { useState } from "react";
import { Route as RouteIcon, UserPlus, Pencil, X, Check } from "lucide-react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { useLoop, roleLabel } from "../LoopContext";
import { MEMBER_COLOR_OPTIONS, getMemberGradient } from "@/lib/memberColors";
import type { MemberRole } from "@/lib/types";

export default function FamiliaPage() {
  const {
    loop,
    isAdmin,
    members,
    myAge,
    saveAge,
    routeUserId,
    toggleRoute,
    addPendingMember,
    updatePendingMemberPhone,
    cancelPendingMember,
  } = useLoop();
  const [ageInput, setAgeInput] = useState("");

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newColor, setNewColor] = useState(MEMBER_COLOR_OPTIONS[0].slug);
  const [newRole, setNewRole] = useState<"supervisor" | "tracked">("tracked");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null);
  const [editPhoneValue, setEditPhoneValue] = useState("");

  async function handleSaveAge(e: React.FormEvent) {
    e.preventDefault();
    if (!ageInput) return;
    await saveAge(Number(ageInput));
    setAgeInput("");
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!newName || !newPhone) return;
    setAdding(true);
    setAddError(null);
    const role: MemberRole = loop.mode === "mirror" ? "member" : newRole;
    const { error } = await addPendingMember(newName, newPhone, newColor, role);
    if (error) {
      setAddError(error);
    } else {
      setNewName("");
      setNewPhone("");
      setNewColor(MEMBER_COLOR_OPTIONS[0].slug);
      setShowAddForm(false);
    }
    setAdding(false);
  }

  function startEditPhone(memberId: string, currentPhone: string | null) {
    setEditingPhoneId(memberId);
    setEditPhoneValue(currentPhone || "");
  }

  async function handleSaveEditedPhone(memberId: string) {
    if (!editPhoneValue) return;
    await updatePendingMemberPhone(memberId, editPhoneValue);
    setEditingPhoneId(null);
  }

  return (
    <div className="flex-1 p-4 space-y-4">
      <div className="bg-white rounded-xl border border-loopy-100 shadow-card md:shadow-card-hover p-4 md:p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-loopy-900">Miembros</h2>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="flex items-center gap-1 text-xs font-semibold text-bridge hover:text-loopy-900"
            >
              <UserPlus size={14} />
              Agregar miembro
            </button>
          )}
        </div>
        <ul className="text-sm space-y-2">
          {members.map((m) => {
            const isPending = !m.user_id;
            const displayName = isPending ? m.pending_name || "Invitado" : m.profiles?.name || "Miembro";
            return (
              <li key={m.id} className="flex items-center gap-2 text-loopy-700">
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                  style={{ background: getMemberGradient(m.member_color) }}
                >
                  {displayName.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{displayName}</span>
                    {isPending && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-bridge bg-bridge/10 rounded-full px-1.5 py-0.5 shrink-0">
                        Invitado
                      </span>
                    )}
                  </span>
                  {!isPending && m.profiles?.age ? (
                    <span className="block text-xs text-loopy-700/60">{m.profiles.age} años</span>
                  ) : null}
                  {isPending && editingPhoneId !== m.id && (
                    <span className="block text-xs text-loopy-700/60">{m.pending_phone}</span>
                  )}
                  {isPending && editingPhoneId === m.id && (
                    <span className="mt-1 flex items-center gap-1.5">
                      <PhoneInput
                        international
                        value={editPhoneValue}
                        onChange={(v) => setEditPhoneValue(v || "")}
                        className="loopy-phone-input text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEditedPhone(m.id)}
                        aria-label="Guardar teléfono"
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white bg-bridge shrink-0"
                      >
                        <Check size={12} />
                      </button>
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  {!isPending && <span className="text-xs text-bridge font-medium">{roleLabel(m.role)}</span>}
                  {isPending && isAdmin && editingPhoneId !== m.id && (
                    <button
                      type="button"
                      onClick={() => startEditPhone(m.id, m.pending_phone)}
                      aria-label={`Editar teléfono de ${displayName}`}
                      title="Editar teléfono"
                      className="w-6 h-6 rounded-full flex items-center justify-center text-loopy-700/50 hover:bg-loopy-50 hover:text-bridge"
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                  {isPending && isAdmin && (
                    <button
                      type="button"
                      onClick={() => cancelPendingMember(m.id)}
                      aria-label={`Cancelar invitación de ${displayName}`}
                      title="Cancelar invitación"
                      className="w-6 h-6 rounded-full flex items-center justify-center text-loopy-700/50 hover:bg-red-50 hover:text-red-600"
                    >
                      <X size={13} />
                    </button>
                  )}
                  {!isPending && (
                    <button
                      type="button"
                      onClick={() => toggleRoute(m.user_id as string)}
                      aria-label={`Ver recorrido de ${displayName}`}
                      title="Ver recorrido de hoy en el mapa"
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                        routeUserId === m.user_id
                          ? "bg-glow-500 text-white"
                          : "text-loopy-700/50 hover:bg-loopy-50 hover:text-bridge"
                      }`}
                    >
                      <RouteIcon size={13} />
                    </button>
                  )}
                </span>
              </li>
            );
          })}
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

      {isAdmin && showAddForm && (
        <form
          onSubmit={handleAddMember}
          className="bg-white rounded-xl border border-loopy-100 shadow-card md:shadow-card-hover p-4 md:p-6"
        >
          <h2 className="font-bold text-loopy-900 mb-2 flex items-center gap-1.5">
            <UserPlus size={16} className="text-bridge" />
            Agregar miembro
          </h2>
          <input
            placeholder="Nombre"
            className="w-full mb-3 px-3 py-2 rounded-lg border border-loopy-50 text-sm focus:outline-none focus:ring-2 focus:ring-bridge/60"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
          <PhoneInput
            value={newPhone}
            onChange={(value) => setNewPhone(value || "")}
            placeholder="+34 600 000 000"
            international
            required
            className="loopy-phone-input w-full mb-3"
          />
          <p className="text-xs text-loopy-700/60 mb-2">Color</p>
          <div className="flex gap-2 mb-3">
            {MEMBER_COLOR_OPTIONS.map((opt) => (
              <button
                key={opt.slug}
                type="button"
                onClick={() => setNewColor(opt.slug)}
                aria-label={`Elegir color ${opt.slug}`}
                className={`w-8 h-8 rounded-full shrink-0 transition-transform ${
                  newColor === opt.slug ? "ring-2 ring-loopy-900 ring-offset-2 scale-110" : ""
                }`}
                style={{ background: `linear-gradient(135deg, ${opt.from}, ${opt.to})` }}
              />
            ))}
          </div>
          {loop.mode === "supervision" && (
            <>
              <select
                className="w-full mb-1 px-3 py-2 rounded-lg border border-loopy-50 text-sm"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as "supervisor" | "tracked")}
              >
                <option value="tracked">Comparte su ubicación</option>
                <option value="supervisor">Supervisor</option>
              </select>
              <p className="text-xs text-loopy-700/60 mb-3">Rol dentro del Loopy (Modo Supervisión).</p>
            </>
          )}
          {addError && <p className="text-red-600 text-xs mb-3">{addError}</p>}
          <button
            type="submit"
            disabled={adding}
            className="w-full py-2 rounded-full bg-gradient-to-r from-loopy-700 via-bridge to-glow-500 text-white text-sm font-semibold shadow-cta hover:shadow-cta-hover disabled:opacity-60"
          >
            {adding ? "Agregando..." : "Agregar"}
          </button>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm run build`
Expected: succeeds (this file no longer references `m.user_id` as a bare `string` anywhere unguarded — every use is inside an `!isPending` branch or cast after that check).

- [ ] **Step 3: Commit**

```bash
git add "app/loop/[id]/familia/page.tsx"
git commit -m "feat: add-member form and pending-member display in Familia"
```

---

### Task 6: Exclude pending members from Mapa and Rutas

**Files:**
- Modify: `app/loop/[id]/mapa/page.tsx`
- Modify: `app/loop/[id]/rutas/page.tsx`

**Interfaces:**
- Consumes: `getMemberGradient` from `@/lib/memberColors` (Task 1).
- Produces: nothing consumed elsewhere.

Both files have the exact same "Tu familia" member-avatar strip (a `members.map(...)` rendering a colored circle + name, clicking calls `toggleRoute(m.user_id)`). Apply the identical change to both.

- [ ] **Step 1: `app/loop/[id]/mapa/page.tsx` — add the import**

Change:

```tsx
import { useLoop } from "../LoopContext";
```

to:

```tsx
import { useLoop } from "../LoopContext";
import { getMemberGradient } from "@/lib/memberColors";
```

- [ ] **Step 2: `app/loop/[id]/mapa/page.tsx` — filter and use `member_color`**

Replace:

```tsx
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
```

with:

```tsx
        <div className="flex gap-3 overflow-x-auto pb-1 mb-4">
          {members
            .filter((m) => m.user_id)
            .map((m) => (
              <button
                key={m.id}
                onClick={() => toggleRoute(m.user_id as string)}
                className="flex flex-col items-center gap-1 shrink-0"
                title={`Ver recorrido de ${m.profiles?.name || "miembro"}`}
              >
                <span
                  className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                    routeUserId === m.user_id ? "ring-2 ring-glow-500 ring-offset-2" : ""
                  }`}
                  style={{
                    background: m.member_color
                      ? getMemberGradient(m.member_color)
                      : m.user_id === routeUserId
                      ? "#ec6fc9"
                      : "#5b6fc4",
                  }}
                >
                  {(m.profiles?.name || "?").charAt(0).toUpperCase()}
                </span>
                <span className="text-[11px] text-loopy-700 max-w-[56px] truncate">
                  {m.profiles?.name || "Miembro"}
                </span>
              </button>
            ))}
        </div>
```

- [ ] **Step 3: `app/loop/[id]/rutas/page.tsx` — same two changes**

Add the same import, then apply the identical `.filter((m) => m.user_id)` + `background: m.member_color ? getMemberGradient(...) : ...` + `toggleRoute(m.user_id as string)` transformation to `rutas/page.tsx`'s member-avatar strip (it is byte-for-byte the same block, copied from `mapa/page.tsx` when the Rutas map view was built).

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add "app/loop/[id]/mapa/page.tsx" "app/loop/[id]/rutas/page.tsx"
git commit -m "fix: exclude pending members from Mapa/Rutas strips, apply member_color"
```

---

### Task 7: End-to-end test

**Files:**
- Modify: `e2e/loop-nav-shell.spec.ts`

**Interfaces:**
- Consumes: `signUpAndLogin`, `confirmEmailViaMailinator`, `cleanupTestData`, `grantGeo`, `stamp` — all already defined earlier in this file.

**This task can only be run for real after the user confirms the Supabase migration from the spec has been applied.** Writing/committing the test code doesn't depend on that, but running it does.

- [ ] **Step 1: Make `signUpAndLogin` accept an optional phone**

Change:

```ts
async function signUpAndLogin(page: Page, email: string, name: string) {
  await page.goto("/signup");
  const form = page.locator("form");
  await form.locator("input").first().fill(name); // Nombre: no placeholder/label-for
  await page.locator('input[type="tel"]').pressSequentially("+34600000000", { delay: 20 });
```

to:

```ts
async function signUpAndLogin(page: Page, email: string, name: string, phone: string = "+34600000000") {
  await page.goto("/signup");
  const form = page.locator("form");
  await form.locator("input").first().fill(name); // Nombre: no placeholder/label-for
  await page.locator('input[type="tel"]').pressSequentially(phone, { delay: 20 });
```

(Both existing call sites omit the 4th argument, so they keep using `+34600000000` exactly as before — this change is additive.)

- [ ] **Step 2: Add the new test**

Append after the existing test's closing `});`:

```ts
test("familia: admin adds pending member by phone, auto-links on matching signup", async ({ browser }) => {
  const ctx1 = await browser.newContext();
  await ctx1.addInitScript(() => localStorage.setItem("loopy-cookie-consent", "accepted"));
  const page1 = await ctx1.newPage();
  await grantGeo(ctx1, 40.4168, -3.7038);

  const ctx2 = await browser.newContext();
  await ctx2.addInitScript(() => localStorage.setItem("loopy-cookie-consent", "accepted"));
  const page2 = await ctx2.newPage();
  await grantGeo(ctx2, 40.417, -3.704);

  const USER3 = { email: `qa.loopy3.${stamp}@mailinator.com`, name: "QA Auto" };
  const AUTO_LINK_PHONE = "+34611222333";

  let loopId: string | undefined;

  try {
    await signUpAndLogin(page1, `qa.loopy1b.${stamp}@mailinator.com`, "QA Admin Familia");

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

    // Pending member used only to exercise edit/cancel — never actually signed up.
    await page1.getByRole("button", { name: "Agregar miembro" }).click();
    await page1.locator('input[placeholder="Nombre"]').fill("QA Invitado");
    await page1.locator('input[type="tel"]').pressSequentially("+34699999998", { delay: 20 });
    await page1.getByRole("button", { name: "Agregar", exact: true }).click();
    await expect(page1.getByText("QA Invitado")).toBeVisible({ timeout: 10000 });
    await expect(page1.getByText("Invitado")).toBeVisible();

    // Not shown on Mapa or Rutas — those only list joined (real) members.
    await page1.getByRole("link", { name: "Mapa", exact: true }).click();
    await expect(page1.getByText("QA Invitado")).toHaveCount(0);
    await page1.getByRole("link", { name: "Rutas", exact: true }).click();
    await expect(page1.getByText("QA Invitado")).toHaveCount(0);
    await page1.getByRole("link", { name: "Familia", exact: true }).click();

    // Edit the pending phone, then cancel the invitation.
    await page1.getByRole("button", { name: "Editar teléfono de QA Invitado" }).click();
    await page1.locator('input[type="tel"]').fill("");
    await page1.locator('input[type="tel"]').pressSequentially("+34699999997", { delay: 20 });
    await page1.getByRole("button", { name: "Guardar teléfono" }).click();
    await expect(page1.getByText("+34699999997")).toBeVisible({ timeout: 10000 });

    await page1.getByRole("button", { name: "Cancelar invitación de QA Invitado" }).click();
    await expect(page1.getByText("QA Invitado")).toHaveCount(0, { timeout: 10000 });

    // Real auto-link: add a second pending member with the phone USER3 will
    // sign up with, then have USER3 actually sign up. No manual join step —
    // the Postgres trigger (see the spec's SQL) does the linking.
    await page1.getByRole("button", { name: "Agregar miembro" }).click();
    await page1.locator('input[placeholder="Nombre"]').fill("QA Auto Placeholder");
    await page1.locator('input[type="tel"]').pressSequentially(AUTO_LINK_PHONE, { delay: 20 });
    await page1.getByRole("button", { name: "Agregar", exact: true }).click();
    await expect(page1.getByText("QA Auto Placeholder")).toBeVisible({ timeout: 10000 });

    await signUpAndLogin(page2, USER3.email, USER3.name, AUTO_LINK_PHONE);
    await expect(page2.locator("a", { hasText: loopName })).toBeVisible({ timeout: 15000 });

    await page1.reload();
    await expect(page1.getByText(USER3.name)).toBeVisible({ timeout: 10000 });
    await expect(page1.getByText("QA Auto Placeholder")).toHaveCount(0);
  } finally {
    if (loopId) {
      await cleanupTestData(page1, page2, loopId).catch((err) => {
        console.warn(
          `[e2e cleanup] best-effort cleanup failed (non-fatal): ${
            err instanceof Error ? err.message : err
          }`
        );
      });
    }
    await ctx1.close().catch(() => {});
    await ctx2.close().catch(() => {});
  }
});
```

- [ ] **Step 3: Confirm the migration is live**

Before running, confirm with the user that the spec's SQL (nullable `user_id` + 3 new columns + the `link_pending_loop_members` trigger) has been applied to the real Supabase project. If not yet confirmed, stop here and ask — do not run this test against a database missing the migration, its failures would be uninterpretable (schema errors, not real bugs).

- [ ] **Step 4: Run it**

```bash
pkill -f "next-server" 2>/dev/null; lsof -ti:3000 | xargs -r kill -9 2>/dev/null
npm run build
(npm run start > /tmp/loopy-familia-server.log &) && sleep 4
npx playwright test e2e/loop-nav-shell.spec.ts
```

Expected: both tests pass (`2 passed`). If the new test fails specifically on the "Agregar miembro" submit step with a permission/RLS-shaped error (not a locator-not-found or timeout), see Task 4's Troubleshooting note.

- [ ] **Step 5: Commit**

```bash
git add e2e/loop-nav-shell.spec.ts
git commit -m "test: cover admin-added pending members and phone auto-link"
```

---

## Self-review (already run against this plan)

- **Spec coverage:** schema/trigger → documented as user-run SQL, referenced by Task 4/7 (not a code task); add-member form (name/phone/color/role) → Task 5; pending display + edit + cancel → Task 5; Mapa/Rutas exclusion → Task 6; color palette → Task 1; RLS risk → Task 4's troubleshooting note + Task 7 step 3; end-to-end proof of the auto-link → Task 7. No spec section without a task.
- **Type consistency:** `LoopMember.user_id: string | null` (Task 2) is consumed consistently everywhere as `m.user_id as string` only after a `.filter((m) => m.user_id)` or `!isPending` guard (Tasks 5-6) — no bare unguarded use remains. `addPendingMember(name, phone, colorSlug, role)` has the same 4-argument order in its Task 3 declaration, Task 4 implementation, and Task 5 call site. `getMemberGradient`/`MEMBER_COLOR_OPTIONS` names and shapes match between Task 1's definition and Tasks 5-6's usage.
- **Placeholder scan:** none found — every step has real, complete code; the one deliberately-failing build (Task 2, Task 3) is explained inline, not left vague.
