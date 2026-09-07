# Loopy: alta mínima + trial sin tarjeta + documentación al finalizar (diseño)

> Borrador — en revisión de seguridad/privacidad antes de cerrarlo.

## Contexto

El cliente pidió simplificar el alta al máximo: en el primer ingreso solo
email y contraseña (nada de nombre completo), y recién pedir tarjeta +
documentación de identidad (DNI/NIE/pasaporte, según el país) cuando el
día gratis termina. Esto ya estaba anotado como "Etapa B" en un plan
anterior — un cambio de arquitectura que se dejó para una sesión de
brainstorming dedicada, que es esta.

Hoy (en producción): `app/api/stripe/checkout/route.ts` crea la sesión
de Stripe Checkout **en el momento de crear el Loopy**
(`app/dashboard/page.tsx:handleCreateLoop`), con `trial_period_days: 1`
— la tarjeta se pide upfront, aunque el cobro real se demore un día.
Esto cambia por completo: no se llama a Stripe hasta que el día gratis
termina.

## Decisiones confirmadas con el usuario

1. El teléfono se mantiene en el alta (junto a email/contraseña) — es
   lo que usa la vinculación automática de familiares agregados por
   teléfono antes de registrarse (ya en producción). Sacarlo rompería
   esa vinculación.
2. El nombre completo se difiere, junto con la tarjeta y el documento,
   al momento en que el día gratis termina.
3. El día gratis arranca cuando se crea el primer Loopy (no en el
   signup) — igual que el criterio de hoy.
4. Duración: 1 día — sin cambios respecto al valor actual
   (`trial_period_days: 1`).
5. El documento de identidad (DNI/NIE/pasaporte) es para
   facturación/impuestos, pero es de la **persona**, no de una empresa.
   Verificado contra la documentación real de Stripe: `tax_id_collection`
   de Checkout **solo colecta IDs de empresa** (ej. `es_cif`, formato
   `A12345678` — un CIF, no un DNI). No hay atajo nativo de Stripe para
   esto. Se confirma: se pide igual, con un formulario propio.

## Diseño técnico

### A. Signup simplificado

**Archivo:** `app/signup/page.tsx`
- Se saca el campo "Nombre". Quedan: teléfono (obligatorio, sin cambios),
  email, contraseña.
- `supabase.auth.signUp({ options: { data: { phone } } })` — ya no manda
  `name`.
- **Efecto visible a aceptar:** hasta completar el paso C, el admin
  aparece como "Miembro" en Familia y en el `InfoWindow` del Mapa (son
  los fallbacks que ya existen hoy para `profiles.name` nulo — no hace
  falta programar nada nuevo para esto, es una consecuencia del cambio).

### B. Gate de acceso: trial local — REDISEÑADO tras la revisión de seguridad

**Versión descartada** (la que tenía este documento antes de la
revisión): comparar `loops.created_at + 1 día` contra la hora del
cliente, sin ninguna fila en `loop_subscriptions`. Un agente de
seguridad encontró que esto es explotable con **una sola llamada REST
directa** (sin pasar por la UI): `loops.created_at` no tiene ninguna
protección documentada contra que el cliente lo mande con un valor
propio en el `insert` (la policy de RLS de `loops` no está ni siquiera
visible en este repo — mismo punto ciego ya conocido de otras tablas).
Alguien podría insertar su Loopy con `created_at: "2099-01-01"` y tener
acceso gratis para siempre, con un solo `curl`.

**Diseño nuevo — fila real desde el día 0, calculada en el servidor:**

En vez de "sin Stripe, sin fila", al crear el Loopy se inserta
igual una fila en `loop_subscriptions` — pero por el propio servidor
(vía `supabaseAdmin`, mismo patrón ya usado para `admin_bypass`), nunca
por el cliente:

```sql
insert into loop_subscriptions (loop_id, stripe_customer_id, stripe_subscription_id, status, trial_end)
values (:loop_id, 'trial_no_card_' || :loop_id, 'trial_no_card_' || :loop_id, 'trialing_no_card', now() + interval '1 day')
```

