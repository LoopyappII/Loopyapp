# Loopy: shell de navegación por tabs (Fase 0 de 5)

**Fecha:** 2026-08-24
**Estado:** aprobado para pasar a plan de implementación

## Contexto

El cliente (Looper Cashline SL) ya aceptó un mockup de la app que muestra una
experiencia tipo app nativa: navegación por pestañas inferiores fijas
(Mapa / Familia / Rutas / SOS), con pantallas dedicadas para gestión de
familia (roles, edad, con quién comparte cada uno), zonas con ícono por tipo
y última actividad, una pantalla SOS de emergencia con dirección real y
conteo de notificados, y una pestaña de Rutas con timeline histórico por
miembro. Ese mockup está documentado como capturas en
`components/GuiaDeUsoContent.tsx` / `public/images/guia-de-uso/*.png`.

La app real hoy (`app/dashboard/page.tsx`, `app/loop/[id]/page.tsx`) es una
sola página web por Loopy: el dashboard lista los Loopys del usuario con
formularios de crear/unirse, y la vista de un Loopy es un mapa + un panel
lateral (grilla de 3 columnas en desktop, apilado en mobile) con SOS,
miembros, zona nueva, historial y ajustes, todo junto y en scroll.

Este gap se decidió cerrar construyendo hacia el mockup aprobado, en 5 fases
secuenciales con punto de revisión entre cada una, para no romper nada de lo
que ya funciona en producción (mapa en vivo, Realtime de ubicación/SOS/
velocidad/zonas, auth, todo el flujo actual). Este documento cubre **solo la
Fase 0**: el shell de navegación. Las fases 1-4 (Familia, Zonas, SOS, Rutas)
tienen su propio ciclo brainstorming → spec → plan más adelante, una vez
cerrada y verificada esta.

## Objetivo de esta fase

Reorganizar la información que **ya existe y ya funciona** dentro de la
nueva arquitectura de navegación del mockup (tabs inferiores + pantallas
dedicadas), sin agregar campos de datos nuevos ni features nuevas. Es un
refactor de estructura e IA (información/navegación), no un cambio de
funcionalidad.

## No-objetivos (quedan para fases 1-4)

- Roles con relación tipo "Hija"/"Hijo", edad como parte de un perfil rico,
  permisos granulares de a quién comparte cada uno, botón "+Agregar
  miembro a la familia" → **Fase 1 (Familia)**.
- Ícono por tipo de zona, texto de última actividad relativa por zona →
  **Fase 2 (Zonas)**.
- Reverse geocoding de la ubicación en la pantalla SOS, texto "se notifica
  a N personas" → **Fase 3 (SOS)**.
- Timeline histórico real con "ver días anteriores" (hoy el historial solo
  trae eventos del día actual, sin paginar) → **Fase 4 (Rutas)**.

## Arquitectura

Rutas anidadas de Next.js App Router bajo `app/loop/[id]/`:

```
app/loop/[id]/
  layout.tsx          (nuevo) — shell compartido
  mapa/
    page.tsx           (nuevo) — mapa + ficha "Tu familia" + accesos rápidos
    zonas/
      page.tsx          (nuevo) — crear zona + lista simple de zonas
  familia/
    page.tsx           (nuevo) — lista de miembros (contenido actual, reubicado)
  rutas/
    page.tsx           (nuevo) — historial (contenido actual, reubicado)
  sos/
    page.tsx           (nuevo) — botón SOS de mantener-presionado (reubicado)
  ajustes/
    page.tsx           (nuevo) — límite de velocidad + número de emergencia
```

`app/loop/[id]/page.tsx` (870 líneas hoy, hace de todo) se elimina; su
contenido se reparte entre `layout.tsx` (estado y datos compartidos) y las
páginas de arriba (UI de cada pantalla). Esto resuelve de paso que un solo
archivo estaba concentrando demasiadas responsabilidades.

`app/dashboard/page.tsx` no se mueve de ruta, pero recibe un restyle visual
para usar el mismo lenguaje del shell (tarjetas, ancho máximo tipo teléfono
centrado en pantallas grandes). No hay mockup aprobado por el cliente para
esta pantalla puntual — el restyle es una decisión propia para mantener
consistencia visual, no un requisito contractual.

### `layout.tsx` — responsabilidades

- Valida sesión (`supabase.auth.getUser()`); redirige a `/login` si no hay
  usuario — comportamiento idéntico al actual.
- Carga una sola vez: `loop`, `members` (con `profiles`), `zones`,
  posiciones recientes (`mapMembers`), `events`, `speedAlerts`.
