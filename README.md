# Loopy

PWA para compartir ubicación en tiempo real. MVP inicial según Anexo I del contrato con LOOPER CASHLINE SL.

## Stack
- Next.js 14 (App Router) + TypeScript + Tailwind
- Supabase (Auth + Postgres + Realtime)
- Google Maps (Maps JavaScript API) para el mapa
- Deploy en Vercel

## Desarrollo local

```bash
npm install
npm run dev
```

## Variables de entorno

Por defecto la app usa la URL y anon key del proyecto de Supabase hardcodeadas en `lib/supabaseClient.ts`
(son públicas por diseño, protegidas por RLS). Para producción se recomienda moverlas a variables de entorno
en Vercel:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

El mapa (`components/LiveMap.tsx`) usa Google Maps y **sí requiere** una variable de entorno propia,
tanto en local (`.env.local`) como en Vercel:

```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
```

Para obtenerla: crear/usar un proyecto en [Google Cloud Console](https://console.cloud.google.com/),
habilitar la **Maps JavaScript API** (requiere billing habilitado en el proyecto, aunque Google da una
cuota mensual gratis), generar una API key y restringirla por referrer HTTP a los dominios de la app
(`localhost:3000`, el dominio de producción, los preview de Vercel). Sin esta variable, el mapa muestra
un aviso en vez de romper la página.

## Estado del MVP

- [x] Landing
- [x] Auth (signup/login con Supabase)
- [x] Loops (modo Espejo / Supervisión), crear y unirse por código
- [x] Mapa en tiempo real (Realtime + Geolocation API)
- [x] Zonas seguras básicas (círculo) con alertas de entrada/salida
- [ ] Notificaciones push nativas (v2)
- [ ] Apps nativas iOS/Android (v2)
