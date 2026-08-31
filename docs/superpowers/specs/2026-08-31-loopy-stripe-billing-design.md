# Loopy — suscripción con Stripe (diseño)

## Contexto

Looper Cashline SL (cliente, dueño de Loopy) ya tiene cuenta de Stripe.
Pidió: "prepara todo para mañana cuando tengamos las credenciales poder
conectarnos" — el código y el esquema deben quedar completos y
estructuralmente verificados hoy (31/08); mañana solo se pegan claves
reales y se prueba en vivo con el cliente presente. El usuario confirmó
explícitamente que NO quiere probar hoy con credenciales de test propias
("no quiero hacer el test con credenciales mias, quiero hacer mañana con
el cliente") — así que este plan no depende de tener una cuenta Stripe
disponible hoy.

Precio ya fijado y visible en producción (`app/signup/page.tsx:110`,
`components/MagnifierLanding.tsx:80`): **1 día gratis, luego 14,99€/mes**.
Este spec asume un único plan (`Loopy — mensual`, 14,99€/mes, sin niveles).

Decisiones ya tomadas con el usuario (vía `AskUserQuestion` en la sesión):
- **Unidad de facturación: por Loopy/familia**, no por usuario individual.
  El pagador es el admin del Loopy (`loops.admin_id`).
- **Trial con tarjeta desde el inicio** (Stripe Checkout con
  `trial_period_days`, no un trial sin tarjeta que pida el dato después).

## Alcance

Dentro: tabla nueva de suscripción, 3 rutas API, página de "reactivar",
gating de acceso en el shell del Loopy, ajuste al flujo de creación de
Loopy. Fuera de alcance: multi-plan/upsell, facturación anual, cupones,
período de gracia configurable (se usa el default de Stripe: `past_due`
sigue con acceso hasta que Stripe cancela tras los reintentos).

## Modelo de datos

Tabla nueva `loop_subscriptions`, 1 fila por Loopy — **no** se agregan
columnas a `loops` para no arriesgar los `select("*")` existentes sobre
esa tabla (dashboard, layout.tsx, etc. ya la consultan así en varios
puntos) ni el tipo `Loop` que otros componentes ya asumen estable.

```sql
create table public.loop_subscriptions (
  loop_id uuid primary key references public.loops(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  status text not null default 'incomplete',
  trial_end timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index loop_subscriptions_status_idx on public.loop_subscriptions(status);

alter table public.loop_subscriptions enable row level security;

-- Cualquier miembro del Loopy puede LEER el estado de la suscripción
-- (para mostrar el aviso de "reactivar" incluso a no-admins).
create policy "loop_subscriptions_select_members"
  on public.loop_subscriptions for select
  using (
    exists (
      select 1 from public.loop_members
      where loop_members.loop_id = loop_subscriptions.loop_id
        and loop_members.user_id = auth.uid()
    )
  );

-- Sin policy de INSERT/UPDATE/DELETE para usuarios: el webhook escribe
-- con la service_role key, que bypassea RLS por diseño de Supabase.
-- Ningún cliente debe poder escribir su propio estado de suscripción.
```

`status` espeja los valores de Stripe que nos importan:
`incomplete | trialing | active | past_due | canceled`.

Campo derivado de acceso: **tiene acceso** si
`status in ('trialing', 'active', 'past_due')` — `past_due` mantiene
acceso mientras Stripe reintenta el cobro (su propio período de gracia);
perderlo pasa a `canceled` recién cuando Stripe agota los reintentos o el
cliente cancela.

Este SQL lo corre Sebastián manualmente en el Supabase Dashboard — esta
sesión no tiene acceso de escritura a la base real de Loopy (confirmado:
el proyecto Supabase conectado por MCP en esta sesión es otro proyecto,
no el de Loopy).

## Flujo

1. **Crear Loopy** (`app/dashboard/page.tsx`, `handleCreateLoop`): sin
   cambios hasta la línea 88 (se sigue creando `loops` + `loop_members`
   admin de inmediato — así el resto de la app, incluida la guía de alta
   de miembros por teléfono del flujo recién agregado, sigue intacta).
   Después de esas dos inserciones exitosas, en vez de
   `router.push(\`/loop/${loop.id}/familia\`)`, se llama a
   `POST /api/stripe/checkout` con `{ loopId: loop.id }` y se redirige
   (`window.location.href`) a la `url` de la Checkout Session que
   devuelve. Si la llamada falla (red, Stripe caído), se hace el
   `router.push` de siempre igual — el Loopy no queda huérfano de
   navegación, y el layout gatea el acceso igual en el siguiente paso.
2. **Checkout** (`app/api/stripe/checkout/route.ts`): valida sesión de
   Supabase del caller (header `Authorization: Bearer <token>` con el
   `access_token` del cliente, verificado server-side con
   `supabase.auth.getUser(token)`), confirma que el caller es
   `loops.admin_id` del `loopId` recibido, crea (o reutiliza) un
   `stripe.customers` para ese `loop_id` y crea una
   `checkout.sessions` en `mode: 'subscription'`,
   `trial_period_days: 1`, `line_items: [{ price: STRIPE_PRICE_ID,
   quantity: 1 }]`, `client_reference_id: loopId`,
   `metadata: { loop_id: loopId }`,
   `success_url: '.../loop/{loopId}/familia?checkout=success'`,
   `cancel_url: '.../loop/{loopId}/familia?checkout=cancelled'`.
   Devuelve `{ url }`.
3. **Webhook** (`app/api/stripe/webhook/route.ts`): verifica firma con
   `STRIPE_WEBHOOK_SECRET` sobre el body crudo (`req.text()`, App Router
   entrega el body sin parsear si no se llama `req.json()` antes).
   Escucha:
   - `checkout.session.completed` → upsert en `loop_subscriptions`
     (`loop_id` de `metadata.loop_id`, `stripe_customer_id`,
     `stripe_subscription_id`, `status` y `trial_end`/
     `current_period_end` leídos de la subscription expandida).
   - `customer.subscription.updated` → update por
     `stripe_subscription_id`: `status`, `current_period_end`.
   - `customer.subscription.deleted` → `status = 'canceled'`.
   - `invoice.payment_failed` → `status = 'past_due'` (si la
     subscription asociada sigue activa; Stripe ya maneja los reintentos).
   Usa el cliente Supabase con `SUPABASE_SERVICE_ROLE_KEY` (nuevo, server
   -only, nunca `NEXT_PUBLIC_`) para bypassear RLS.
4. **Gating** (`app/loop/[id]/layout.tsx`, dentro de `loadLoopData` o
   justo después): se agrega una consulta a `loop_subscriptions` por
   `loop_id` eq `loopId`. Si no hay fila, o `status` no está en
   `('trialing','active','past_due')`, se redirige a
   `/loop/${loopId}/suscripcion` en vez de renderizar `children` — mismo
   patrón que el `if (loading || !loop || !userId)` ya existente (early
   return antes del `<LoopContext.Provider>`). Los tabs de navegación
   (mapa/familia/rutas/sos/ajustes) quedan cubiertos automáticamente
   porque todos son hijos de este layout — no hace falta tocarlos uno por
   uno.
5. **Pantalla de reactivación** (`app/loop/[id]/suscripcion/page.tsx`,
   nueva, fuera del layout gateado — o dentro pero excluida del check
   anterior): mensaje según el `status` real (`incomplete`→"completa tu
   pago", `past_due`→"hay un problema con tu tarjeta", `canceled`→"tu
   suscripción terminó"), botón que llama a `POST /api/stripe/checkout`
   (si no hay subscription aún) o `POST /api/stripe/portal` (si ya la
   hay, para gestionar tarjeta/cancelar vía el Billing Portal de Stripe).
6. **Portal** (`app/api/stripe/portal/route.ts`): mismo patrón de auth
   que checkout, crea una `billingPortal.sessions` para el
   `stripe_customer_id` del Loopy y devuelve `{ url }`.

Los miembros no-admin no ven ninguna de estas pantallas de pago — el
gate es a nivel de Loopy (paso 4), así que si el admin no paga, todos los
miembros (admin incluido) ven la pantalla de reactivación al entrar a
ese Loopy; el admin es el único que ve los botones de acción en ella
(mismo criterio `isAdmin` que ya usa `ajustes/page.tsx`).

## Rutas nuevas

- `app/api/stripe/checkout/route.ts` — `POST`, autenticado, admin-only.
- `app/api/stripe/webhook/route.ts` — `POST`, público, verificado por
  firma Stripe (no por Supabase auth).
- `app/api/stripe/portal/route.ts` — `POST`, autenticado, admin-only.
- `app/loop/[id]/suscripcion/page.tsx` — página nueva.
- `lib/stripeClient.ts` — instancia única de `Stripe` server-side
  (`new Stripe(process.env.STRIPE_SECRET_KEY!)`), igual patrón que
  `lib/supabaseClient.ts` para no repetir la inicialización en cada ruta.
- `lib/supabaseAdmin.ts` — cliente Supabase server-only con la
  `service_role` key, usado solo por el webhook.

## Variables de entorno nuevas

```
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=
SUPABASE_SERVICE_ROLE_KEY=
```

Ninguna necesita el prefijo `NEXT_PUBLIC_` — Checkout y el Portal se
crean server-side y se navega por URL; no hace falta Stripe.js/Elements
en el cliente para este flujo. Se documentan en `.env.local.example`
(nuevo archivo, no gitignoreado, sin valores reales) y hay que cargarlas
también en Vercel (Production + Preview) — igual patrón que
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` en el sprint del mapa.

## Testing (sin credenciales reales de Stripe)

El SDK de Stripe permite construir una firma de webhook válida
localmente sin red (`stripe.webhooks.generateTestHeaderString`,
determinística dado un secret) — esto SÍ se puede probar hoy de punta a
punta sin cuenta real:
- Test del webhook: payloads de ejemplo para los 4 eventos, firmados con
  un `STRIPE_WEBHOOK_SECRET` de prueba fijo, contra una base
  Supabase-en-memoria/mock (no la real) — verifica que cada evento
  produce el `status` esperado en la fila.
- Test del checkout/portal route: mock del SDK de Stripe
  (`jest.mock`-equivalente o inyección del cliente) para verificar que
  se rechaza a un no-admin (403) y que un admin válido recibe `{url}`
  con los parámetros correctos pasados a `stripe.checkout.sessions.create`.
- Test del gating en `layout.tsx`: ya cubierto por Playwright si se
  agrega un caso con una fila de `loop_subscriptions` en estado
  `canceled` insertada directo por el test contra una base de test (fuera
  de alcance de hoy si no hay base de test disponible — se deja anotado
  como pendiente para mañana).

Lo que **no** se puede probar hoy: el flujo real de Checkout Session
contra la API de Stripe (crear una sesión de verdad, pagarla, que el
webhook real llegue) — requiere credenciales de Stripe, que llegan
mañana. El build (`npm run build`) y los tests de arriba son la barra de
"listo" de hoy.

## Riesgos / no-objetivos

- Sin período de gracia custom: se usa el comportamiento default de
  Stripe para reintentos de cobro fallido.
- Sin manejo de "downgrade" o "múltiples planes": un solo precio.
- Si el admin de un Loopy cambia (no existe hoy esa función en el
  producto), la suscripción sigue atada al `loop_id`, no al usuario —
  coherente con "facturación por Loopy/familia".
- No se toca nada de lo ya construido (mapa, Realtime, alta de miembros
  por teléfono, SOS, zonas) — este spec solo agrega tabla, rutas y un
  gate de lectura en el layout existente.
