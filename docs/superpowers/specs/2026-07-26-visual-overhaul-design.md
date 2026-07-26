# Loopy — Overhaul visual y de animaciones

Fecha: 2026-07-26

## Contexto

Loopy es una PWA de ubicación compartida (Next.js 14 App Router + Tailwind + Supabase + Leaflet) para LOOPER CASHLINE SL. El sitio funciona pero se siente "de plantilla": todo aparece estático (sin animaciones), el hero de la landing es solo texto centrado, las feature cards usan un puntito de color como ícono placeholder, y la paleta actual es muy dominante en rosa (sombras rosas en cada card/botón, blobs de fondo todos rosas). El cliente pidió expresamente: más animaciones, más profesionalismo, y rebalancear la paleta hacia una mezcla azul/rosa (hoy es "muy pink"), con fondo blanco puro y el logo de marca de agua de fondo, sin sombras rosas.

## Alcance

Todo el sitio: landing, login, signup, dashboard, vista de un Loop, páginas legales (privacidad/términos) y el widget de soporte. Se suma además un campo de teléfono (opcional) al registro.

## Sistema de color

- Fondo: blanco puro (`#ffffff`) en toda la app, con el logo de Loopy como marca de agua muy sutil (ya existe el asset, se vuelve global en vez de solo-landing).
- Nuevo color puente: `bridge` = `#834c9c` (mezcla matemática entre `loopy-700` #3d4a8a y `glow-600` #c94fae). Es el color que hace que azul y rosa se sientan una sola paleta en vez de dos colores pegados uno al lado del otro.
- Degradé de marca (CTAs, texto destacado): `loopy-700 → bridge → glow-500` (tres paradas, azul-violeta-rosa).
- Blobs decorativos de fondo: dos, no tres — uno azul (`loopy-500`) y uno violeta (`bridge`), ambos muy sutiles. Se retira el set actual de 3 blobs 100% rosa.
- Sombras: se elimina el rosa (`rgba(236,111,201,…)`) de todas las cards. Las cards pasan a una sombra neutra azul-marino muy suave (`rgba(35,42,82,0.10)` en reposo). Los botones CTA principales conservan un glow de color, pero con el tono puente (`rgba(131,76,156,0.35)`), no rosa puro.
- Badges/acentos puntuales: usan el tono puente en vez de rosa puro.

## Tipografía e iconografía

- Fuente: Plus Jakarta Sans vía `next/font/google` (auto-hosted, sin flash de fuente), reemplaza el stack por defecto de Tailwind.
- Íconos: se reemplazan los puntitos de color placeholder y el emoji 💬 por `lucide-react` en toda la app (nav, feature cards, dashboard, loop, chat).

## Sistema de animación

- Librería: `framer-motion`.
- Personalidad: "confiable y fluido" — transiciones suaves (ease-out), sin rebotes exagerados. Los micro-interacciones de botones/marcadores pueden usar un spring sutil.
- Se respeta `prefers-reduced-motion`: las animaciones grandes/en loop (bob del hero, parallax) se desactivan; las transiciones chicas de hover/tap quedan (no son molestas y son estándar).
- Variantes reusables centralizadas en `lib/motion.ts` (fade+slide de entrada, contenedor con stagger) para no repetir configuración en cada página.

## Fondo global compartido

Hoy cada una de las 7 páginas repite manualmente los mismos 3 divs de blobs + el watermark. Se extrae a un componente único `components/BackgroundDecor.tsx`, montado una sola vez en `app/layout.tsx` (fixed, detrás de todo el contenido). Esto garantiza que el fondo blanco + logo + blobs sea *consistente* en todo el sitio en vez de copiado a mano página por página, y es el lugar natural para aplicar el pedido del cliente de que el logo de fondo sea un elemento constante del sitio, no solo de la landing.

## Página por página

- **Landing** (`components/MagnifierLanding.tsx`): hero pasa de una columna centrada a dos columnas en desktop — texto a la izquierda, `HeroPreviewCard` (nuevo componente) a la derecha. `HeroPreviewCard` es una tarjeta con un "mini mapa" estilizado (CSS/SVG, no un mapa real) con 2-3 avatares con el pulso (`pulseRing`, ya existe en Tailwind) y una animación de flotado suave (desactivada bajo reduced-motion). En mobile se apila. Entrada escalonada del badge → título → CTA. Feature cards con `whileInView` + stagger, íconos lucide reales. Navbar `sticky` con `backdrop-blur` permanente (sin listener de scroll, más simple y ya da la sensación "glass").
- **Login / Signup**: tarjeta con entrada suave, focus ring en el tono puente, botón con micro-interacción de presión. Signup suma el campo **Teléfono (opcional)** y lo manda como `options.data.phone` en el `signUp` (ya persiste en `profiles.phone` gracias a la migración de Supabase). Estado "¡Cuenta creada!" con ícono de check animado.
- **Dashboard**: loading state pasa de texto plano a skeletons animados (nuevo `components/Skeleton.tsx`). Lista de Loops con stagger al montar. Mismo sistema de color/sombra/íconos que el resto.
- **Vista de un Loop**: el banner de "entraste/saliste de zona" pasa a `AnimatePresence` (entra/sale animado en vez de aparecer seco). Lista de eventos con stagger. Se usan íconos lucide para entrar/salir de zona y volver atrás. **Fuera de alcance**: animar el movimiento del marcador en el mapa de Leaflet — requiere tocar internals de Leaflet/plugins adicionales y el riesgo de romper la función principal (mapa en vivo) no vale la pena frente al beneficio cosmético; se deja para una iteración aparte si se quiere más adelante.
- **Privacidad / Términos**: mismo sistema de fondo/color/sombra por consistencia, sin cambios de contenido legal.
- **Chat de soporte**: ícono real (`MessageCircle`/`X`/`Send` de lucide) en vez de emoji, apertura/cierre animados con `AnimatePresence`.

## Base de datos

Ya aplicado (migración `add_phone_to_profiles` en el proyecto Supabase `xumacwfsabojqefhaozm`): columna `phone` (text, nullable) en `public.profiles`, y el trigger `handle_new_user()` actualizado para copiar `phone` desde los metadatos del usuario al crear la cuenta.

## Fuera de alcance

- Rediseño de la lógica de producto (modos Espejo/Supervisión, zonas seguras, etc.) — no cambia.
- Animación del marcador en tiempo real dentro de Leaflet (ver nota en "Vista de un Loop").
- Verificación real del teléfono (SMS/OTP) — por ahora es solo un dato que se guarda, sin validar formato más allá de lo básico del input `tel`.
