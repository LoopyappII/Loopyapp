# Loopy — Suscripción con Stripe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cobrar una suscripción mensual (14,99€/mes, 1 día gratis) por
Loopy/familia vía Stripe Checkout, sincronizada por webhook, con el
acceso a un Loopy gateado por el estado de esa suscripción.

**Architecture:** Tabla nueva `loop_subscriptions` (1 fila por Loopy,
escrita solo por el webhook con la `service_role` key). Tres rutas API
(`checkout`, `webhook`, `portal`) bajo `app/api/stripe/`. El webhook
nunca llama de vuelta a la API de Stripe — arma las filas solo con los
datos que cada evento ya trae, así se puede probar hoy sin credenciales
reales. Gate de acceso client-side en `app/loop/[id]/layout.tsx`
(redirige a una página nueva de "reactivar" si el Loopy no tiene acceso).

**Tech Stack:** Next.js 14 (App Router) + TypeScript, `@supabase/supabase-js`,
SDK oficial `stripe` (Node), Playwright para e2e.

**Spec:** `docs/superpowers/specs/2026-08-31-loopy-stripe-billing-design.md`
(y el SQL en `docs/superpowers/specs/2026-08-31-loop-subscriptions.sql`)

## Global Constraints

- No romper nada de lo que ya funciona: mapa en vivo, Realtime, alta de
  miembros por teléfono, SOS, zonas, el flujo de creación/unión a un
  Loopy.
- No hay unit-test framework en este repo (no Jest/RTL) — la convención
  existente es Playwright E2E (`npm run test:e2e`) contra el build real y
  la base Supabase real del proyecto. Toda cobertura nueva sigue esa
  convención, en un archivo propio `e2e/stripe-billing.spec.ts`.
- Ninguna ruta/lib server-only importa nada marcado `"use client"`, y
  viceversa: `lib/stripeClient.ts`, `lib/supabaseAdmin.ts`,
  `lib/stripeAuth.ts` son server-only (nunca se importan desde un
  componente cliente).
