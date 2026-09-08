# Loopy: alta mínima + trial de 1 día sin tarjeta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El alta solo pide email/contraseña/teléfono; el nombre completo se
difiere hasta que el día gratis de prueba termina. El trial de 1 día pasa a
tener una fila real y verificable en `loop_subscriptions` (calculada por el
servidor, nunca por el cliente) en vez de comparar `loops.created_at` sin
protección — cerrando el exploit de acceso gratis permanente que encontró la
revisión de seguridad. Una cuenta solo puede usar ese trial sin tarjeta una
vez, sin importar en cuántos Loopys distintos lo intente.

**Architecture:** `app/api/loops/start-trial/route.ts` (nuevo) reemplaza la
llamada a `/api/stripe/checkout` que hacía `handleCreateLoop` al crear un
Loopy — inserta una fila `loop_subscriptions` con `status: "trialing_no_card"`
y un `trial_end` calculado en el servidor, después de comprobar elegibilidad
por cuenta. `hasLoopAccess` gana un segundo parámetro (`trialEnd`) para poder
vencer ese estado con el tiempo real, y una función hermana `needsActivation`
decide si al usuario sin acceso hay que mandarlo a la pantalla nueva
`/loop/[id]/activar` (nunca tuvo suscripción, o su trial venció — falta
nombre + pago) o a la pantalla existente `/loop/[id]/suscripcion` (ya tuvo una
suscripción real de Stripe — reactivar/gestionar pago). `/activar` guarda el
nombre diferido y reusa el checkout de Stripe existente, al que se le agrega
`tax_id_collection` nativo (solo empresas, opcional) para cerrar la Sección C
sin tabla ni formulario propio.

**Tech Stack:** Next.js 14 (App Router) + TypeScript + Supabase (Postgres +
Auth + RLS) + Stripe Checkout. Testing: Playwright (`@playwright/test`) —
único framework de test instalado en este repo, tanto para e2e de browser
real como para pruebas puras de funciones (no hay jest/vitest).

**Spec:** `docs/superpowers/specs/2026-09-07-loopy-trial-sin-tarjeta-design.md`
(commit `fbe9deb`, cerrado y aprobado).

## Global Constraints

- **Sin migración de base de datos.** `loop_subscriptions.status` es
  `text not null default 'incomplete'` sin `CHECK` constraint (confirmado en
  `docs/superpowers/specs/2026-08-31-loop-subscriptions.sql:11`) y
  `trial_end timestamptz` ya existe en esa misma tabla — `"trialing_no_card"`
  es directamente insertable, sin tocar Supabase Dashboard.
- **El teléfono NO se saca del alta** — sigue siendo obligatorio en
  `app/signup/page.tsx`, junto a email/contraseña. Solo se saca "Nombre".
- **`"trialing_no_card"` NUNCA entra a `ACCESS_GRANTING_STATUSES`.** Es un
  estado con vencimiento real (a diferencia de `admin_bypass`, que es
  permanente a propósito) — se resuelve exclusivamente dentro de
  `hasLoopAccess` comparando `trial_end` contra `new Date()`. Agregarlo a esa
  lista reabre exactamente el bug que la revisión de seguridad encontró y que
  ya se corrigió en el spec (el trial nunca vencería).
- **Duración del trial: 1 día**, sin cambios — `TRIAL_DAYS = 1` en el nuevo
  endpoint.
- **Elegibilidad por cuenta — ligera desviación deliberada del SQL
  ilustrativo del spec:** el spec describe la comprobación como
  `ls.status = 'trialing_no_card' and ls.trial_end < now()` (es decir, solo
  bloquea si el trial anterior ya venció). Tal como está escrito, esa
  condición de tiempo NO bloquea un segundo Loopy creado mientras el primer
  trial todavía está vigente — reabriría la puerta a crear varios Loopys
  "de un tirón" con trials simultáneos, que es justamente el abuso que este
  chequeo existe para cerrar. Este plan implementa el chequeo sin la
  condición de tiempo: **cualquier fila `trialing_no_card` previa de esta
  cuenta, vigente o vencida, la deja inelegible para otro trial.** Es
  estrictamente más seguro y más simple de razonar; no afecta a ningún otro
  punto del spec.
- **No se pide documento de identidad personal a nadie.** Solo
  `tax_id_collection: { enabled: true }` nativo de Stripe (opcional,
  solo-empresa) en `checkout.sessions.create`. Sin tabla nueva, sin RLS
  nueva, sin cambios a `app/privacidad/page.tsx`.
- **Fuera de alcance, a propósito (no tocar en este plan):** las políticas
  RLS de `locations`/`sos_alerts`/`safe_zones`/`zone_events`/`speed_alerts`
  no dependen del estado de la suscripción — hallazgo preexistente, el
  usuario decidió tratarlo como su propio ítem de seguridad aparte. Bypass de
  admin, alta de familiares por teléfono + ubicación previa, Zonas, SOS,
  Mapa/Rutas, selección de rol en signup: sin cambios.

---

### Task 1: Signup simplificado — sacar "Nombre" del alta

**Files:**
- Modify: `app/signup/page.tsx`
- Modify: `e2e/loop-nav-shell.spec.ts`
- Modify: `e2e/stripe-billing.spec.ts`

**Interfaces:**
- Consumes: nada nuevo — sigue usando `supabase.auth.signUp` tal como hoy,
  solo sin el campo `name`.
- Produces: sin cambios de interfaz pública. `signUpAndLogin(page, email,
  phone?)` en ambos specs e2e pierde su parámetro `name` — todo el resto de
  este plan que dispare un signup nuevo debe llamarlo con esta firma.

- [ ] **Step 1: Sacar el campo "Nombre" de `app/signup/page.tsx`**