`trial_end` lo calcula Postgres con su propio reloj — el cliente nunca
lo escribe ni lo puede falsear insertando directo. `lib/types.ts` suma
`"trialing_no_card"` a `SubscriptionStatus` y a
`ACCESS_GRANTING_STATUSES` (mismo mecanismo ya usado para
`admin_bypass`, cero piezas nuevas). El gate compara `trial_end`
(un valor que salió del servidor) contra la hora actual — no
`loops.created_at`.

**Esto deja este trial exactamente al mismo nivel de seguridad que el
trial con tarjeta que ya existe en producción hoy** (que también
compara la expiración contra la hora del cliente en el mismo gate) — ni
mejor ni peor. Hay un problema más grande y **preexistente**, no
introducido por este cambio: el gate de `layout.tsx` es, por diseño
documentado del propio equipo
(`docs/superpowers/plans/2026-08-31-loopy-stripe-billing.md:46`), "un
control de producto (UI), no de seguridad" — ninguna política RLS de
`locations`/`sos_alerts`/`safe_zones`/etc. depende hoy del estado de la
suscripción. Esto ya es cierto en producción ahora mismo, con o sin
este cambio. Lo dejo anotado como punto aparte más abajo — no lo
resuelvo silenciosamente ni lo escondo bajo la alfombra de esta tarea.

**Elegibilidad por cuenta, no por Loopy** (cierra un segundo hallazgo:
sin esto, alguien podía borrar y crear Loopys sin fin para tener
"días gratis" infinitos). Antes de insertar la fila de arriba, el
mismo endpoint del servidor chequea:

```sql
select exists (
  select 1 from loop_subscriptions ls
  join loops l on l.id = ls.loop_id
  where l.admin_id = :admin_id
    and ls.status = 'trialing_no_card'
    and ls.trial_end < now()
) as ya_uso_su_trial
```

Si ya usó su trial gratis en cualquier Loopy anterior, el Loopy nuevo
**no** recibe una fila `trialing_no_card` — directamente no tiene
suscripción, y el gate lo manda a `/activar` de entrada.

**Archivo:** `app/dashboard/page.tsx` (`handleCreateLoop`)
- Se saca el `fetch("/api/stripe/checkout")` de acá. Se agrega un
  fetch a un endpoint nuevo (ej. `/api/loops/start-trial`, POST con
  `loopId`) que hace el insert de arriba con `supabaseAdmin`, después
  de validar admin del Loopy (reusar `requireLoopAdmin`). El bypass de
  admin sigue existiendo tal cual, sin cambios — sigue siendo el camino
  para quien nunca debería pasar por Stripe en absoluto, ni siquiera al
  vencer el trial.

### C. Pantalla "Activar tu Loopy"

**Archivo nuevo:** `app/loop/[id]/activar/page.tsx`

Se muestra cuando el gate (B) detecta que el día gratis venció y sigue
sin suscripción. Formulario:
- Nombre completo (obligatorio)
- Tipo de documento: DNI / NIE / Pasaporte / Otro (select)
- País (select o texto)
- Número de documento (texto)

Al enviar: (1) `update profiles set name = ...`, (2) upsert en la tabla
nueva `billing_identity` (ver D), (3) llama al mismo
`/api/stripe/checkout` de siempre para ir a pagar. Si vuelve de Stripe
sin completar el pago, a partir de ahí cae en `/suscripcion` como
cualquier suscripción incompleta hoy — `/activar` es solo el paso
previo de datos, una vez completado no se vuelve a pedir.

**Hallazgo de seguridad ya corregido en este diseño:** nada impedía que
alguien llamara a `/api/stripe/checkout` directo (con su token válido,
sin pasar por `/activar`) y pagara sin cargar nunca el documento —
no dejaba pagar de más, pero rompía por completo el propósito real de
pedirlo. Fix: `checkout/route.ts` ahora exige, antes de crear la sesión
de Stripe (excepto para el camino de `admin_bypass`, que no lo
necesita), que exista una fila en `billing_identity` para ese usuario —
si no existe, responde 400 con un código que el cliente usa para
redirigir a `/activar` en lugar de mostrar un error genérico.