- El webhook NUNCA llama de vuelta a la API de Stripe (ni
  `subscriptions.retrieve` ni similar) — arma cada fila solo con los
  datos que el propio evento ya trae. Esto es intencional: permite
  probar la lógica del webhook hoy con un secret y payloads fabricados,
  sin cuenta ni credenciales reales de Stripe (decisión explícita del
  usuario: "no quiero hacer el test con credenciales mias, quiero hacer
  mañana con el cliente").
- Ninguna variable nueva lleva el prefijo `NEXT_PUBLIC_` — Checkout y el
  Portal se resuelven 100% server-side vía redirect por URL.
- El gate de acceso en `layout.tsx` es un control de **producto** (UI),
  no de seguridad: no cambia las policies RLS de `loops`/`locations`/etc.
  Fuera de alcance de este plan.
- Precio real ya publicado: **14,99€/mes, 1 día gratis**
  (`app/signup/page.tsx:110`, `components/MagnifierLanding.tsx:80`) — el
  `Price` de Stripe que Sebastián cree mañana debe coincidir con esto.

---

## Task 1: Dependencia de Stripe, clientes server-only, tipos y SQL

**Files:**
- Modify: `package.json` (agregar dependencia `stripe`)
- Create: `lib/stripeClient.ts`
- Create: `lib/supabaseAdmin.ts`
- Create: `lib/stripeAuth.ts`
- Modify: `lib/types.ts` (agregar tipos al final del archivo)
- Create: `.env.local.example`
- (el SQL ya existe: `docs/superpowers/specs/2026-08-31-loop-subscriptions.sql`
  — no hay que tocarlo, solo referenciarlo desde `.env.local.example`)

**Interfaces:**
- Produce: `stripe` (instancia exportada desde `lib/stripeClient.ts`,
  tipo `Stripe`), `supabaseAdmin` (instancia exportada desde
  `lib/supabaseAdmin.ts`, tipo `SupabaseClient`), `requireLoopAdmin(req,
  loopId)` desde `lib/stripeAuth.ts` (tipo `AuthedAdminResult`, ver
  abajo), `SubscriptionStatus`, `LoopSubscription`, `hasLoopAccess(status)`
  desde `lib/types.ts`. Las Tasks 2-6 consumen todo esto.

- [ ] **Step 1: Instalar el SDK de Stripe**

Run: `npm install stripe@latest`

Confirmar en `package.json` que quedó agregada una entrada `"stripe":
"^X.Y.Z"` bajo `"dependencies"`.

- [ ] **Step 2: Crear `lib/stripeClient.ts`**

```ts
import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  // No lanzamos en tiempo de import para no romper `next build` cuando
  // las env vars todavía no están cargadas — se valida recién al usar
  // el cliente en runtime (las rutas que lo usan devuelven 500 si falta).
  console.warn(
    "STRIPE_SECRET_KEY no está configurada — las rutas de Stripe fallarán en runtime."
  );
}

export const stripe = new Stripe(secretKey || "sk_test_placeholder");
```

- [ ] **Step 3: Crear `lib/supabaseAdmin.ts`**

```ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xumacwfsabojqefhaozm.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.warn(
    "SUPABASE_SERVICE_ROLE_KEY no está configurada — el webhook de Stripe no podrá escribir en la base."
  );
}

// Cliente server-only con la service_role key: bypassea RLS. Nunca
// importar este archivo desde código marcado "use client".
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey || "placeholder");
```

- [ ] **Step 4: Agregar los tipos de suscripción a `lib/types.ts`**

Al final del archivo (después de la última interfaz existente), agregar:

```ts
export type SubscriptionStatus =
  | "incomplete"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled";

export interface LoopSubscription {
  loop_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  status: SubscriptionStatus;
  trial_end: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

const ACCESS_GRANTING_STATUSES: SubscriptionStatus[] = ["trialing", "active", "past_due"];

export function hasLoopAccess(status: SubscriptionStatus | null | undefined): boolean {
  return !!status && ACCESS_GRANTING_STATUSES.includes(status);
}
```

- [ ] **Step 5: Crear `lib/stripeAuth.ts`**

```ts
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xumacwfsabojqefhaozm.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1bWFjd2ZzYWJvanFlZmhhb3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzODE2ODYsImV4cCI6MjA5OTk1NzY4Nn0.kP9gxcslcBRcRuwilR8KzGbO_YeOzZFilU4Op1k8mzQ";

export type AuthedAdminResult =
  | { ok: true; userId: string; userEmail: string | null; loop: { id: string; admin_id: string } }
  | { ok: false; status: number; error: string };

/**
 * Verifica el Bearer token del caller contra Supabase Auth y confirma
 * que es admin del `loopId` recibido. Centraliza el chequeo de
 * seguridad que usan checkout y portal — nunca duplicarlo inline en una
 * ruta nueva.
 */
export async function requireLoopAdmin(
  req: NextRequest,
  loopId: string | undefined
): Promise<AuthedAdminResult> {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return { ok: false, status: 401, error: "No autenticado" };
  }
  if (!loopId) {
    return { ok: false, status: 400, error: "Falta loopId" };
  }

  const supabaseAsUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await supabaseAsUser.auth.getUser(token);
  if (userError || !userData.user) {
    return { ok: false, status: 401, error: "No autenticado" };
  }

  const { data: loop, error: loopError } = await supabaseAdmin
    .from("loops")
    .select("id, admin_id")
    .eq("id", loopId)
    .single();
  if (loopError || !loop) {
    return { ok: false, status: 404, error: "Loopy no encontrado" };
  }
  if (loop.admin_id !== userData.user.id) {
    return {
      ok: false,
      status: 403,
      error: "Solo el admin del Loopy puede gestionar la suscripción",
    };
  }

  return { ok: true, userId: userData.user.id, userEmail: userData.user.email ?? null, loop };
}
```

- [ ] **Step 6: Crear `.env.local.example`**

```
# Stripe — pegar los valores reales del dashboard de Stripe del cliente
# (Looper Cashline SL). Nunca commitear el archivo .env.local real.
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=

# Supabase service_role key — Project Settings > API en el dashboard de
# Supabase del proyecto de Loopy (xumacwfsabojqefhaozm). Server-only,
# nunca exponer al cliente.
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 7: Verificar que compila**

Run: `npm run build`
Expected: build limpio, sin errores de TypeScript (las env vars pueden
estar ausentes — los warnings de consola en Steps 2-3 son esperados y no
rompen el build).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json lib/stripeClient.ts lib/supabaseAdmin.ts lib/stripeAuth.ts lib/types.ts .env.local.example
git commit -m "feat: Stripe SDK, server-only clients and subscription types"
```

---

## Task 2: Webhook de Stripe

**Files:**
- Create: `app/api/stripe/webhook/route.ts`

**Interfaces:**
- Consumes: `stripe` de `lib/stripeClient.ts`, `supabaseAdmin` de
  `lib/supabaseAdmin.ts`.
- Produce: endpoint `POST /api/stripe/webhook`, público (autenticado por
  firma Stripe, no por sesión de Supabase). Las Tasks 3 y 6 (checkout,
  e2e) dependen de que este endpoint exista y de que `checkout.sessions`
  y `subscriptions` se creen con `metadata.loop_id` (Task 3 lo hace) para
  que este handler pueda ubicar la fila correcta.

- [ ] **Step 1: Crear `app/api/stripe/webhook/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripeClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Falta configurar el webhook" }, { status: 500 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    return NextResponse.json(
      { error: `Firma inválida: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      // Solo trae los IDs — nunca llamamos de vuelta a Stripe acá. El
      // status real llega enseguida vía customer.subscription.created
      // (Stripe dispara ambos eventos casi simultáneamente).
      const session = event.data.object as Stripe.Checkout.Session;
      const loopId = session.metadata?.loop_id;
      const customerId = session.customer as string | null;
      const subscriptionId = session.subscription as string | null;
      if (loopId && customerId && subscriptionId) {
        await supabaseAdmin.from("loop_subscriptions").upsert(
          {
            loop_id: loopId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            status: "incomplete",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "loop_id" }
        );
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const loopId = subscription.metadata?.loop_id;
      const row = {
        stripe_customer_id: subscription.customer as string,
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        trial_end: subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null,
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (loopId) {
        await supabaseAdmin
          .from("loop_subscriptions")
          .upsert({ loop_id: loopId, ...row }, { onConflict: "loop_id" });
      } else {
        // Sin metadata (no debería pasar si Task 3 la setea siempre) —
        // fallback por subscription_id para no perder la actualización.
        await supabaseAdmin
          .from("loop_subscriptions")
          .update(row)
          .eq("stripe_subscription_id", subscription.id);
      }
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const loopId = subscription.metadata?.loop_id;
      const update = { status: "canceled" as const, updated_at: new Date().toISOString() };
      if (loopId) {
        await supabaseAdmin.from("loop_subscriptions").update(update).eq("loop_id", loopId);
      } else {
        await supabaseAdmin
          .from("loop_subscriptions")
          .update(update)
          .eq("stripe_subscription_id", subscription.id);
      }
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string | null;
      if (subscriptionId) {
        await supabaseAdmin
          .from("loop_subscriptions")
          .update({ status: "past_due", updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", subscriptionId);
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: build limpio.

- [ ] **Step 3: Commit**

```bash
git add app/api/stripe/webhook/route.ts
git commit -m "feat: Stripe webhook handler (checkout/subscription/invoice events)"
```

---

## Task 3: Rutas de Checkout y Portal

**Files:**
- Create: `app/api/stripe/checkout/route.ts`
- Create: `app/api/stripe/portal/route.ts`

**Interfaces:**
- Consumes: `stripe`, `supabaseAdmin`, `requireLoopAdmin` (Task 1).
- Produce: `POST /api/stripe/checkout` (`{loopId}` → `{url}`),
  `POST /api/stripe/portal` (`{loopId}` → `{url}`). Task 4 (dashboard) y
  la página de suscripción del layout consumen estas dos rutas por
  `fetch`.

- [ ] **Step 1: Crear `app/api/stripe/checkout/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripeClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireLoopAdmin } from "@/lib/stripeAuth";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { loopId?: string };
  const auth = await requireLoopAdmin(req, body.loopId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return NextResponse.json({ error: "Falta configurar STRIPE_PRICE_ID" }, { status: 500 });
  }

  const origin = req.headers.get("origin") || "https://www.directloopy.com";
  const loopId = auth.loop.id;

  const { data: existingSub } = await supabaseAdmin
    .from("loop_subscriptions")
    .select("stripe_customer_id")
    .eq("loop_id", loopId)
    .maybeSingle();

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

  return NextResponse.json({ url: session.url });
}
```

- [ ] **Step 2: Crear `app/api/stripe/portal/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripeClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireLoopAdmin } from "@/lib/stripeAuth";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { loopId?: string };
  const auth = await requireLoopAdmin(req, body.loopId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: sub, error: subError } = await supabaseAdmin
    .from("loop_subscriptions")
    .select("stripe_customer_id")
    .eq("loop_id", auth.loop.id)
    .single();
  if (subError || !sub) {
    return NextResponse.json(
      { error: "Este Loopy todavía no tiene una suscripción" },
      { status: 404 }
    );
  }

  const origin = req.headers.get("origin") || "https://www.directloopy.com";
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${origin}/loop/${auth.loop.id}/suscripcion`,
  });

  return NextResponse.json({ url: portalSession.url });
}
```

Nota: `subscription_data.metadata` en Checkout requiere una versión
reciente del SDK (soportado desde hace varias major versions) — si
`npm run build` en el Step 3 marca error de tipos en ese campo, es la
única señal de que la versión instalada en Task 1 no lo soporta;
consultar `node_modules/stripe/types/checkout/sessions.d.ts` para
confirmar el nombre exacto del campo en la versión instalada antes de
cambiar nada más.

- [ ] **Step 3: Verificar que compila**

Run: `npm run build`
Expected: build limpio.

- [ ] **Step 4: Commit**

```bash
git add app/api/stripe/checkout/route.ts app/api/stripe/portal/route.ts
git commit -m "feat: Stripe checkout and billing portal routes"
```

---

## Task 4: Gate de acceso en el shell del Loopy + página de suscripción

**Files:**
- Modify: `app/loop/[id]/LoopContext.tsx`
- Modify: `app/loop/[id]/layout.tsx`
- Create: `app/loop/[id]/suscripcion/page.tsx`

**Interfaces:**
- Consumes: `hasLoopAccess`, `SubscriptionStatus` de `lib/types.ts`
  (Task 1); `supabase` de `lib/supabaseClient.ts` (ya existe).
- Produce: `LoopContextValue.subscriptionStatus:
  SubscriptionStatus | null` — disponible para cualquier página bajo
  `app/loop/[id]/` vía `useLoop()`.

- [ ] **Step 1: Agregar `subscriptionStatus` a `LoopContextValue`**

En `app/loop/[id]/LoopContext.tsx`, agregar el import y el campo:

```ts
import type { Loop, LoopMember, MemberRole, SafeZone, SpeedAlert, SubscriptionStatus } from "@/lib/types";
```

(reemplaza la línea `import type { Loop, LoopMember, MemberRole, SafeZone, SpeedAlert } from "@/lib/types";`)

Y dentro de `export interface LoopContextValue { ... }`, agregar un
campo nuevo justo después de `isAdmin: boolean;`:

```ts
  subscriptionStatus: SubscriptionStatus | null;
```

- [ ] **Step 2: Cargar el estado de suscripción en `layout.tsx`**

En `app/loop/[id]/layout.tsx`:

a) Cambiar el import de `next/navigation` (línea 4) de:
```ts
import { useParams, useRouter } from "next/navigation";
```
a:
```ts
import { useParams, usePathname, useRouter } from "next/navigation";
```

b) Cambiar el import de tipos (línea 12) de:
```ts
import type { Loop, LoopMember, MemberRole, SafeZone, SpeedAlert } from "@/lib/types";
```
a:
```ts
import type { Loop, LoopMember, MemberRole, SafeZone, SpeedAlert, SubscriptionStatus } from "@/lib/types";
import { hasLoopAccess } from "@/lib/types";
```

c) Justo después de `const loopId = params.id as string;` (línea 19),
agregar:
```ts
  const pathname = usePathname();
```

d) Justo después de `const [loop, setLoop] = useState<Loop | null>(null);`
(línea 22), agregar:
```ts
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
```

e) Dentro de `loadLoopData` (empieza en línea 60), justo después del
bloque que hace `setLoop(loopData);` (línea 66), agregar:
```ts
    const { data: subRow } = await supabase
      .from("loop_subscriptions")
      .select("status")
      .eq("loop_id", loopId)
      .maybeSingle();
    setSubscriptionStatus((subRow?.status as SubscriptionStatus | undefined) ?? null);
```

f) Agregar un `useEffect` nuevo de gating, justo después del `useEffect`
existente de geolocalización (termina en la línea
`}, [userId, loopId, zones, loop?.speed_limit_kmh]);`):
```ts
  useEffect(() => {
    if (loading || !loop) return;
    const onSuscripcion = pathname === `/loop/${loopId}/suscripcion`;
    if (!onSuscripcion && !hasLoopAccess(subscriptionStatus)) {
      router.replace(`/loop/${loopId}/suscripcion`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, loop, subscriptionStatus, pathname, loopId]);
```

g) Dentro de la construcción de `value: LoopContextValue` (línea
417-439), agregar el campo nuevo justo después de
`isAdmin: loop.admin_id === userId,`:
```ts
    subscriptionStatus,
```

- [ ] **Step 3: Crear `app/loop/[id]/suscripcion/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { AlertTriangle, CreditCard } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useLoop } from "../LoopContext";
import type { SubscriptionStatus } from "@/lib/types";

const STATUS_COPY: Record<SubscriptionStatus | "none", { title: string; body: string }> = {
  none: {
    title: "Este Loopy no tiene una suscripción activa",
    body: "Para volver a usar el mapa, la familia y las alertas, hay que completar el pago.",
  },
  incomplete: {
    title: "Falta completar el pago",
    body: "El proceso de pago quedó a mitad de camino. Completalo para activar este Loopy.",
  },
  trialing: {
    title: "Suscripción en período de prueba",
    body: "Todo en orden — no deberías ver esta pantalla.",
  },
  active: {
    title: "Suscripción activa",
    body: "Todo en orden — no deberías ver esta pantalla.",
  },
  past_due: {
    title: "Hay un problema con el cobro",
    body: "No pudimos procesar el último cobro. Actualizá el método de pago para no perder el acceso.",
  },
  canceled: {
    title: "Esta suscripción terminó",
    body: "Para seguir usando este Loopy, hay que reactivar la suscripción.",
  },
};

export default function SuscripcionPage({ params }: { params: { id: string } }) {
  const { subscriptionStatus, isAdmin } = useLoop();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = subscriptionStatus ?? "none";
  const copy = STATUS_COPY[status] || STATUS_COPY.none;
  const action: "checkout" | "portal" =
    status === "none" || status === "incomplete" ? "checkout" : "portal";

  async function goToCheckoutOrPortal() {
    setLoading(true);
    setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setError("Tu sesión expiró. Volvé a acceder.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/stripe/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ loopId: params.id }),
      });
      const json = await res.json();
      if (res.ok && json.url) {
        window.location.href = json.url;
        return;
      }
      setError(json.error || "No se pudo continuar");
    } catch {
      setError("No se pudo conectar con el servidor de pagos");
    }
    setLoading(false);
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
      <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
        <AlertTriangle className="text-red-600" size={26} />
      </div>
      <h1 className="text-xl font-bold text-loopy-900 mb-2">{copy.title}</h1>
      <p className="text-loopy-700 max-w-sm mb-6">{copy.body}</p>
      {isAdmin ? (
        <button
          onClick={goToCheckoutOrPortal}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-loopy-700 via-bridge to-glow-500 text-white font-semibold shadow-badge disabled:opacity-60"
        >
          <CreditCard size={18} />
          {loading ? "Un momento..." : "Gestionar pago"}
        </button>
      ) : (
        <p className="text-sm text-loopy-500">Pedile al admin de este Loopy que gestione el pago.</p>
      )}
      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
    </main>
  );
}
```

- [ ] **Step 4: Verificar que compila**

Run: `npm run build`
Expected: build limpio, sin errores de TypeScript en `layout.tsx`,
`LoopContext.tsx` ni la página nueva.

- [ ] **Step 5: Commit**

```bash
git add app/loop/[id]/LoopContext.tsx app/loop/[id]/layout.tsx app/loop/[id]/suscripcion/page.tsx
git commit -m "feat: gate loop access on subscription status, add reactivation screen"
```

---

## Task 5: Disparar Checkout al crear un Loopy

**Files:**
- Modify: `app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `POST /api/stripe/checkout` (Task 3).