Reescribir el archivo completo (mismo diseño, sin el estado ni el campo de
nombre, y sin mandar `name` en el signup):

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { supabase } from "@/lib/supabaseClient";
import { NavbarLogo } from "@/components/LoopyLogo";
import { fadeInUp, scaleIn } from "@/lib/motion";

export default function SignupPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone) {
      setError("El teléfono es obligatorio.");
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { phone },
        emailRedirectTo: "https://loopy.company/login",
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      router.push("/dashboard");
    } else {
      setDone(true);
    }
  }

  return (
    <main className="relative min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto w-full">
        <Link href="/">
          <NavbarLogo size={32} dark />
        </Link>
        <Link
          href="/login"
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
              href="/login"
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
                Súmate a Loopy
              </h1>
              <p className="text-sm text-loopy-700 text-center mt-1">
                Gratis el primer día, 14,99€/mes después.
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
                <Link href="/login" className="text-bridge font-medium">
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

- [ ] **Step 2: Correr el build para confirmar que compila**

Run: `npm run build`
Expected: build limpio, sin errores de tipos.

- [ ] **Step 3: Arreglar `signUpAndLogin` en `e2e/loop-nav-shell.spec.ts`**

Este helper llenaba el primer `<input>` del form con un nombre — ese input ya
no existe. En `e2e/loop-nav-shell.spec.ts`, reemplazar (línea ~212):

```ts
async function signUpAndLogin(page: Page, email: string, name: string, phone: string = "+34600000000") {
  await page.goto("/signup");
  const form = page.locator("form");
  await form.locator("input").first().fill(name); // Nombre: no placeholder/label-for
  await page.locator('input[type="tel"]').pressSequentially(phone, { delay: 20 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
```

por:

```ts
async function signUpAndLogin(page: Page, email: string, phone: string = "+34600000000") {
  await page.goto("/signup");
  await page.locator('input[type="tel"]').pressSequentially(phone, { delay: 20 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
```

(el resto de la función, desde `const wentToDashboard = ...` hasta el cierre,
queda igual — no lo repitas cambiado, ese bloque no toca ningún input de
nombre).

Actualizar los 4 call sites de `signUpAndLogin` en este mismo archivo:

- Línea ~27-28, sacar el campo `name` de los objetos (ya no se usa para
  nada más en el archivo):
  ```ts
  const USER1 = { email: `qa.loopy1.${stamp}@mailinator.com` };
  const USER2 = { email: `qa.loopy2.${stamp}@mailinator.com` };
  ```
- Línea ~273-274:
  ```ts
  await signUpAndLogin(page1, USER1.email);
  await signUpAndLogin(page2, USER2.email);
  ```
- Línea ~428, sacar el campo `name` de `USER3` también:
  ```ts
  const USER3 = { email: `qa.loopy3.${stamp}@mailinator.com` };
  ```
- Línea ~434:
  ```ts
  await signUpAndLogin(page1, `qa.loopy1b.${stamp}@mailinator.com`);
  ```
- Línea ~496:
  ```ts
  await signUpAndLogin(page2, USER3.email, AUTO_LINK_PHONE);
  ```

- [ ] **Step 4: Arreglar la aserción de auto-link que dependía del nombre**

USER3 ya no tiene `profiles.name` al vincularse (el signup ya no lo pide),
así que después del auto-link por teléfono va a mostrar el fallback
"Miembro" en vez de "QA Auto" — y ese mismo texto "Miembro" puede aparecer
más de una vez en la página (nombre Y etiqueta de rol pueden coincidir), así
que no sirve como selector único. Reemplazar, en `e2e/loop-nav-shell.spec.ts`
(línea ~500):

```ts
    await page1.reload();
    await expect(page1.getByText(USER3.name)).toBeVisible({ timeout: 10000 });
    await expect(page1.getByText("QA Auto Placeholder")).toHaveCount(0);
```

por:

```ts
    await page1.reload();
    // USER3 ya no tiene profiles.name (el signup ya no lo pide) — en vez de
    // buscar un nombre real, confirmamos el auto-link por estructura: el
    // placeholder pendiente desapareció, no queda ninguna etiqueta
    // "Invitado", y la lista de miembros tiene exactamente 2 filas (admin +
    // USER3 ya vinculado) — "QA Invitado" ya se había cancelado antes.
    await expect(page1.getByText("QA Auto Placeholder")).toHaveCount(0);
    await expect(page1.getByText("Invitado", { exact: true })).toHaveCount(0);
    await expect(page1.getByRole("listitem")).toHaveCount(2, { timeout: 10000 });
```

- [ ] **Step 5: Mismo arreglo de `signUpAndLogin` en `e2e/stripe-billing.spec.ts`**

Reemplazar (línea ~131):

```ts
async function signUpAndLogin(page: Page, email: string, name: string, phone: string = "+34600000000") {
  await page.goto("/signup");
  const form = page.locator("form");
  await form.locator("input").first().fill(name); // Nombre: no placeholder/label-for
  await page.locator('input[type="tel"]').pressSequentially(phone, { delay: 20 });
```

por:

```ts
async function signUpAndLogin(page: Page, email: string, phone: string = "+34600000000") {
  await page.goto("/signup");
  await page.locator('input[type="tel"]').pressSequentially(phone, { delay: 20 });
```

(el resto de la función, igual sin cambios). Actualizar los 4 call sites en
este archivo, sacando el argumento de nombre (líneas ~178, ~183, ~200, ~268):

```ts
await signUpAndLogin(adminPage, `qa.loopy.stripe.admin.${stamp}@mailinator.com`);
await signUpAndLogin(otherPage, `qa.loopy.stripe.other.${stamp}@mailinator.com`);
await signUpAndLogin(adminPage, `qa.loopy.stripe.wh.${stamp}@mailinator.com`);
await signUpAndLogin(page, `qa.loopy.stripe.gate.${stamp}@mailinator.com`);
```

(la última de estas cuatro llamadas, en la tercer prueba del archivo, se
reescribe de fondo en la Task 8 — acá alcanza con sacarle el nombre para que
compile mientras tanto).

- [ ] **Step 6: Commit**

```bash
git add app/signup/page.tsx e2e/loop-nav-shell.spec.ts e2e/stripe-billing.spec.ts
git commit -m "feat: sacar 'Nombre' del alta, diferirlo a /activar"
```

---

### Task 2: `hasLoopAccess` con vencimiento real + `needsActivation`

**Files:**
- Modify: `lib/types.ts`
- Modify: `app/loop/[id]/suscripcion/page.tsx`
- Create: `e2e/has-loop-access.spec.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces (para las Tasks 3, 5, 6, 8):
  - `SubscriptionStatus` incluye `"trialing_no_card"`.
  - `hasLoopAccess(status: SubscriptionStatus | null | undefined, trialEnd?: string | null): boolean`
  - `needsActivation(status: SubscriptionStatus | null | undefined, trialEnd?: string | null): boolean`
  - Invariante que las Tasks siguientes pueden asumir: `hasLoopAccess(s, t)`
    y `needsActivation(s, t)` nunca son `true` al mismo tiempo para los
    mismos `(s, t)`.

- [ ] **Step 1: Escribir el test (falla porque `needsActivation` no existe todavía)**

Crear `e2e/has-loop-access.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { hasLoopAccess, needsActivation } from "../lib/types";

/**
 * Prueba pura de lib/types.ts — sin browser, sin red, sin base de datos.
 * Vive en e2e/ solo porque es el único testDir configurado en
 * playwright.config.ts; a diferencia del resto de este directorio, corre
 * instantáneo y de forma determinística. Existe porque el vencimiento real
 * de "trialing_no_card" (Sección B del spec de 2026-09-07) no se puede
 * cubrir de forma realista con un test end-to-end: nadie puede esperar un
 * día real a que un trial venza en medio de una corrida de Playwright.
 * Import relativo (no "@/lib/types") a propósito: el alias "@/*" nunca fue
 * ejercitado por Playwright en este repo antes de este archivo.
 */
test.describe("hasLoopAccess / needsActivation", () => {
  test("sin estado: sin acceso, hace falta activar", () => {
    expect(hasLoopAccess(null)).toBe(false);
    expect(needsActivation(null)).toBe(true);
  });

  test("trialing_no_card con trial_end futuro: acceso, no hace falta activar", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(hasLoopAccess("trialing_no_card", future)).toBe(true);
    expect(needsActivation("trialing_no_card", future)).toBe(false);
  });

  test("trialing_no_card con trial_end pasado: sin acceso, hace falta activar", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(hasLoopAccess("trialing_no_card", past)).toBe(false);
    expect(needsActivation("trialing_no_card", past)).toBe(true);
  });

  test("trialing_no_card sin trial_end (fila inconsistente): sin acceso, hace falta activar", () => {
    expect(hasLoopAccess("trialing_no_card", null)).toBe(false);
    expect(needsActivation("trialing_no_card", null)).toBe(true);
  });

  test("admin_bypass: acceso permanente, nunca hace falta activar", () => {
    expect(hasLoopAccess("admin_bypass")).toBe(true);
    expect(needsActivation("admin_bypass")).toBe(false);
  });

  test("trialing/active/past_due (Stripe real): acceso, nunca hace falta activar", () => {
    for (const status of ["trialing", "active", "past_due"] as const) {
      expect(hasLoopAccess(status)).toBe(true);
      expect(needsActivation(status)).toBe(false);
    }
  });

  test("canceled/unpaid/incomplete/incomplete_expired/paused: sin acceso, y van a /suscripcion (no a /activar)", () => {
    for (const status of ["canceled", "unpaid", "incomplete", "incomplete_expired", "paused"] as const) {
      expect(hasLoopAccess(status)).toBe(false);
      expect(needsActivation(status)).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx playwright test e2e/has-loop-access.spec.ts`
Expected: FAIL — `needsActivation` no existe en `lib/types.ts`, y
`"trialing_no_card"` no es un `SubscriptionStatus` válido (error de tipos).

- [ ] **Step 3: Implementar en `lib/types.ts`**

Reemplazar el bloque de `SubscriptionStatus` (agregar el nuevo miembro al
final de la unión):

```ts
export type SubscriptionStatus =
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused"
  // Estado local, nunca viene de Stripe: un admin en la lista de
  // ADMIN_BYPASS_EMAILS (ver app/api/stripe/checkout/route.ts) que crea o
  // usa un Loopy sin pasar por el pago real. Solo para pruebas/uso interno.
  | "admin_bypass"
  // Estado local, nunca viene de Stripe: el día gratis sin tarjeta que se
  // activa al crear el primer Loopy (ver app/api/loops/start-trial/route.ts).
  // A diferencia de "trialing" (que sí viene de Stripe y ya tiene tarjeta
  // cargada), este vence de verdad — ver `trial_end` y `hasLoopAccess`.
  | "trialing_no_card";
```

Reemplazar el bloque final del archivo (`ACCESS_GRANTING_STATUSES` +
`hasLoopAccess`):

```ts
const ACCESS_GRANTING_STATUSES: SubscriptionStatus[] = ["trialing", "active", "past_due", "admin_bypass"];

export function hasLoopAccess(status: SubscriptionStatus | null | undefined): boolean {
  return !!status && ACCESS_GRANTING_STATUSES.includes(status);
}
```

por:

```ts
const ACCESS_GRANTING_STATUSES: SubscriptionStatus[] = ["trialing", "active", "past_due", "admin_bypass"];

// "trialing_no_card" queda deliberadamente fuera de ACCESS_GRANTING_STATUSES:
// a diferencia de los demás estados de esta lista, este vence — necesita el
// dato de tiempo (`trialEnd`), no solo el texto del estado. Agregarlo acá
// directamente haría que el trial sin tarjeta nunca terminara.
export function hasLoopAccess(
  status: SubscriptionStatus | null | undefined,
  trialEnd?: string | null
): boolean {
  if (!status) return false;
  if (status === "trialing_no_card") {
    return !!trialEnd && new Date(trialEnd) > new Date();
  }
  return ACCESS_GRANTING_STATUSES.includes(status);
}

// Para quien NO tiene acceso, decide a dónde mandarlo: /activar (nunca tuvo
// suscripción, o tuvo un trial sin tarjeta que ya venció — falta nombre +
// pago por primera vez) vs /suscripcion (ya tuvo una suscripción real de
// Stripe alguna vez — reactivar/gestionar pago, sin volver a pedir nombre).
export function needsActivation(
  status: SubscriptionStatus | null | undefined,
  trialEnd?: string | null
): boolean {
  if (!status) return true;
  if (status === "trialing_no_card") {
    return !trialEnd || new Date(trialEnd) <= new Date();
  }
  return false;
}
```

- [ ] **Step 4: Correr el test de nuevo y confirmar que pasa**

Run: `npx playwright test e2e/has-loop-access.spec.ts`
Expected: PASS — 7/7 tests verdes.

- [ ] **Step 5: Arreglar `app/loop/[id]/suscripcion/page.tsx` (rompe de tipos por el nuevo miembro de la unión)**

`STATUS_COPY` es un `Record<SubscriptionStatus | "none", ...>` — con el
nuevo miembro de la unión, TypeScript exige una entrada para
`"trialing_no_card"` o el archivo no compila. En la práctica el gate nunca
manda acá con este estado (manda a `/activar`), pero hay que cubrir a quien
navegue manualmente a `/suscripcion`. Agregar, dentro del objeto
`STATUS_COPY` (después de la entrada `admin_bypass`):

```ts
  // En la práctica nunca se ve: mientras el trial sin tarjeta está vigente
  // hay acceso (hasLoopAccess), y cuando vence, el gate manda a /activar en
  // vez de acá. Solo cubre a alguien que navega manualmente a /suscripcion.
  trialing_no_card: {
    title: "Tu día de prueba gratis terminó",
    body: "Volvé a tu Loopy — te vamos a pedir los datos que faltan para activarlo.",
  },
```

Y en el JSX, extender la condición que ya oculta el botón para
`admin_bypass` para que también lo oculte acá (reemplazar):

```tsx
      {status === "admin_bypass" ? null : isAdmin ? (
```

por:

```tsx
      {status === "admin_bypass" || status === "trialing_no_card" ? null : isAdmin ? (
```

- [ ] **Step 6: Build limpio**

Run: `npm run build`
Expected: sin errores de tipos.

- [ ] **Step 7: Commit**

```bash
git add lib/types.ts app/loop/[id]/suscripcion/page.tsx e2e/has-loop-access.spec.ts
git commit -m "feat: hasLoopAccess/needsActivation con vencimiento real de trialing_no_card"
```

---

### Task 3: Endpoint `/api/loops/start-trial`

**Files:**
- Create: `app/api/loops/start-trial/route.ts`

**Interfaces:**
- Consumes: `requireLoopAdmin` (`lib/stripeAuth.ts`), `isAdminBypassEmail`
  (`lib/adminBypass.ts`), `supabaseAdmin` (`lib/supabaseAdmin.ts`),
  `SubscriptionStatus` de `lib/types.ts` (solo como referencia de los
  valores de texto usados, sin importarlo — el `status` se manda como
  string literal).
- Produces (para la Task 4): `POST /api/loops/start-trial` con body
  `{ loopId: string }` y header `Authorization: Bearer <access_token>`.
  Respuestas: `{ bypass: true }` (admin bypass activado), `{ trial: true,
  trialEnd: string }` (trial activado), `{ trial: false, reason:
  "already_used" }` (cuenta ya usó su trial — sin fila nueva), o `{ error:
  string }` con status 400/401/403/404/500.

- [ ] **Step 1: Crear `app/api/loops/start-trial/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireLoopAdmin } from "@/lib/stripeAuth";
import { isAdminBypassEmail } from "@/lib/adminBypass";

const TRIAL_DAYS = 1;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { loopId?: string };
  const auth = await requireLoopAdmin(req, body.loopId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const loopId = auth.loop.id;

  // Mismo camino que app/api/stripe/checkout/route.ts: un admin en
  // ADMIN_BYPASS_EMAILS nunca pasa por Stripe, ni siquiera para el trial de
  // 1 día — queda con acceso permanente desde el momento en que crea el
  // Loopy, sin pasar nunca por /activar.
  if (isAdminBypassEmail(auth.userEmail)) {
    const { error } = await supabaseAdmin.from("loop_subscriptions").upsert(
      {
        loop_id: loopId,
        stripe_customer_id: `admin_bypass_${loopId}`,
        stripe_subscription_id: `admin_bypass_${loopId}`,
        status: "admin_bypass",
      },
      { onConflict: "loop_id" }
    );
    if (error) {
      return NextResponse.json(
        { error: `No se pudo activar el acceso de administrador: ${error.message}` },
        { status: 500 }
      );
    }
    return NextResponse.json({ bypass: true });
  }

  // Elegibilidad por cuenta: si este admin ya tuvo un trial sin tarjeta en
  // cualquier Loopy anterior (vigente o vencido), este Loopy nuevo no
  // recibe otro — sin esto, se podrían crear Loopys sin fin para tener
  // siempre "un día gratis" nuevo.
  const { data: ownLoops, error: ownLoopsError } = await supabaseAdmin
    .from("loops")
    .select("id")
    .eq("admin_id", auth.userId);
  if (ownLoopsError) {
    return NextResponse.json(
      { error: `No se pudo verificar elegibilidad para el trial: ${ownLoopsError.message}` },
      { status: 500 }
    );
  }
  const ownLoopIds = (ownLoops || []).map((l) => l.id as string);

  let alreadyUsedTrial = false;
  if (ownLoopIds.length > 0) {
    const { data: priorTrial, error: priorTrialError } = await supabaseAdmin
      .from("loop_subscriptions")
      .select("loop_id")
      .in("loop_id", ownLoopIds)
      .eq("status", "trialing_no_card")
      .limit(1);
    if (priorTrialError) {
      return NextResponse.json(
        { error: `No se pudo verificar elegibilidad para el trial: ${priorTrialError.message}` },
        { status: 500 }
      );
    }
    alreadyUsedTrial = (priorTrial || []).length > 0;
  }

  if (alreadyUsedTrial) {
    return NextResponse.json({ trial: false, reason: "already_used" });
  }

  const trialEnd = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error: insertError } = await supabaseAdmin.from("loop_subscriptions").upsert(
    {
      loop_id: loopId,
      stripe_customer_id: `trial_no_card_${loopId}`,
      stripe_subscription_id: `trial_no_card_${loopId}`,
      status: "trialing_no_card",
      trial_end: trialEnd,
    },
    { onConflict: "loop_id" }
  );
  if (insertError) {
    return NextResponse.json(
      { error: `No se pudo activar el trial: ${insertError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ trial: true, trialEnd });
}
```

- [ ] **Step 2: Build limpio**

Run: `npm run build`
Expected: sin errores de tipos.

- [ ] **Step 3: Commit**

```bash
git add app/api/loops/start-trial/route.ts
git commit -m "feat: endpoint /api/loops/start-trial (trial sin tarjeta, elegibilidad por cuenta)"
```

---

### Task 4: `handleCreateLoop` llama al nuevo endpoint

**Files:**
- Modify: `app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `POST /api/loops/start-trial` (Task 3).
- Produces: sin cambios de interfaz — `handleCreateLoop` sigue navegando a
  `/loop/{id}/familia` al final, el gate (Task 5) decide desde ahí.

- [ ] **Step 1: Reemplazar la llamada a checkout por la llamada a start-trial**

En `app/dashboard/page.tsx`, dentro de `handleCreateLoop` (línea ~90-108),
reemplazar:

```ts
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    try {
      if (!accessToken) throw new Error("Sin sesión");
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ loopId: loop.id }),
      });
      const json = await res.json();
      if (res.ok && json.url) {
        window.location.href = json.url;
        return;
      }
    } catch {
      // Seguimos con la navegación normal — el layout del Loopy gatea el
      // acceso igual si la suscripción no quedó creada.
    }
    router.push(`/loop/${loop.id}/familia`);
```

por:

```ts
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    try {
      if (accessToken) {
        await fetch("/api/loops/start-trial", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ loopId: loop.id }),
        });
      }
    } catch {
      // Seguimos con la navegación normal — el layout del Loopy gatea el
      // acceso igual si el trial no quedó activado (manda a /activar).
    }
    router.push(`/loop/${loop.id}/familia`);
```

Este endpoint nunca devuelve una URL de redirección (no hay Stripe
involucrado al crear el trial), así que no hace falta ninguna rama de
`if (res.ok && json.url)` acá — el gate del layout es la única fuente de
verdad sobre a dónde termina yendo el usuario.

- [ ] **Step 2: Build limpio**

Run: `npm run build`
Expected: sin errores de tipos.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: crear Loopy activa el trial sin tarjeta en vez de ir directo a Stripe"
```

---

### Task 5: Gate de acceso — `trialEnd` + ruta a `/activar`

**Files:**
- Modify: `app/loop/[id]/layout.tsx`
- Modify: `app/loop/[id]/LoopContext.tsx`

**Interfaces:**
- Consumes: `hasLoopAccess`, `needsActivation` (Task 2).
- Produces (para la Task 6): `useLoop().trialEnd: string | null` disponible
  en cualquier página hija, incluida la nueva `/activar`. El gate redirige a
  `/loop/{id}/activar` en vez de `/loop/{id}/suscripcion` exactamente cuando
  `needsActivation(subscriptionStatus, trialEnd)` es `true`.

- [ ] **Step 1: Agregar `trialEnd` a `LoopContextValue` en `LoopContext.tsx`**

En `app/loop/[id]/LoopContext.tsx`, agregar el campo justo después de
`subscriptionStatus` en la interfaz:

```ts
  subscriptionStatus: SubscriptionStatus | null;
  trialEnd: string | null;
```

- [ ] **Step 2: Agregar el estado y actualizar el import en `layout.tsx`**

En `app/loop/[id]/layout.tsx`, reemplazar el import:

```ts
import { hasLoopAccess } from "@/lib/types";
```

por:

```ts
import { hasLoopAccess, needsActivation } from "@/lib/types";
```

Y agregar el estado justo después de `subscriptionStatus` (línea ~25):

```ts
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [trialEnd, setTrialEnd] = useState<string | null>(null);
```

- [ ] **Step 3: Traer `trial_end` en `loadLoopData`**

Reemplazar (línea ~71-76):

```ts
    const { data: subRow } = await supabase
      .from("loop_subscriptions")
      .select("status")
      .eq("loop_id", loopId)
      .maybeSingle();
    setSubscriptionStatus((subRow?.status as SubscriptionStatus | undefined) ?? null);
```

por:

```ts
    const { data: subRow } = await supabase
      .from("loop_subscriptions")
      .select("status, trial_end")
      .eq("loop_id", loopId)
      .maybeSingle();
    setSubscriptionStatus((subRow?.status as SubscriptionStatus | undefined) ?? null);
    setTrialEnd(subRow?.trial_end ?? null);
```

- [ ] **Step 4: Reescribir el efecto de redirección**

Reemplazar el efecto completo (línea ~297-336):

```ts
  useEffect(() => {
    if (loading || !loop) return;
    const onSuscripcion = pathname === `/loop/${loopId}/suscripcion`;
    if (onSuscripcion || hasLoopAccess(subscriptionStatus)) return;

    const justPaid =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("checkout") === "success";
    if (!justPaid) {
      router.replace(`/loop/${loopId}/suscripcion`);
      return;
    }

    // Venimos de un pago recién hecho — el webhook puede tardar unos
    // cientos de ms en escribir la fila. Reintentamos unas pocas veces
    // antes de mandar a la pantalla de "sin suscripción" a alguien que
    // ya pagó.
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (cancelled) return;
        const { data: subRow } = await supabase
          .from("loop_subscriptions")
          .select("status")
          .eq("loop_id", loopId)
          .maybeSingle();
        const status = (subRow?.status as SubscriptionStatus | undefined) ?? null;
        if (hasLoopAccess(status)) {
          if (!cancelled) setSubscriptionStatus(status);
          return;
        }
      }
      if (!cancelled) router.replace(`/loop/${loopId}/suscripcion`);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, loop, subscriptionStatus, pathname, loopId]);
```

por:

```ts
  useEffect(() => {
    if (loading || !loop) return;
    const onSuscripcion = pathname === `/loop/${loopId}/suscripcion`;
    const onActivar = pathname === `/loop/${loopId}/activar`;
    if (onSuscripcion || onActivar || hasLoopAccess(subscriptionStatus, trialEnd)) return;

    // /activar: nunca tuvo suscripción, o tuvo un trial sin tarjeta que ya
    // venció — falta nombre + pago por primera vez. /suscripcion: ya tuvo
    // una suscripción real de Stripe alguna vez (reactivar/gestionar pago).
    if (needsActivation(subscriptionStatus, trialEnd)) {
      router.replace(`/loop/${loopId}/activar`);
      return;
    }

    const justPaid =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("checkout") === "success";
    if (!justPaid) {
      router.replace(`/loop/${loopId}/suscripcion`);
      return;
    }

    // Venimos de un pago recién hecho — el webhook puede tardar unos
    // cientos de ms en escribir la fila. Reintentamos unas pocas veces
    // antes de mandar a la pantalla de "sin suscripción" a alguien que
    // ya pagó.
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (cancelled) return;
        const { data: subRow } = await supabase
          .from("loop_subscriptions")
          .select("status, trial_end")
          .eq("loop_id", loopId)
          .maybeSingle();
        const status = (subRow?.status as SubscriptionStatus | undefined) ?? null;
        const newTrialEnd = subRow?.trial_end ?? null;
        if (hasLoopAccess(status, newTrialEnd)) {
          if (!cancelled) {
            setSubscriptionStatus(status);
            setTrialEnd(newTrialEnd);
          }
          return;
        }
      }
      if (!cancelled) router.replace(`/loop/${loopId}/suscripcion`);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, loop, subscriptionStatus, trialEnd, pathname, loopId]);
```

- [ ] **Step 5: Exponer `trialEnd` en el value del contexto**

En el objeto `value: LoopContextValue` (línea ~493), agregar el campo justo
después de `subscriptionStatus`:

```ts
    subscriptionStatus,
    trialEnd,
```

- [ ] **Step 6: Build limpio**

Run: `npm run build`
Expected: sin errores de tipos.

- [ ] **Step 7: Commit**

```bash
git add app/loop/[id]/layout.tsx app/loop/[id]/LoopContext.tsx
git commit -m "feat: gate distingue /activar (trial nunca usado o vencido) de /suscripcion (ya pagó antes)"
```

---

### Task 6: Pantalla nueva "Activá tu Loopy"

**Files:**
- Create: `app/loop/[id]/activar/page.tsx`

**Interfaces:**
- Consumes: `useLoop()` (`userId`, `isAdmin`, `loopId` de
  `LoopContext.tsx`), `POST /api/stripe/checkout` (existente, sin cambios de
  contrato hasta la Task 7).
- Produces: página en `/loop/[id]/activar`, alcanzable únicamente vía la
  redirección del gate (Task 5) o navegación directa por URL.

- [ ] **Step 1: Crear `app/loop/[id]/activar/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useLoop } from "../LoopContext";

export default function ActivarPage({ params }: { params: { id: string } }) {
  const { userId, isAdmin } = useLoop();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Ingresá tu nombre completo.");
      return;
    }
    setLoading(true);
    setError(null);

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ name: name.trim() })
      .eq("id", userId);
    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setError("Tu sesión expiró. Volvé a acceder.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ loopId: params.id }),
      });
      const json = await res.json();
      if (res.ok && json.url) {
        window.location.href = json.url;
        return;
      }
      if (res.ok && json.bypass) {
        // No debería pasar nunca por este camino (un admin bypass ya recibe
        // acceso permanente al crear el Loopy, en /api/loops/start-trial, y
        // jamás llega a ver /activar) — se cubre igual por simetría con el
        // resto de los llamadores de /api/stripe/checkout.
        window.location.reload();
        return;
      }
      setError(json.error || "No se pudo continuar");
    } catch {
      setError("No se pudo conectar con el servidor de pagos");
    }
    setLoading(false);
  }

  if (!isAdmin) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
        <h1 className="text-xl font-bold text-loopy-900 mb-2">Tu día de prueba gratis terminó</h1>
        <p className="text-loopy-700 max-w-sm">
          Pedile al admin de este Loopy que lo active para seguir usando el mapa, la familia y las alertas.
        </p>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
      <div className="w-14 h-14 rounded-full bg-bridge/10 flex items-center justify-center mb-4">
        <ShieldCheck className="text-bridge" size={26} />
      </div>
      <h1 className="text-xl font-bold text-loopy-900 mb-2">Activá tu Loopy</h1>
      <p className="text-loopy-700 max-w-sm mb-6">
        Tu día de prueba gratis terminó. Completá tu nombre para seguir con el pago.
      </p>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-2xl shadow-card border border-loopy-100 p-6 text-left"
      >
        <label htmlFor="activar-name" className="block text-sm font-medium text-loopy-900 mb-1">
          Nombre completo
        </label>
        <input
          id="activar-name"
          className="w-full mb-4 px-3 py-2 rounded-lg border border-loopy-50 focus:outline-none focus:ring-2 focus:ring-bridge/60"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-full bg-gradient-to-r from-loopy-700 via-bridge to-glow-500 text-white font-semibold shadow-cta hover:shadow-cta-hover disabled:opacity-60"
        >
          {loading ? "Un momento..." : "Continuar al pago"}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Build limpio**

Run: `npm run build`
Expected: sin errores de tipos.

- [ ] **Step 3: Commit**

```bash
git add app/loop/[id]/activar/page.tsx
git commit -m "feat: pantalla /activar (nombre diferido + continuar a Stripe)"
```

---

### Task 7: `tax_id_collection` opcional en el checkout (Sección C)

**Files:**
- Modify: `app/api/stripe/checkout/route.ts`

**Interfaces:**
- Consumes: SDK de Stripe ya instalado (`stripe": "^22.6.0"`).
- Produces: sin cambios de contrato HTTP — mismo `{ url }` de siempre.

- [ ] **Step 1: Agregar `tax_id_collection` a la creación de la sesión**

En `app/api/stripe/checkout/route.ts`, dentro de `stripe.checkout.sessions.create({...})`,
reemplazar:

```ts
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: existingSub?.stripe_customer_id || undefined,
      customer_email: existingSub?.stripe_customer_id ? undefined : auth.userEmail || undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 1,
        metadata: { loop_id: loopId },
      },
      client_reference_id: loopId,
      metadata: { loop_id: loopId },
      success_url: `${origin}/loop/${loopId}/familia?checkout=success`,
      cancel_url: `${origin}/loop/${loopId}/familia?checkout=cancelled`,
    });
```

por:

```ts
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: existingSub?.stripe_customer_id || undefined,
      customer_email: existingSub?.stripe_customer_id ? undefined : auth.userEmail || undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 1,
        metadata: { loop_id: loopId },
      },
      // Campo nativo de Stripe, opcional (sin `required`): solo colecta ID
      // fiscal de EMPRESA (ej. es_cif — CIF español, no DNI personal), y
      // Stripe decide solo cuándo mostrarlo según la ubicación de quien
      // paga. Una familia lo deja en blanco y sigue de largo.
      tax_id_collection: { enabled: true },
      client_reference_id: loopId,
      metadata: { loop_id: loopId },
      success_url: `${origin}/loop/${loopId}/familia?checkout=success`,
      cancel_url: `${origin}/loop/${loopId}/familia?checkout=cancelled`,
    });
```

- [ ] **Step 2: Build limpio**

Run: `npm run build`
Expected: sin errores de tipos (`tax_id_collection` es un campo válido del
tipo `Stripe.Checkout.SessionCreateParams` en `stripe@22.6.0` — si el build
marca error de tipos acá, confirmar contra
`node_modules/stripe/types/checkout/sessions.d.ts` el nombre exacto del
campo en esa versión antes de continuar).

- [ ] **Step 3: Commit**

```bash
git add app/api/stripe/checkout/route.ts
git commit -m "feat: tax_id_collection opcional (solo empresas) en el checkout"
```

---

### Task 8: e2e — cubrir start-trial, elegibilidad por cuenta y `/activar`

**Files:**
- Modify: `e2e/stripe-billing.spec.ts`

**Interfaces:**
- Consumes: todo lo construido en las Tasks 1-7.
- Produces: nada consumido por otra task — es la cobertura final.

- [ ] **Step 1: Arreglar el helper `createLoop`**

Con `handleCreateLoop` llamando a `/api/loops/start-trial` (Task 4) en vez de
a Stripe, un admin elegible (primera vez) siempre recibe el trial y aterriza
en `/familia` de forma determinística — ya no hace falta la carrera entre
`/familia` y `/suscripcion`. Reemplazar (línea ~159-172):

```ts
async function createLoop(page: Page, loopName: string) {
  await page.getByPlaceholder(/nombre del loopy/i).fill(loopName);
  await page.getByRole("button", { name: "Crear Loopy" }).click();
  // Sin STRIPE_PRICE_ID/STRIPE_SECRET_KEY reales cargados hoy, la llamada a
  // /api/stripe/checkout en handleCreateLoop devuelve error y el frontend
  // cae al fallback de router.push a /familia — el layout gatea el acceso
  // ahí mismo (sin fila en loop_subscriptions), así que el destino real
  // termina siendo /suscripcion. Esperar cualquiera de los dos evita que
  // el test dependa de cuál gana la carrera.
  await page.waitForURL(/\/loop\/[^/]+\/(familia|suscripcion)/, { timeout: 30000 });
  const loopId = page.url().match(/\/loop\/([^/]+)\//)?.[1];
  if (!loopId) throw new Error(`No se pudo extraer loopId de ${page.url()}`);
  return loopId;
}
```

por:

```ts
async function createLoop(page: Page, loopName: string) {
  await page.getByPlaceholder(/nombre del loopy/i).fill(loopName);
  await page.getByRole("button", { name: "Crear Loopy" }).click();
  // handleCreateLoop llama a /api/loops/start-trial, no a Stripe — un admin
  // elegible (primera vez) siempre recibe el trial de 1 día sin tarjeta y
  // aterriza en /familia, sin depender de STRIPE_PRICE_ID/STRIPE_SECRET_KEY
  // estar configurados localmente.
  await page.waitForURL(/\/loop\/[^/]+\/familia/, { timeout: 30000 });
  const loopId = page.url().match(/\/loop\/([^/]+)\//)?.[1];
  if (!loopId) throw new Error(`No se pudo extraer loopId de ${page.url()}`);
  return loopId;
}
```

- [ ] **Step 2: Agregar el helper `getUserId`**

Justo después de la función `getAccessToken` existente (línea ~33-44),
agregar:

```ts
async function getUserId(page: Page, token: string): Promise<string | null> {
  const res = await page.request.get(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok()) return null;
  const data = await res.json();
  return data.id ?? null;
}
```

- [ ] **Step 3: Extender la prueba del webhook para cubrir la caída a `/suscripcion`**

En la segunda prueba (`"el webhook actualiza loop_subscriptions..."`),
después de las líneas existentes:

```ts
    // Ahora sí tiene acceso: reentrar al Loopy no debe rebotar a /suscripcion
    await adminPage.goto(`/loop/${loopId}/familia`);
    await expect(adminPage).toHaveURL(new RegExp(`/loop/${loopId}/familia`));

    await adminContext.close();
  });
```

agregar, ANTES del `await adminContext.close();`:

```ts
    // Una suscripción real que termina (ej. cancelada desde el portal de
    // Stripe) manda a /suscripcion, no a /activar — a diferencia de un
    // trial sin tarjeta vencido, esta persona ya está identificada (Stripe
    // ya tiene su nombre/tarjeta de antes), no hace falta pedirle nada de
    // nuevo.
    const deletedEvent = {
      id: `evt_e2e_del_${stamp}`,
      object: "event",
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: fakeSubscriptionId,
          object: "subscription",
          customer: fakeCustomerId,
          status: "canceled",
          metadata: { loop_id: loopId },
        },
      },
    };
    const deletedPayload = JSON.stringify(deletedEvent);
    const deletedRes = await adminPage.request.post("/api/stripe/webhook", {
      headers: { "stripe-signature": sign(deletedPayload), "content-type": "application/json" },
      data: deletedPayload,
    });
    expect(deletedRes.ok()).toBeTruthy();

    await adminPage.goto(`/loop/${loopId}/familia`);
    await expect(adminPage).toHaveURL(new RegExp(`/loop/${loopId}/suscripcion`), { timeout: 15000 });
```

(deja el `await adminContext.close();` donde ya estaba, al final de la
prueba).

- [ ] **Step 4: Reescribir la tercera prueba — elegibilidad por cuenta + `/activar`**

Reemplazar la prueba completa `"un Loopy sin fila en loop_subscriptions rebota a /suscripcion"`
(línea ~265-277) por:

```ts
  test("un admin que ya usó su trial sin tarjeta no recibe otro al crear un segundo Loopy, y /activar guarda el nombre diferido", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signUpAndLogin(page, `qa.loopy.stripe.gate.${stamp}@mailinator.com`);

    const firstLoopId = await createLoop(page, `QA Gate Uno ${stamp}`);

    // Segundo Loopy, misma cuenta: vuelve al dashboard antes de crear otro.
    await page.goto("/dashboard");
    const secondLoopName = `QA Gate Dos ${stamp}`;
    await page.getByPlaceholder(/nombre del loopy/i).fill(secondLoopName);
    await page.getByRole("button", { name: "Crear Loopy" }).click();

    // El segundo Loopy no es elegible (la cuenta ya usó su trial en el
    // primero) — el gate lo manda directo a /activar, no a /familia.
    await page.waitForURL(/\/loop\/[^/]+\/activar/, { timeout: 30000 });
    const secondLoopId = page.url().match(/\/loop\/([^/]+)\//)?.[1];
    expect(secondLoopId).toBeTruthy();
    expect(secondLoopId).not.toBe(firstLoopId);
    await expect(page.getByRole("heading", { name: "Activá tu Loopy" })).toBeVisible();

    // Completar el formulario persiste el nombre diferido del alta, incluso
    // si el pago real no se puede completar en este entorno de pruebas (sin
    // STRIPE_PRICE_ID/STRIPE_SECRET_KEY reales configurados localmente).
    await page.getByLabel("Nombre completo").fill("QA Activado");
    await page.getByRole("button", { name: "Continuar al pago" }).click();
    await Promise.race([
      page.waitForURL((url) => !url.pathname.endsWith("/activar"), { timeout: 15000 }),
      page.locator("p.text-red-600").waitFor({ timeout: 15000 }),
    ]).catch(() => {});

    const token = await getAccessToken(page);
    expect(token).toBeTruthy();
    const userId = await getUserId(page, token!);
    expect(userId).toBeTruthy();
    const profileRes = await page.request.get(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=name`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
    );
    expect(profileRes.ok()).toBeTruthy();
    const profileRows = await profileRes.json();
    expect(profileRows).toHaveLength(1);
    expect(profileRows[0].name).toBe("QA Activado");

    // El primer Loopy, mientras tanto, sigue con acceso normal — su trial
    // sigue vigente, esto no lo afecta.
    await page.goto(`/loop/${firstLoopId}/familia`);
    await expect(page).toHaveURL(new RegExp(`/loop/${firstLoopId}/familia`));

    await context.close();
  });
```

- [ ] **Step 5: Correr toda la suite de billing**

Run: `npx playwright test e2e/stripe-billing.spec.ts e2e/has-loop-access.spec.ts`
Expected: todas las pruebas en verde. (Requiere `.env.local` con
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` ya
configurados en este worktree, y el server corriendo en `localhost:3000` vía
`npm run build && npm start` — no `npm run dev`, para que las env vars del
servidor estén cargadas igual que en producción.)

- [ ] **Step 6: Correr la suite completa**

Run: `npx playwright test`
Expected: `e2e/loop-nav-shell.spec.ts`, `e2e/stripe-billing.spec.ts` y
`e2e/has-loop-access.spec.ts` en verde.

- [ ] **Step 7: Commit**

```bash
git add e2e/stripe-billing.spec.ts
git commit -m "test: e2e para start-trial, elegibilidad por cuenta y /activar"
```