### D. Tabla nueva `billing_identity` — aislada de `profiles`

`profiles` se comparte y se muestra a otros miembros del Loopy (join en
Familia). El documento de identidad **no puede vivir ahí**. Tabla
separada:

```sql
create table public.billing_identity (
  user_id uuid primary key references auth.users(id) on delete cascade,
  document_type text not null check (document_type in ('dni','nie','pasaporte','otro')),
  document_country text not null,
  document_number text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.billing_identity enable row level security;

create policy "own identity only"
  on public.billing_identity
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
```

Nunca se joinea con `loop_members`/`profiles` en ninguna consulta
compartida con otros miembros del Loopy.

**Nota legal explícita:** esto es una recomendación de aislamiento
técnico, no asesoría legal. La base legal de tratamiento (RGPD) y el
tiempo de retención del documento los tiene que definir alguien con
criterio legal del lado del cliente antes de ir a producción con esto.

## Fuera de alcance (sin cambios)

Bypass de admin, alta de familiares por teléfono + ubicación previa,
Zonas, SOS, Mapa/Rutas, selección de rol en el signup (quedó fuera —
es la parte "B2" de un brief anterior, no se pidió acá).

## Hallazgos de la revisión de seguridad/privacidad (`billing_identity`)

Agente dedicado, leyó el código real (`lib/supabaseAdmin.ts`,
`app/api/stripe/webhook/route.ts`, `app/loop/[id]/layout.tsx`,
`app/privacidad/page.tsx`, políticas RLS existentes) antes de opinar.

1. **[Alto] El texto plano depende de un solo secreto, sin decirlo.**
   `SUPABASE_SERVICE_ROLE_KEY` ya se usa hoy (webhook de Stripe) y
   bypassea RLS por diseño — confirmado en el propio código
   (`lib/supabaseAdmin.ts`). Con `billing_identity`, esa misma key pasa
   de "puede forjar estado de suscripción" a "puede leer el DNI de
   cada usuario". **Decisión a tomar**: cifrar `document_number` a
   nivel de columna (`pgcrypto`), o como mínimo documentar
   explícitamente que la confidencialidad de esta tabla depende
   enteramente de esa key y tratarla en consecuencia (rotación,
   alcance, quién la tiene).
2. **[Confirmado, no es un bug] La policy de RLS propuesta es
   infranqueable** contra el intento de insertar una fila con el
   `user_id` de otra persona — `auth.uid()` lo resuelve el servidor
   desde el JWT firmado, no algo que el cliente pueda falsear. Sí se
   recomienda, seguido el mismo criterio que ya usó esta sesión con
   `loop_members`, verificarlo con un test real contra la base antes
   de day 1 (no alcanza con la lectura del SQL).
3. **[Medio] Un solo punto de unión a vigilar a futuro:**
   `app/loop/[id]/layout.tsx:80` es el único lugar de todo el repo que
   hace join de `profiles` con otros miembros
   (`profiles!loop_members_user_id_fkey`) — es el lugar exacto a
   revisar en cualquier PR futura para asegurarse de que nadie
   extienda ese join a `billing_identity`. Hoy no existe ninguna
   pantalla de administración que liste usuarios/datos completos.
4. **[Decisión de producto, no técnica] ¿Pedirle el documento a
   TODO el mundo?** Stripe ya cubre el caso empresa (CIF) sin pedir
   nada nuevo. Facturar a un particular en España normalmente NO
   requiere su DNI salvo que pida factura completa — pedírselo a el
   100% de las familias que pagan €14,99/mes es más dato del necesario
   (tensiona con minimización de datos de RGPD). **Alternativa**: la
   pantalla de activación pregunta primero "¿facturación particular o
   empresa?" y sólo pide documento de identidad si corresponde,
   reduciendo cuántas filas de `billing_identity` existen en total.