- [ ] **Step 1: Reemplazar la navegación final de `handleCreateLoop`**

En `app/dashboard/page.tsx`, dentro de `handleCreateLoop` (líneas 61-91),
reemplazar la línea final:

```ts
    router.push(`/loop/${loop.id}/familia`);
```

por:

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

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: build limpio.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: redirect to Stripe Checkout right after creating a Loopy"
```

---

## Task 6: Cobertura E2E (Playwright)

**Files:**
- Create: `e2e/stripe-billing.spec.ts`

**Interfaces:**
- Consumes: `POST /api/stripe/checkout` (Task 3), `POST
  /api/stripe/webhook` (Task 2), la tabla `loop_subscriptions` (creada
  por la migración manual de Sebastián — ver nota de "estado esperado"
  abajo).

**Nota sobre el estado esperado de esta tarea:** estos tests corren
contra el build real y la base Supabase real del proyecto (mismo patrón
que `e2e/loop-nav-shell.spec.ts`), incluida la tabla `loop_subscriptions`.
Sebastián todavía no corrió la migración de
`docs/superpowers/specs/2026-08-31-loop-subscriptions.sql` al momento de
escribir este plan — es esperable que estos tests fallen con un error de
"tabla no existe" hasta que la corra. Escribir el archivo igual, dejar
un comentario al principio idéntico al de `loop-nav-shell.spec.ts`
explicando la dependencia, e intentar correrlo una vez (Step 3) para
confirmar que el ÚNICO tipo de fallo es "falta la tabla" y no un bug de
código.

- [ ] **Step 1: Crear `e2e/stripe-billing.spec.ts`**

Las funciones `confirmEmailViaMailinator` y `signUpAndLogin` de
`e2e/loop-nav-shell.spec.ts:127-238` ya resuelven, probado y en verde, el
flujo real de signup de esta app (confirmación de email obligatoria vía
mailinator.com, selectores exactos para los inputs sin `label for`/
`placeholder` del formulario de `/signup`). **Copiarlas verbatim** desde
ese archivo (junto con el import de `expect` que usan) en vez de
reimplementar el flujo — así este archivo nuevo no repite la
investigación de selectores ya hecha ahí. Adaptar solo la firma para
recibir `email`/`name` como hace el original.

Crear `e2e/stripe-billing.spec.ts` con:

```ts
import { test, expect, type Page } from "@playwright/test";
import Stripe from "stripe";

