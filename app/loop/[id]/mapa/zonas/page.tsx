"use client";

import { useState } from "react";
import { ArrowLeft, MapPin, LocateFixed } from "lucide-react";
import Link from "next/link";
import { Autocomplete, useJsApiLoader, type Libraries } from "@react-google-maps/api";
import { useLoop } from "../../LoopContext";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const ZONAS_LIBRARIES: Libraries = ["places"];

export default function ZonasPage() {
  const { loopId, zones, addZone } = useLoop();
  const [zoneName, setZoneName] = useState("");
  const [zoneRadius, setZoneRadius] = useState(150);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [useAddress, setUseAddress] = useState(false);
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [addressLabel, setAddressLabel] = useState("");
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "loopy-google-maps",
    googleMapsApiKey: GOOGLE_MAPS_API_KEY || "",
    libraries: ZONAS_LIBRARIES,
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

  async function handleAddZone(e: React.FormEvent) {
    e.preventDefault();
    if (useAddress && !addressCoords) {
      setError("Elegí una dirección de la lista antes de crear la zona.");
      return;
    }
    setCreating(true);
    setError(null);
    const { error } = await addZone(zoneName, zoneRadius, useAddress ? addressCoords! : undefined);
    if (error) {
      setError(error);
    } else {
      setZoneName("");
      setAddressCoords(null);
      setAddressLabel("");
    }
    setCreating(false);
  }

  return (
    <div className="flex-1 p-4 space-y-4">
      <Link href={`/loop/${loopId}/mapa`} className="flex items-center gap-1 text-loopy-700 text-sm font-medium">
        <ArrowLeft size={15} />
        Mapa
      </Link>

      <form onSubmit={handleAddZone} className="bg-white rounded-xl border border-loopy-100 shadow-card md:shadow-card-hover p-4 md:p-6">
        <h2 className="font-bold text-loopy-900 mb-2 flex items-center gap-1.5">
          <MapPin size={16} className="text-bridge" />
          Nueva zona segura
        </h2>
        <p className="text-xs text-loopy-700/60 mb-3">
          Las zonas seguras no se activan solas: hay que crear al menos una para que el Loopy empiece a avisar entradas y salidas.
        </p>
        <input
          placeholder="Nombre (ej. Casa)"
          className="w-full mb-2 px-3 py-2 rounded-lg border border-loopy-50 text-sm focus:outline-none focus:ring-2 focus:ring-bridge/60"
          value={zoneName}
          onChange={(e) => setZoneName(e.target.value)}
          required
        />
        <input
          type="number"
          min={30}
          step={10}
          placeholder="Radio en metros"
          className="w-full mb-2 px-3 py-2 rounded-lg border border-loopy-50 text-sm focus:outline-none focus:ring-2 focus:ring-bridge/60"
          value={zoneRadius}
          onChange={(e) => setZoneRadius(Number(e.target.value))}
        />

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

        {useAddress && isLoaded && !loadError && (
          <Autocomplete onLoad={setAutocomplete} onPlaceChanged={handlePlaceChanged}>
            <input
              placeholder="Buscar una dirección"
              className="w-full mb-2 px-3 py-2 rounded-lg border border-loopy-50 text-sm focus:outline-none focus:ring-2 focus:ring-bridge/60"
              defaultValue={addressLabel}
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
          <p className="text-xs text-loopy-700/60 mb-3">
            {addressCoords ? "Dirección seleccionada." : "Se crea centrada en la dirección que elijas de la lista."}
          </p>
        )}
        {!useAddress && (
          <p className="text-xs text-loopy-700/60 mb-3">Se crea centrada en tu ubicación actual.</p>
        )}

        {error && <p className="text-red-600 text-xs mb-3">{error}</p>}
        <button
          type="submit"
          disabled={creating}
          className="w-full py-2 rounded-full bg-gradient-to-r from-loopy-700 via-bridge to-glow-500 text-white text-sm font-semibold shadow-cta hover:shadow-cta-hover disabled:opacity-60"
        >
          {creating ? "Creando..." : "Crear zona"}
        </button>
      </form>

      <div className="bg-white rounded-xl border border-loopy-100 shadow-card md:shadow-card-hover p-4 md:p-6">
        <h2 className="font-bold text-loopy-900 mb-2">Zonas seguras</h2>
        {zones.length === 0 ? (
          <p className="text-sm text-loopy-700/70">Todavía no hay zonas creadas.</p>
        ) : (
          <ul className="text-sm space-y-2">
            {zones.map((z) => (
              <li key={z.id} className="flex items-center justify-between text-loopy-700">
                <span className="font-medium text-loopy-900">{z.name}</span>
                <span className="text-xs text-loopy-700/60">{z.radius_m} m</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
