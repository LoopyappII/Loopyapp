# Loopy: alta de miembros de la familia por teléfono (Fase 1 de 5, con alcance ajustado)

**Fecha:** 2026-08-24
**Estado:** aprobado para pasar a plan de implementación
**Depende de:** Fase 0 (shell de navegación por tabs), rama `feature/loopy-desktop-polish`

## Contexto

Sebastián revisó el preview de la Fase 0 y pidió un lote de mejoras antes de
producción (documentado en
[[01-Proyectos/loopy-decision-rediseno-shell-navegacion]] del vault). Se
partió en dos grupos: el Grupo 1 (layout responsive, tab Rutas con mapa,
botón SOS + segundo número, theming) ya está implementado, testeado y en PR
(#8). Este documento cubre el primer ítem del Grupo 2: que el admin del
Loopy pueda cargar un familiar directamente (nombre, teléfono, color) en
vez de depender únicamente del código de invitación compartido.

Esto reemplaza el alcance original de la "Fase 1 (Familia)" descrita en el
spec de la Fase 0 (que hablaba de roles con relación tipo "Hija"/"Hijo" y
permisos granulares de a quién comparte cada uno) — ese alcance no se pidió
en esta ronda y queda fuera; lo que sí se pidió es la alta por teléfono con
avatar/color, que es lo que cubre este documento.

## Objetivo

El admin de un Loopy agrega un familiar por nombre + teléfono (con código de
país) + color, sin necesitar que esa persona ya tenga cuenta. Cuando esa
persona se registra en Loopy con ese mismo número, queda unida al Loopy
automáticamente, con el nombre y color que el admin ya cargó.

## No-objetivos

- Roles con relación (Hija/Hijo/Mamá/Papá), edad como parte de un perfil
  rico, permisos granulares de a quién comparte cada miembro — no pedido en
  esta ronda.
- Set de íconos/ilustraciones para el avatar — se confirmó con Sebastián
  mantener el círculo-con-inicial que ya existe hoy, solo se agrega color
  elegible.
- Envío de SMS/WhatsApp al familiar invitado — el admin comparte el
  teléfono es solo el dato de vínculo, no dispara ninguna notificación
  saliente. Fuera de alcance (requeriría integrar un proveedor de SMS).
- Batería de cada miembro — es el segundo ítem del Grupo 2, spec aparte.

## Decisión de vínculo (confirmada con Sebastián)

Vínculo **automático por número de teléfono**, no por link de invitación
personalizado: se creó una fila "pendiente" en `loop_members` con el
teléfono cargado por el admin; cuando alguien se registra con ese mismo
teléfono, un trigger de Postgres la vincula sola. Sebastián confirmó
explícitamente el trade-off aceptado: si el admin carga el número con un
formato distinto al real (falta el código de país, un dígito de más/menos),
no hay vínculo automático — por eso el admin puede editar el teléfono de una
invitación pendiente después de creada, para corregir el dato sin borrar y
recrear el resto (color, nombre).

**Comportamiento deliberado, no efecto secundario**: en cuanto el teléfono
coincide, la persona queda sumada al Loopy y visible para todos sin ningún
paso de confirmación de su parte. Es el caso de uso pedido (un padre carga a
su hijo antes de que el hijo tenga cuenta), documentado acá para que quede
explícito.

## Arquitectura

### Datos — `loop_members`

```sql
alter table public.loop_members
  alter column user_id drop not null,
  add column if not exists pending_name text,
  add column if not exists pending_phone text,
  add column if not exists member_color text;
```

- `user_id` pasa a nullable: una fila "pendiente" no tiene usuario real
  todavía. Una fila ya vinculada (como todas las de hoy) sigue teniendo
  `user_id` set, sin cambios.
- `pending_name` / `pending_phone`: solo se usan mientras `user_id` es
  null. Una vez vinculada la fila, quedan como estaban (no se borran, no se
  vuelven a leer — el nombre real se lee de `profiles` como siempre).
- `member_color`: un slug (`"loopy-bridge"`, `"bridge-glow"`, etc.), no un
  hex. La paleta real vive en el frontend (`lib/memberColors.ts`, nuevo
  archivo), para poder ajustar los tonos sin tocar datos ya guardados.
  Aplica tanto a miembros pendientes como ya vinculados — hoy el color del
  círculo-avatar es fijo (glow-500 si está seleccionado en el mapa,
  loopy-500 si no); pasa a ser elegible por el admin y estable por miembro.

### Trigger de vínculo automático

Nuevo, independiente del trigger existente que ya crea la fila en
`profiles` al registrarse (no se toca ese trigger — no tengo forma de leer
su definición actual desde acá, y modificarlo a ciegas es más riesgo que
agregar uno nuevo):

```sql
create or replace function public.link_pending_loop_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.phone is not null then
    update public.loop_members
    set user_id = new.id
    where user_id is null
      and pending_phone = new.phone;
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_phone_link_pending on public.profiles;
create trigger on_profile_phone_link_pending
  after insert or update of phone on public.profiles
  for each row
  execute function public.link_pending_loop_members();
```

`security definer` es necesario porque el trigger corre en el momento en
que se crea/actualiza el perfil de OTRO usuario (el que se está
registrando), y necesita poder escribir en filas de `loop_members` que no
le pertenecen a él — es el mismo patrón que ya debe usar el trigger
existente de creación de perfil (que también escribe en una tabla a nombre
de un usuario recién creado).

### RLS — riesgo a verificar en implementación

No tengo forma de leer las políticas RLS actuales de `loop_members` desde
acá (sin acceso de introspección a ese proyecto de Supabase). Es posible
que la política de INSERT actual asuma `user_id = auth.uid()` (que el que
inserta se inserta a sí mismo) — si es así, un admin insertando una fila
pendiente con `user_id null` fallaría por RLS. **Esto se verifica y, si
hace falta, se ajusta la política durante la implementación** (task
dedicada en el plan), no se puede confirmar de antemano sin acceso directo
a la base.

### UI — Familia

- Botón "+ Agregar miembro" (`isAdmin` únicamente, mismo patrón de gate que
  ya existe en Ajustes) abre un formulario inline en la misma tab:
  - Nombre (texto).
  - Teléfono — reutiliza el mismo componente `PhoneInput` de
    `react-phone-number-input` que ya usa `app/signup/page.tsx`, para
    garantizar el mismo formato E.164 que va a comparar el trigger.
  - Color — fila de 6 círculos tocables, paleta fija (ver abajo), default
    el primero.
  - Rol — mismo criterio que el alta por código hoy
    (`app/dashboard/page.tsx:105`): en un Loopy Modo Espejo el rol es
    siempre `"member"`, sin selector. En Modo Supervisión se reusa el
    mismo selector de rol que ya existe en el flujo de unirse por código.
  - Submit → `addPendingMember(name, phone, color, role)`, nuevo método de
    `LoopContext`, hace el insert y refresca `members`.
- Lista de miembros: una fila pendiente se ve igual que una vinculada
  (círculo de color + nombre) pero con una etiqueta "Invitado" y sin el
  botón de "ver recorrido" (no tiene ubicación). El admin ve además un ✏️
  para editar el teléfono y un ✕ para cancelar la invitación (borra la
  fila).
- Mapa y Rutas (que dependen de ubicación en vivo): sus tiras de miembros
  se filtran a `members.filter(m => m.user_id)` — un pendiente no aparece
  ahí, no tiene sentido mostrarlo hasta que se una de verdad.

### Paleta de color (`lib/memberColors.ts`, nuevo)

6 degradés fijos, armados solo con tonos ya definidos en
`tailwind.config` (nada nuevo):

| slug | degradé |
|---|---|
| `loopy-bridge` | `#3d4a8a → #834c9c` |
| `bridge-glow` | `#834c9c → #ec6fc9` |
| `loopy-glow` | `#5b6fc4 → #ec6fc9` |
| `glow-soft` | `#c94fae → #f6b8e8` |
| `loopy-deep` | `#232a52 → #4b58a8` |
| `bridge-soft` | `#6d3f83 → #a06bb8` |

Se aplican como `background: linear-gradient(135deg, <c1>, <c2>)` inline,
mismo patrón que ya usa el círculo-avatar hoy (`style={{backgroundColor}}`
en `mapa/page.tsx`), solo que ahora es un degradé fijo por miembro en vez
de un color condicional según selección.

## Manejo de errores

- Admin intenta agregar un teléfono que ya es miembro (pendiente o
  vinculado) de este Loopy → error claro, no se crea duplicado.
- Admin no completa el teléfono → submit deshabilitado (mismo patrón que
  el resto de los formularios de la app).
- El trigger de vínculo no encuentra coincidencia → no pasa nada, la fila
  sigue pendiente indefinidamente hasta que alguien se registre con ese
  teléfono o el admin la cancele.

## Testing

Se extiende `e2e/loop-nav-shell.spec.ts` (o un spec nuevo en el mismo
archivo, a decidir en el plan) con el caso completo: usuario admin crea un
Loopy, agrega un miembro pendiente por teléfono con
`qa.loopy3.<timestamp>@mailinator.com`'s número, un segundo browser
context hace signup real con ESE mismo teléfono, y se confirma que aparece
vinculado (sin la etiqueta "Invitado", con el nombre real de perfil) sin
ninguna acción manual de unión. Cubre además: edición de teléfono de una
invitación pendiente, cancelación de una invitación, y que un pendiente no
aparece en las tiras de Mapa/Rutas.

## Impacto

- [[01-Proyectos/loopy]]
- Requiere que el usuario corra la migración SQL de arriba (columnas +
  trigger) en el Supabase Dashboard antes de que el código de esta fase
  pueda desplegarse — mismo patrón que la columna de `primary_contact_number`
  del Grupo 1.
- Batería de cada miembro (segundo ítem del Grupo 2) queda para su propio
  spec, después de cerrar este.
