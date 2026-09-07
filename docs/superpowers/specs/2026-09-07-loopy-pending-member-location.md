# Loopy: ubicación preliminar para miembros pendientes

## Contexto

El cliente pidió que, al agregar a alguien por teléfono (feature ya en
producción desde PR #9), se pueda dar de entrada una ubicación
aproximada, para que aparezca "algo" en el mapa antes de que esa
persona se registre. Diseñado en sesión de planning, verificado contra
el código real antes de escribir una sola línea.

Confirmado con el cliente: la ubicación se carga de las dos formas ya
usadas hoy en Zonas seguras — dirección escrita (Google Places
Autocomplete) o la ubicación actual del admin en ese momento.

## Cambios de esquema — correr manualmente en Supabase SQL Editor

Requiere que ya esté aplicada la migración de
`docs/superpowers/specs/2026-08-24-loopy-familia-alta-miembros-design.md`
(columna `user_id` nullable + `pending_name`/`pending_phone`/
`member_color`).

```sql
alter table public.loop_members
  add column if not exists pending_lat double precision,
  add column if not exists pending_lng double precision;
```

**Fallback condicional — correr solo si guardar la ubicación falla con
un error de permisos** (probar primero sin esto: en teoría la policy de
UPDATE que ya deja al admin editar `pending_phone` sobre una fila con
`user_id is null` cubre estas dos columnas nuevas sin cambios, porque
RLS es por fila, no por columna):

```sql
create policy "admin can update pending member location"
  on public.loop_members
  for update
  using (
    user_id is null
    and exists (select 1 from public.loops where loops.id = loop_members.loop_id and loops.admin_id = auth.uid())
  )
  with check (
    user_id is null
    and exists (select 1 from public.loops where loops.id = loop_members.loop_id and loops.admin_id = auth.uid())
  );
```

## Qué se implementó

- `lib/types.ts`: `LoopMember.pending_lat`/`pending_lng` (nullable).
- `LoopContext.tsx` / `layout.tsx`: método nuevo y aditivo
  `setPendingMemberLocation(memberId, coords?)` — mismo patrón que
  `addZone` (`coords ?? myPos` como fallback). No se tocó ninguna firma
  existente, ni `watchPosition`, ni las suscripciones Realtime.
- `components/LocationPicker.tsx`: componente nuevo, factoriza el
  patrón "Mi ubicación actual / Elegir dirección" que ya usaba
  `zonas/page.tsx` (tercer consumidor del loader `loopy-google-maps`
  con la librería `places`).
- `app/loop/[id]/familia/page.tsx`: ícono de pin junto a cada miembro
  "Invitado" para cargar/editar su ubicación aproximada después de
  agregarlo (no en el formulario de alta inicial, ya que
  `addPendingMember` no devuelve el id insertado).
- `components/LiveMap.tsx`: `MapMember.isPending`, marcador
  semitransparente en color `bridge` (`#834c9c`) y copy distinto en el
  `InfoWindow` ("Ubicación aproximada — todavía no se unió").
- `app/loop/[id]/mapa/page.tsx`: los miembros pendientes con ubicación
  cargada se agregan al array que recibe `<LiveMap>`, sin tocar
  `mapMembers` ni la tira de avatares (que sigue exigiendo `user_id`).
- `app/loop/[id]/rutas/page.tsx`: sin cambios — un punto preliminar no
  tiene recorrido que dibujar.

## Corte al registrarse

Automático, sin código nuevo: en cuanto el trigger existente
(`link_pending_loop_members`) vincula el `user_id`, la fila deja de
matchear el filtro `!m.user_id` y el pin preliminar desaparece en el
siguiente fetch de `members`. `pending_lat`/`pending_lng` quedan como
dato muerto inofensivo — mismo criterio que `pending_name`/
`pending_phone`, que tampoco se limpian al vincular.

## Dependencia de Google Places

La opción "Elegir dirección" depende de la misma API (Places, legacy)
que ya usa Zonas — gap ya documentado en
`docs/superpowers/plans/2026-09-02-loopy-product-polish.md`. No es una
dependencia nueva.

## Verificación hecha

- `npm run build` limpio (compilación y chequeo de tipos).
- Pendiente de Sebastián: correr el SQL de arriba, y probar en la app
  real (agregar un miembro por teléfono, cargarle una ubicación con
  "Mi ubicación actual", confirmar el marcador semitransparente en
  Mapa, y confirmar que Rutas no lo muestra).