/**
 * Corre contra la app real y el proyecto Supabase real de Loopy — mismo
 * patrón y mismas limitaciones que e2e/loop-nav-shell.spec.ts (ver el
 * comentario al inicio de ese archivo: signups reales vía mailinator,
 * 1.2-2.9 min por corrida, timeout de test en 420s). Además depende de
 * que la tabla `loop_subscriptions` exista en esa base — ver
 * docs/superpowers/specs/2026-08-31-loop-subscriptions.sql. Hasta que
 * esa migración se corra a mano en el Supabase Dashboard, el test 2 y el
 * test 3 de este archivo fallan con un error de "tabla no existe", no
 * por un bug de código (el test 1 no toca esa tabla).
 *
 * No usa credenciales reales de Stripe: STRIPE_WEBHOOK_SECRET (la misma
 * variable que ya carga app/api/stripe/webhook/route.ts) solo necesita
 * ser cualquier string fijo en .env.local — se usa únicamente para
 * firmar localmente los payloads de prueba con el mismo algoritmo que
 * Stripe usa para verificar. No hay ninguna llamada de red a Stripe en
 * este archivo.
 */

const PASSWORD = "LoopyQA!2026";
const stamp = Date.now();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xumacwfsabojqefhaozm.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1bWFjd2ZzYWJvanFlZmhhb3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzODE2ODYsImV4cCI6MjA5OTk1NzY4Nn0.kP9gxcslcBRcRuwilR8KzGbO_YeOzZFilU4Op1k8mzQ";
const SUPABASE_STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
const WEBHOOK_SECRET_TEST = process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_fixed_for_e2e";