- Mantiene activas las 4 suscripciones Realtime que ya existen
  (`locations-${loopId}`, `sos-${loopId}`, `speed-${loopId}`,
  `zones-${loopId}`) y el `watchPosition` de geolocalización — **corren
  siempre, sin importar en qué tab esté el usuario**, para no perder una
  alerta SOS o una actualización de posición solo por estar mirando otra
  pestaña.
- Expone todo lo anterior + los handlers (`handleAddZone`,
  `handleSaveLoopSettings`, `triggerSOS`, `handleToggleRoute`, etc.) a
  través de un `LoopContext`, consumido por cada tab con un hook
  `useLoop()`.
- Renderiza el header superior (logo/vuelta + ícono de ajustes) + `{children}`
  (la pantalla activa) + la barra de tabs inferior fija.

### Navegación — detalles de UI

- **Barra de tabs inferior**, 4 destinos con los íconos que ya están
  importados en el código hoy (`MapPin` → Mapa, `Users` → Familia,
  `RouteIcon` → Rutas, `Siren` → SOS), fija en las 4 rutas de
  `app/loop/[id]/*`.
- **Header superior** en la pantalla Mapa: logo/wordmark "Loopy" a la
  izquierda (tap = volver a `/dashboard`, reemplaza al breadcrumb actual
  "← Mis Loopys") + ícono de engranaje a la derecha (abre `/ajustes`),
  igual que en el mockup. *(Detalle propuesto por mí, no viene explícito en
  las capturas — confirmar en la revisión de este spec si el tap-en-logo es
  la forma correcta de volver al listado, o si preferís mantener una flecha
  de "atrás" visible.)*
- **Zonas** no es un tab — se llega desde el botón de acceso rápido "Zonas"
  en la pantalla Mapa (`mapa/zonas`), igual que hoy se accede a crear una
  zona desde el panel lateral.
- **Ver ruta de un miembro**: tanto desde Familia como desde Rutas, tocar
  "ver recorrido" activa la ruta en el `LoopContext` y navega a `mapa` para
  dibujarla sobre el mapa — se preserva la función tal cual funciona hoy,
  solo cambia desde dónde se dispara.
- Todas las pantallas nuevas quedan protegidas por el mismo chequeo de
  sesión del layout (no se duplica por página).

## Datos

Sin cambios de schema. Se siguen leyendo las mismas tablas de Supabase
(`loops`, `loop_members`+`profiles`, `safe_zones`, `locations`,
`zone_events`, `speed_alerts`, `sos_alerts`) con las mismas queries que hoy,
movidas de `page.tsx` al `layout.tsx`.

## Manejo de errores

Sin cambios de comportamiento respecto a hoy:

- Sin sesión → redirect a `/login` (igual que hoy).
- Loopy inexistente o el usuario no es miembro → hoy queda en
  "Cargando Loopy..." indefinidamente (no hay manejo explícito). Es un gap
  preexistente; **no se corrige en esta fase** para no meter alcance
  adicional al refactor.

## Testing

Regresión manual con Playwright reutilizando la batería de pruebas del pase
de QA anterior (dos usuarios de prueba `qa.loopy1.*` / `qa.loopy2.*`),
corrida contra la nueva estructura de rutas, confirmando que no se rompió
nada:

- Login/logout, crear Loopy, unirse por código.
- Mapa en vivo: posición de ambos usuarios se actualiza vía Realtime.
- Zonas: crear zona, entrar/salir dispara banner + evento en
  `zone_events`.
- Alertas de velocidad: se dispara el banner correspondiente.
- SOS: hold de 1.2s dispara alerta, el otro usuario la recibe con banner
  rojo y `tel:` de emergencia — probar que **llega aunque el receptor esté
  en otro tab que no sea Mapa/SOS**, ya que ahora las suscripciones viven
  en el layout compartido.
- Ajustes del Loopy (admin): guardar límite de velocidad / número de
  emergencia persiste.
- Consola del navegador sin errores nuevos en cada pantalla.

## Fases futuras (fuera de este documento)

1. **Familia** — roles con relación (Hija/Hijo/Mamá/Papá/Admin), edad,
   permisos granulares de a quién comparte cada miembro, flujo
   "+Agregar miembro a la familia". Requiere columnas nuevas.
2. **Zonas** — ícono por tipo de zona, texto de última actividad relativa
   por zona.
3. **SOS** — reverse geocoding de la ubicación (requiere habilitar
   Geocoding API de Google, ya hay billing/API key de Maps activa), texto
   "se notifica a N personas".
4. **Rutas** — timeline histórico real con selector de día ("ver días
   anteriores"), hoy solo trae el día actual.

Cada una vuelve a pasar por brainstorming → spec → plan antes de tocar
código, con su propio punto de revisión.
