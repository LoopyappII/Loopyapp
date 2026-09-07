"use client";

import { useState } from "react";
import { MapPin, LocateFixed } from "lucide-react";
import { Autocomplete, useJsApiLoader } from "@react-google-maps/api";
import { MAPS_LIBRARIES } from "@/lib/googleMapsLibraries";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export interface LocationPickerProps {
  onSelect: (coords?: { lat: number; lng: number }) => void; // undefined = usar el GPS del admin
  onCancel: () => void;
  saving?: boolean;
  error?: string | null;
}

// Mismo patrón de "Mi ubicación actual / Elegir dirección" que ya usa
// app/loop/[id]/mapa/zonas/page.tsx — factorizado acá porque este es el
// tercer lugar que comparte el loader de Google Maps con id
// "loopy-google-maps" (después de LiveMap.tsx y zonas/page.tsx).
export default function LocationPicker({ onSelect, onCancel, saving, error }: LocationPickerProps) {
  const [useAddress, setUseAddress] = useState(false);
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [addressLabel, setAddressLabel] = useState("");
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "loopy-google-maps",
    googleMapsApiKey: GOOGLE_MAPS_API_KEY || "",
    libraries: MAPS_LIBRARIES,
  });

  function handlePlaceChanged() {
    if (!autocomplete) return;
    const place = autocomplete.getPlace();
    const loc = place.geometry?.location;
    if (!loc) {
      setAddressCoords(null);
      return;
    }
    setAddressCoords({ lat: loc.lat(), lng: loc.lng() });
    setAddressLabel(place.formatted_address || place.name || "");
  }

  function handleConfirm() {
    if (useAddress) {
      if (!addressCoords) return;
      onSelect(addressCoords);
    } else {
      onSelect(undefined);
    }
  }

  const confirmDisabled = saving || (useAddress && !addressCoords);

  return (
    <div className="mt-2 p-3 rounded-lg border border-loopy-100 bg-loopy-50/40">
      <div className="flex gap-2 mb-2">
        <button
          type="button"
          onClick={() => setUseAddress(false)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border ${
            !useAddress ? "bg-bridge/10 border-bridge text-bridge" : "border-loopy-100 text-loopy-700"
          }`}
        >
          <LocateFixed size={14} />
          Mi ubicación actual
        </button>
        <button
          type="button"
          onClick={() => setUseAddress(true)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border ${
            useAddress ? "bg-bridge/10 border-bridge text-bridge" : "border-loopy-100 text-loopy-700"
          }`}
        >
          <MapPin size={14} />
          Elegir dirección
        </button>
      </div>

      {/* Requiere la "Places API" (legacy) habilitada en el proyecto de Google
          Cloud del cliente — mismo gap ya documentado para Zonas, ver
          docs/superpowers/plans/2026-09-02-loopy-product-polish.md. */}
      {useAddress && isLoaded && !loadError && (
        <Autocomplete onLoad={setAutocomplete} onPlaceChanged={handlePlaceChanged}>
          <input
            placeholder="Buscar una dirección"
            className="w-full mb-2 px-3 py-2 rounded-lg border border-loopy-50 text-sm focus:outline-none focus:ring-2 focus:ring-bridge/60"
            value={addressLabel}
            onChange={(e) => {
              setAddressLabel(e.target.value);
              setAddressCoords(null);
            }}
          />
        </Autocomplete>
      )}
      {useAddress && !isLoaded && !loadError && (
        <p className="text-xs text-loopy-700/60 mb-2">Cargando buscador de direcciones...</p>
      )}
      {useAddress && loadError && (
        <p className="text-red-600 text-xs mb-2">
          No se pudo cargar el buscador de direcciones. Probá con &quot;Mi ubicación actual&quot; en su lugar.
        </p>
      )}
      {useAddress && !loadError && (
        <p className="text-xs text-loopy-700/60 mb-2">
          {addressCoords ? "Dirección seleccionada." : "Elegí una dirección de la lista."}
        </p>
      )}
      {!useAddress && (
        <p className="text-xs text-loopy-700/60 mb-2">Se guarda tu ubicación actual como punto de partida.</p>
      )}

      {error && <p className="text-red-600 text-xs mb-2">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={confirmDisabled}
          className="flex-1 py-1.5 rounded-full bg-bridge text-white text-xs font-semibold disabled:opacity-60"
        >
          {saving ? "Guardando..." : "Guardar ubicación"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-full border border-loopy-100 text-xs font-semibold text-loopy-700"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
