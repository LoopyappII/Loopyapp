"use client";

import { useEffect, useRef, useState } from "react";
import { GoogleMap, Marker, Circle, Polyline, InfoWindow, useJsApiLoader, type Libraries } from "@react-google-maps/api";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

const containerStyle = { width: "100%", height: "100%" };

const MAP_LIBRARIES: Libraries = ["places"];

// Estilo de mapa sobrio (sin POIs/transporte de fondo) acorde a la paleta de Loopy.
const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
];

function markerIcon(color: string): google.maps.Symbol {
  return {
    path: "M0,0 m -8,0 a 8,8 0 1,0 16,0 a 8,8 0 1,0 -16,0",
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 2,
    scale: 1,
  };
}

export interface MapMember {
  userId: string;
  name: string;
  lat: number;
  lng: number;
  isMe: boolean;
}

export interface MapZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
}

export interface MapRoute {
  color: string;
  points: { lat: number; lng: number }[];
}

function startMarkerIcon(color: string): google.maps.Symbol {
  return {
    path: "M0,0 m -6,0 a 6,6 0 1,0 12,0 a 6,6 0 1,0 -12,0",
    fillColor: "#ffffff",
    fillOpacity: 1,
    strokeColor: color,
    strokeWeight: 3,
    scale: 1,
  };
}

export default function LiveMap({
  members,
  zones,
  center,
  route,
}: {
  members: MapMember[];
  zones: MapZone[];
  center: [number, number];
  route?: MapRoute | null;
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: "loopy-google-maps",
    googleMapsApiKey: GOOGLE_MAPS_API_KEY || "",
    libraries: MAP_LIBRARIES,
  });
  const [openMemberId, setOpenMemberId] = useState<string | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || !route || route.points.length < 2) return;
    const bounds = new google.maps.LatLngBounds();
    route.points.forEach((p) => bounds.extend(p));
    mapRef.current.fitBounds(bounds, 60);
  }, [route]);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="h-full w-full flex items-center justify-center text-center text-sm text-loopy-700 p-6 bg-loopy-50/40">
        Falta configurar NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para mostrar el mapa
        de Google.
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-full w-full flex items-center justify-center text-center text-sm text-loopy-700 p-6 bg-loopy-50/40">
        No se pudo cargar Google Maps. Revisá la clave de API y que la Maps
        JavaScript API esté habilitada.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="h-full w-full flex items-center justify-center text-loopy-700">
        Cargando mapa...
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={{ lat: center[0], lng: center[1] }}
      zoom={14}
      onLoad={(map) => {
        mapRef.current = map;
      }}
      options={{
        styles: MAP_STYLES,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      }}
    >
      {route && route.points.length > 1 && (
        <Polyline
          path={route.points}
          options={{
            strokeColor: route.color,
            strokeOpacity: 0.85,
            strokeWeight: 4,
          }}
        />
      )}
      {route && route.points.length > 0 && (
        <Marker
          position={route.points[0]}
          icon={startMarkerIcon(route.color)}
          title="Inicio del recorrido"
        />
      )}
      {members.map((m) => (
        <Marker
          key={m.userId}
          position={{ lat: m.lat, lng: m.lng }}
          icon={markerIcon(m.isMe ? "#834c9c" : "#5b6fc4")}
          onClick={() => setOpenMemberId(m.userId)}
        >
          {openMemberId === m.userId && (
            <InfoWindow onCloseClick={() => setOpenMemberId(null)}>
              <span className="text-sm text-loopy-900">
                {m.name}
                {m.isMe ? " (vos)" : ""}
              </span>
            </InfoWindow>
          )}
        </Marker>
      ))}
      {zones.map((z) => (
        <Circle
          key={z.id}
          center={{ lat: z.lat, lng: z.lng }}
          radius={z.radius_m}
          options={{
            strokeColor: "#834c9c",
            strokeOpacity: 0.6,
            strokeWeight: 2,
            fillColor: "#834c9c",
            fillOpacity: 0.12,
          }}
        />
      ))}
    </GoogleMap>
  );
}
