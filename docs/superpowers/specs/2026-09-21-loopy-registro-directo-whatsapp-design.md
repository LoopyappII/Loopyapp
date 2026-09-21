# Loopy — Registro directo al mapa + invitación por WhatsApp (spec)

## Contexto

El cliente (Looper Cashline SL) pidió dos cambios sobre el flujo de alta y
de invitación de Loopy:

1. **Sacar el paso de "elegir modo" antes del mapa.** Hoy, después de
   registrarse, el usuario cae en `/dashboard` (lista de Loopys) y ahí
   llena un formulario "Crear un Loopy" que incluye un `<select>` de Modo
   Espejo / Modo Supervisión — recién después de crear el Loopy entra al
   mapa. El cliente quiere que, apenas se registra la cuenta, la persona
   caiga **directo al mapa**, sin ese paso previo. El modo se elige
   **después**, dentro del propio dashboard de admin del mapa (la pestaña
   de Ajustes).
2. **Invitar por WhatsApp con el código ya armado.** El admin puede agregar
   un invitado por teléfono (queda "pendiente" en Familia) y hoy solo puede
   compartirle el código de invitación a mano. El cliente quiere un botón
   que arme un **link de WhatsApp con el código ya armado**: el invitado lo
   abre, acepta, y con eso ya queda registrado en Loopy **y con permiso
   para compartir/ver ubicación** en ese Loopy.

Decisión ya tomada con Sebastián: el "ir directo al mapa" aplica al
**registro nuevo únicamente**. El login de una cuenta ya existente sigue
yendo a `/dashboard` como hoy — excepto cuando el login trae un link de
invitación (`?invite=&pm=`), caso en el que sí completa la aceptación y
entra directo al mapa de ese Loopy.

## Hallazgos de la investigación (repo real, `origin/master`)

- Signup y login hoy **siempre** redirigen a `/dashboard`
  (`app/signup/page.tsx`, `app/login/page.tsx`). El `<select>` de modo vive
  dentro del formulario "Crear un Loopy" de `app/dashboard/page.tsx`.
- La estructura de tabs (`app/loop/[id]/{mapa,familia,rutas,sos,ajustes,
  activar,suscripcion}` + `layout.tsx` compartido) ya existe.
- El "permiso" para ver/compartir ubicación en un Loopy **no depende del
  `role`** — depende enteramente de que la fila `loop_members` tenga
  `user_id` distinto de `null`. En cuanto esa fila queda vinculada a una
  cuenta real, esa persona escribe su ubicación (`layout.tsx`,
  `watchPosition`) y ve a todos los demás (`mapa/page.tsx`, sin filtro de
  rol). "Aceptar la invitación" = setear `user_id` en la fila
  `loop_members` pendiente que ya creó el admin — no hace falta tabla ni
  columna nueva.
- Ya existe un trigger de Postgres (`link_pending_loop_members`,
  `docs/superpowers/specs/2026-08-24-loopy-familia-alta-miembros-design.md`)
  que auto-vincula un miembro pendiente por coincidencia exacta de
  teléfono, y está **confirmado en funcionamiento** por
  `e2e/loop-nav-shell.spec.ts` ("familia: admin adds pending member by
  phone, auto-links on matching signup" — test ya committeado y, según
  notas del proyecto, verde). El flujo de WhatsApp de este spec **no
  depende de ese trigger** — usa un id directo (`pm=<loop_members.id>`) en
  el link, más confiable que un match de teléfono carácter por carácter.
  Ambos mecanismos conviven sin conflicto.
- Patrón ya establecido para escrituras privilegiadas server-side que
  evitan RLS: `lib/stripeAuth.ts` (`requireLoopAdmin`) +
  `lib/supabaseAdmin.ts` (service role), usado por
  `app/api/loops/start-trial/route.ts`. Se reutiliza el mismo patrón acá.
- **No existe ninguna integración de WhatsApp en el repo** — se construye
  desde cero, sin helper previo que reusar (el precedente más cercano es el
  uso de links `tel:` en `sos/page.tsx` y `layout.tsx`).
- `e2e/loop-nav-shell.spec.ts` es una suite Playwright real (no mockeada):
  hace signups reales contra el proyecto de Supabase real de este código
  (`NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` hardcodeados como fallback en
  `lib/supabaseClient.ts`), con confirmación de email real vía la inbox
  pública de mailinator.com (`confirmEmailViaMailinator`). Sus dos tests
  actuales **asumen que "Crear Loopy"/"Unirme" NO navegan solos** (el
  admin se queda en `/dashboard` y hace clic en el link de la lista) — este
  spec cambia exactamente eso, así que la suite necesita actualizarse en el
  mismo trabajo, no como algo aparte.