async function getAccessToken(page: Page): Promise<string | null> {
  return page.evaluate((key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.access_token ?? null;
    } catch {
      return null;
    }
  }, SUPABASE_STORAGE_KEY);
}

// --- pegar acá, verbatim, confirmEmailViaMailinator y signUpAndLogin
// desde e2e/loop-nav-shell.spec.ts:127-238 ---

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

test.describe("Stripe billing", () => {
  test("un no-admin no puede crear una Checkout Session para el Loopy de otro", async ({ browser }) => {
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await signUpAndLogin(adminPage, `qa.loopy.stripe.admin.${stamp}@mailinator.com`, "QA Admin");
    const loopId = await createLoop(adminPage, `QA Stripe ${stamp}`);

    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await signUpAndLogin(otherPage, `qa.loopy.stripe.other.${stamp}@mailinator.com`, "QA Otro");
    const otherToken = await getAccessToken(otherPage);
    expect(otherToken).toBeTruthy();

    const res = await otherPage.request.post("/api/stripe/checkout", {
      headers: { Authorization: `Bearer ${otherToken}` },
      data: { loopId },
    });
    expect(res.status()).toBe(403);

    await adminContext.close();
    await otherContext.close();
  });

  test("el webhook actualiza loop_subscriptions con eventos firmados localmente", async ({ browser }) => {
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await signUpAndLogin(adminPage, `qa.loopy.stripe.wh.${stamp}@mailinator.com`, "QA Webhook");
    const loopId = await createLoop(adminPage, `QA Webhook ${stamp}`);

    const fakeCustomerId = `cus_e2e_${stamp}`;
    const fakeSubscriptionId = `sub_e2e_${stamp}`;

    function sign(payload: string) {
      return Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET_TEST });
    }

    const subscriptionEvent = {
      id: `evt_e2e_${stamp}`,
      object: "event",
      type: "customer.subscription.created",
      data: {
        object: {
          id: fakeSubscriptionId,
          object: "subscription",
          customer: fakeCustomerId,
          status: "trialing",
          trial_end: Math.floor(Date.now() / 1000) + 86400,
          current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
          metadata: { loop_id: loopId },
        },
      },
    };
    const payload = JSON.stringify(subscriptionEvent);

    const res = await adminPage.request.post("/api/stripe/webhook", {
      headers: { "stripe-signature": sign(payload), "content-type": "application/json" },
      data: payload,
    });
    expect(res.ok()).toBeTruthy();

    const token = await getAccessToken(adminPage);
    const subRes = await adminPage.request.get(
      `${SUPABASE_URL}/rest/v1/loop_subscriptions?loop_id=eq.${loopId}&select=status,stripe_subscription_id`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
    );
    expect(subRes.ok()).toBeTruthy();
    const rows = await subRes.json();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("trialing");
    expect(rows[0].stripe_subscription_id).toBe(fakeSubscriptionId);

    // Ahora sí tiene acceso: reentrar al Loopy no debe rebotar a /suscripcion
    await adminPage.goto(`/loop/${loopId}/familia`);
    await expect(adminPage).toHaveURL(new RegExp(`/loop/${loopId}/familia`));

    await adminContext.close();
  });

  test("un Loopy sin fila en loop_subscriptions rebota a /suscripcion", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signUpAndLogin(page, `qa.loopy.stripe.gate.${stamp}@mailinator.com`, "QA Gate");
    const loopId = await createLoop(page, `QA Gate ${stamp}`);

    // Renavegar explícito a /familia para confirmar el rebote incluso si
    // createLoop ya había aterrizado directo en /suscripcion.
    await page.goto(`/loop/${loopId}/familia`);
    await expect(page).toHaveURL(new RegExp(`/loop/${loopId}/suscripcion`), { timeout: 15000 });

    await context.close();
  });
});
```

- [ ] **Step 2: Instalar `stripe` como dependencia si Task 1 no la
  dejó disponible para imports de tipo en `e2e/`**

`e2e/stripe-billing.spec.ts` importa `Stripe` solo para
`Stripe.webhooks.generateTestHeaderString` (un método estático, no
necesita una instancia ni una API key real). Confirmar que
`import Stripe from "stripe"` resuelve sin error de tipos — ya debería,
porque Task 1 instaló el paquete como dependencia de la app completa.

- [ ] **Step 3: Correr la suite una vez para confirmar el único tipo de
  fallo esperado**

Run: `npm run test:e2e -- stripe-billing`

Expected (mientras la migración de
`docs/superpowers/specs/2026-08-31-loop-subscriptions.sql` no esté
corrida en la base real): el primer test (`no puede crear...`) debería
pasar (no toca `loop_subscriptions`). El segundo y el tercero deberían
fallar con un error de Postgres tipo `relation "loop_subscriptions" does
not exist` (vía la respuesta de la REST API de Supabase) — cualquier
otro tipo de fallo (error de compilación, selector de Playwright que no
matchea, timeout de red) es un bug real a corregir antes de continuar.
Si Sebastián ya corrió la migración para cuando se ejecuta esta tarea,
los tres tests deberían pasar limpio — en ese caso no hace falta ninguna
acción extra.

- [ ] **Step 4: Commit**

```bash
git add e2e/stripe-billing.spec.ts
git commit -m "test: e2e coverage for Stripe checkout auth, webhook sync, and access gate"
```

## Verification

1. `npm run build` limpio en el estado final del branch (todas las
   tareas aplicadas).
2. `npm run lint` sin errores nuevos.
3. `npm run test:e2e -- stripe-billing` — ver el criterio de Task 6 Step 3
   (el único fallo aceptable hoy es "tabla no existe", por la migración
   pendiente).
4. Confirmar manualmente (lectura de código, no requiere credenciales)
   que ninguna ruta bajo `app/api/stripe/` importa nada `"use client"`, y
   que `lib/stripeClient.ts`/`lib/supabaseAdmin.ts`/`lib/stripeAuth.ts`
   no se importan desde ningún archivo `"use client"` (grep:
   `grep -rl "lib/supabaseAdmin\|lib/stripeAuth\|lib/stripeClient" app components | xargs grep -l "\"use client\""`
   — debe devolver vacío).
5. Entregar a Sebastián: el archivo
   `docs/superpowers/specs/2026-08-31-loop-subscriptions.sql` para
   correr en el Supabase Dashboard, y la lista de env vars de
   `.env.local.example` para cargar en Vercel (Production + Preview) y
   en `.env.local` local una vez tenga las credenciales reales de
   Stripe mañana.