5. **[Medio] Huecos que ya existían, pero que este dato hace más
   graves:** no hay ningún flujo de borrado automático hoy (el borrado
   de cuenta es manual, por email a soporte); la política de
   privacidad pública (`app/privacidad/page.tsx`) hoy NO menciona que
   se recolecta un documento de identidad, y promete borrar todo al
   cerrar la cuenta — lo cual choca con que Hacienda exige guardar
   datos de facturación ~4 años. Ninguna tabla de esta app tiene
   auditoría de accesos (no es algo a construir solo para esta, pero
   vale que quede anotado).

## Hallazgos de la revisión de seguridad (abuso del trial)

Segundo agente dedicado, enfocado en romper el mecanismo de trial —
leyó `app/dashboard/page.tsx`, `app/loop/[id]/layout.tsx`,
`lib/stripeAuth.ts`, y cada `.sql`/spec/plan del repo que toca RLS.

1. **[Crítico, corregido arriba] `loops.created_at` era falsificable
   con una sola llamada REST** → acceso gratis permanente. Ver el
   rediseño de la sección B (fila real en `loop_subscriptions`,
   `trial_end` calculado por Postgres, nunca por el cliente).
2. **[Alto, corregido arriba] Sin tope por cuenta, un admin podía
   crear Loopys descartables sin fin** para siempre tener un día
   gratis nuevo. Ver el chequeo de elegibilidad por cuenta en la
   sección B.
3. **[Crítico, PREEXISTENTE — no introducido por este cambio, no
   resuelto acá] El gate de `layout.tsx` es un control de UI, no de
   seguridad — confirmado por el propio equipo por escrito**
   (`docs/superpowers/plans/2026-08-31-loopy-stripe-billing.md:46`).
   Ninguna política RLS de `locations`/`sos_alerts`/`safe_zones`/
   `zone_events`/`speed_alerts` depende hoy del estado de la
   suscripción — cualquier persona que alguna vez fue miembro de un
   Loopy puede seguir leyendo/escribiendo esos datos llamando a
   Supabase directo, tenga suscripción activa o no, **ya hoy, en
   producción, sin este cambio**. Lo que este cambio sí hace es bajar
   el "piso" para llegar a ese estado explotable: hoy hace falta al
   menos cargar una tarjeta en Stripe; con el trial sin tarjeta,
   alcanza con registrarse. La única fila real (`trial_end`) que
   agrega el rediseño de la sección B no arregla esto — deja este
   trial en el mismo nivel de seguridad que el trial con tarjeta que
   ya existe, ni mejor ni peor, pero el problema de fondo (RLS no
   depende de la suscripción) sigue sin resolverse en ningún lado.
   **Esto es una decisión que le tengo que trasladar al usuario, no
   algo que decido yo solo** — ver la pregunta abajo.

## Abierto — a resolver antes de implementar

- [ ] **¿Alcance de esta tarea?** Con el rediseño de la sección B, este
  trial queda tan seguro como el trial con tarjeta actual — pero el
  hueco de fondo (RLS de datos en vivo sin atar a la suscripción) es
  preexistente y sigue abierto para AMBOS. Arreglarlo de raíz implica
  reescribir políticas RLS de varias tablas — bastante más grande que
  "cuándo se pide la tarjeta". ¿Lo dejamos como item de seguridad
  aparte y seguimos con esto, o lo sumamos al alcance de esta tarea?
- [ ] ¿Cifrado de `document_number` a nivel de columna, o se acepta el
  riesgo documentado (depende enteramente de que no se filtre la
  `service_role key`)?
- [ ] ¿Se pide el documento a todos, o solo a quien facture como
  empresa? (Stripe ya cubre el caso empresa sin pedir nada nuevo;
  pedírselo a cada familia que paga es más dato del necesario)
- [ ] Actualizar `app/privacidad/page.tsx` para declarar esta nueva
  recolección de datos, y definir el tiempo de retención real
  (¿4 años por normativa fiscal, aunque se borre la cuenta?) — esto
  necesita a alguien con criterio legal del lado del cliente, no lo
  resuelvo yo.