## Diseño

### 1. Registro → directo al mapa, sin elegir modo antes

**Alta orgánica (sin invitación)**: al obtener sesión (inmediata, o tras
confirmar el email y hacer login) sin parámetros de invitación en la URL,
se auto-crea un Loopy por defecto (nombre `"Mi Loopy"`, `mode: "mirror"`,
fila de `loop_members` como admin, llamada a `/api/loops/start-trial`,
mismo procedimiento que ya hace `handleCreateLoop` en
`app/dashboard/page.tsx`) y se redirige directo a `/loop/{loopId}/mapa`.
Nombre y modo quedan editables después en Ajustes.

**`/dashboard`** sigue existiendo (crear un *segundo* Loopy, unirse por
código, o el caso borde de 0 Loopys llegando ahí manualmente) — se le saca
el `<select>` de modo del formulario "Crear un Loopy" (modo fijo
`"mirror"` al crear). Tanto "Crear Loopy" como "Unirse a un Loopy" pasan a
redirigir a `/loop/{loopId}/mapa` en vez de quedarse en `/dashboard` o ir a
`/familia`.

**Login sin invitación**: sigue yendo a `/dashboard`, sin cambios.

### 2. El modo se elige en Ajustes (dashboard de admin del mapa)

`app/loop/[id]/ajustes/page.tsx` gana un input de nombre y el mismo
`<select>` de modo que hoy vive en `/dashboard` (mismas opciones/copy),
dentro del bloque ya admin-gated (`isAdmin`). `saveLoopSettings` (definida
en `layout.tsx`, expuesta por `LoopContext.tsx`) extiende su firma:
`saveLoopSettings(name, mode, speedLimitKmh, emergencyNumber,
primaryContactNumber)`.

### 3. Invitación por WhatsApp con código ya armado

1. El admin agrega al invitado por teléfono como hoy (`familia/page.tsx`,
   `addPendingMember`). Cada fila pendiente gana un botón "Enviar por
   WhatsApp" que arma:
   ```
   https://wa.me/<telefono-solo-digitos>?text=<mensaje con
   https://www.directloopy.com/signup?invite=<loop.invite_code>&pm=<loop_members.id>>
   ```
2. El invitado abre el link. `/signup` y `/login` leen `invite`/`pm` de la
   URL. Si están presentes, al obtener sesión llaman a
   `POST /api/loops/accept-invite` para reclamar esa fila pendiente
   (`user_id = <caller>`), en vez de auto-crear/pedir un Loopy nuevo, y
   redirigen a `/loop/{loopId}/mapa`.
   - Sin cuenta: se registra en `/signup` con los parámetros ya en la URL.
     Si el proyecto exige confirmar email, `emailRedirectTo` se arma
     dinámicamente para no perder `invite`/`pm` en el viaje por el mail:
     `https://www.directloopy.com/login?invite=...&pm=...`. El link
     "¿Ya tienes cuenta?" también los reenvía.
   - Con cuenta: entra a `/login` (con los parámetros ya presentes) y el
     mismo mecanismo corre ahí — esto es válido **incluso** con la decisión
     de que el login normal (sin invitación) siga yendo a `/dashboard`:
     esa regla es solo para login **sin** `invite`/`pm`.
   - Si la invitación ya fue aceptada o los parámetros no matchean, la
     aceptación falla con error claro; signup cae a auto-crear su propio
     Loopy, login cae a `/dashboard` — nunca deja a nadie colgado.
3. `POST /api/loops/accept-invite` (nueva ruta, mismo patrón que
   `start-trial`): verifica el Bearer token del caller
   (`requireAuthedUser`, nueva función en `lib/stripeAuth.ts`, hermana más
   liviana de `requireLoopAdmin` — no exige ser admin), y con
   `supabaseAdmin` (service role, evita depender de RLS no documentadas):
   busca la fila `loop_members` por `pmId`, confirma que `user_id` sigue
   `null` y que el `invite_code` recibido matchea el del `loop_id` de esa
   fila, y hace `update({ user_id: caller })` con `is("user_id", null)`
   como guarda de carrera. Devuelve `{ loopId }`.

**Nota técnica de Next.js:** `useSearchParams()` en `signup`/`login` exige
envolver el componente en `<Suspense>` para no romper el build estático —
mover el cuerpo de cada página a un componente interno
(`SignupForm`/`LoginForm`).

## Fuera de alcance

- No se toca el trigger `link_pending_loop_members` existente (queda
  como mecanismo paralelo, sin relación con el nuevo flujo).
- No se agregan tablas ni columnas nuevas a Supabase.
- No se migra retroactivamente el `role` de miembros existentes al cambiar
  el modo de un Loopy ya creado.
