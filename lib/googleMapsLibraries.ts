import type { Libraries } from "@react-google-maps/api";

// Ambos useJsApiLoader() de la app (LiveMap.tsx, la pantalla de zonas)
// comparten un único script de Google Maps cacheado por `id:
// "loopy-google-maps"` — si alguna vez declaran `libraries` distinto, el
// loader tira un error duro en vez de un warning. Una sola fuente evita
// que se desincronicen.
export const MAPS_LIBRARIES: Libraries = ["places"];
