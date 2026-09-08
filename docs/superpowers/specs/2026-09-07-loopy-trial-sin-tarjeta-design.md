# Loopy: alta mínima + trial de 1 día sin tarjeta (diseño)

> Spec cerrado — pasó por revisión de seguridad/privacidad (2 agentes
> dedicados) y por la aprobación del usuario sobre los hallazgos.

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
5. El documento de identidad (DNI/NIE/pasaporte) era, en un principio,
   para facturación/impuestos de la **persona**, no de una empresa.
   Verificado contra la documentación real de Stripe: `tax_id_collection`
   de Checkout **solo colecta IDs de empresa** (ej. `es_cif`, formato
   `A12345678` — un CIF, no un DNI) — no hay atajo nativo de Stripe para
   un documento personal. **Actualizado tras la revisión de seguridad**
   (ver más abajo): finalmente NO se le pide documento personal a las
   familias — solo se usa el `tax_id_collection` nativo de Stripe, y
   solo aplica a quien factura como empresa. Sección C queda
   simplificada en consecuencia.

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
lo escribe ni lo puede falsear insertando directo.

**Ojo, detalle que casi se filtra sin arreglar:** `hasLoopAccess(status)`
hoy es una función pura del texto del estado — si simplemente se
agrega `"trialing_no_card"` a `ACCESS_GRANTING_STATUSES` (como se hizo
con `admin_bypass`), el trial **jamás vencería**, porque nada cambia
ese texto cuando pasa el día. A diferencia de `admin_bypass` (acceso
permanente a propósito), `trialing_no_card` es un estado con
vencimiento — necesita el dato de tiempo, no solo el texto. `lib/types.ts`
suma `"trialing_no_card"` a `SubscriptionStatus`, pero `hasLoopAccess`
gana un segundo parámetro opcional:

```ts
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
```

`app/loop/[id]/layout.tsx` tiene que traer también `trial_end` junto
con `status` al cargar `loop_subscriptions` (hoy solo guarda el
string de estado en el contexto) y pasarlo en cada llamado a
`hasLoopAccess`. La comparación de fecha sigue pasando por el reloj
del navegador (mismo nivel que el resto del gate hoy, ver más abajo),
pero el valor `trial_end` en sí es 100% del servidor.

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

### C. Pantalla "Activar tu Loopy" — SIMPLIFICADA (documento solo para empresas)

**Decisión del usuario:** el documento de identidad personal (DNI/NIE/
pasaporte) NO se le pide a las familias — solo se factura como empresa
si el propio cliente de Loopy elige esa opción, y ese caso ya lo cubre
Stripe de forma nativa. Esto elimina por completo el formulario propio
y la tabla `billing_identity` de las versiones anteriores de este
documento — ya no hace falta guardar ningún documento de identidad en
Supabase, así que desaparecen de un saque los problemas de cifrado,
aislamiento de RLS y actualización de la política de privacidad que
había marcado la revisión de seguridad para ese diseño.

**Archivo nuevo:** `app/loop/[id]/activar/page.tsx`

Se muestra cuando el gate (B) detecta que el día gratis venció y sigue
sin suscripción. Formulario mínimo:
- Nombre completo (obligatorio — es lo único que se difirió del alta
  que todavía hace falta pedir antes de cobrar)

Al enviar: `update profiles set name = ...`, y llama al
`/api/stripe/checkout` de siempre para ir a pagar.

**Archivo:** `app/api/stripe/checkout/route.ts`
- Se agrega `tax_id_collection: { enabled: true }` (sin `required`,
  para no forzarlo) a la creación de la `checkout.sessions.create(...)`.
  Stripe ya sabe mostrar ese campo solo cuando corresponde según la
  ubicación del que paga, y queda opcional — una familia lo deja en
  blanco y sigue de largo; una empresa que quiera su CIF en la factura
  lo carga ahí mismo, sin que nosotros construyamos ni guardemos nada.
  Confirmado contra la documentación real de Stripe: el CIF español es
  `es_cif` (ver Decisión 5 más arriba).

## Fuera de alcance (sin cambios)

Bypass de admin, alta de familiares por teléfono + ubicación previa,
Zonas, SOS, Mapa/Rutas, selección de rol en el signup (quedó fuera —
es la parte "B2" de un brief anterior, no se pidió acá).

## Hallazgos de la revisión de seguridad/privacidad sobre `billing_identity` (tabla descartada)

**Obsoleto** — se dejaba registro acá porque la revisión de seguridad
se hizo sobre la versión del diseño que sí guardaba el documento
personal en Supabase. El usuario decidió después no pedirle DNI/NIE/
pasaporte a las familias (sección C), así que `billing_identity` nunca
se crea y estos hallazgos no aplican a lo que se va a implementar.
Quedan resumidos por si el documento personal vuelve a discutirse más
adelante: el mayor riesgo era que el texto plano dependía enteramente
de que no se filtre `SUPABASE_SERVICE_ROLE_KEY` (ese secreto ya
bypasea RLS por diseño, confirmado en `lib/supabaseAdmin.ts`); la
policy de RLS propuesta en su momento sí era correcta (`auth.uid()` no
es falseable por el cliente); y pedirle el documento al 100% de las
familias tensionaba con minimización de datos de RGPD — que es
justamente lo que motivó la decisión de sacarlo.

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

## Decisiones finales del usuario tras la revisión de seguridad

1. **El hueco de RLS de fondo (punto 3 de arriba) se deja fuera de
   esta tarea, a propósito.** No se resuelve acá — queda anotado como
   su propio ítem de seguridad para encarar aparte, con su propio
   brainstorming dedicado dado el tamaño (reescribir políticas de
   `locations`/`sos_alerts`/`safe_zones`/`zone_events`/`speed_alerts`
   para que dependan del estado real de la suscripción). Este trial
   queda al mismo nivel de seguridad que el trial con tarjeta actual —
   ninguno de los dos resuelve ese hueco, ninguno de los dos lo
   empeora más allá de lo ya descrito en el hallazgo 3.
2. **No se pide documento de identidad personal a las familias.**
   Sección C simplificada: solo nombre completo antes de pagar, más
   `tax_id_collection` nativo de Stripe (opcional) para quien facture
   como empresa. Sin tabla nueva, sin dato sensible propio que guardar,
   sin cambios a `app/privacidad/page.tsx` necesarios por este motivo.

## Fuera de alcance — seguimiento de seguridad separado

- Atar las políticas RLS de datos en vivo (`locations`, `sos_alerts`,
  `safe_zones`, `zone_events`, `speed_alerts`) al estado real de la
  suscripción, en vez de depender solo del gate de UI en
  `app/loop/[id]/layout.tsx`. Preexistente, afecta también al trial
  con tarjeta que ya está en producción. Requiere su propia sesión de
  `brainstorming` cuando se decida encararlo.
