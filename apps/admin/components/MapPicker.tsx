"use client";

import { useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// react-leaflet's default marker image resolution breaks under webpack/
// Next's bundler (it references package-relative paths that don't survive
// bundling) — the documented fix is pointing the default icon at hosted
// copies of the same images instead of the bundled ones.
const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * Free pin-drop location picker (OpenStreetMap tiles via Leaflet — no API
 * key/billing, per the "no Google Maps key yet" call in
 * docs/blueprint.html). Stores real lat/lng on `shops.lat`/`shops.lng`;
 * swapping the TileLayer for Google's is a one-file change later if a
 * Google Maps key gets added.
 */
export function MapPicker({
  lat,
  lng,
  onChange,
}: {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
}) {
  const [position, setPosition] = useState<[number, number]>([lat, lng]);

  function handlePick(newLat: number, newLng: number) {
    setPosition([newLat, newLng]);
    onChange(newLat, newLng);
  }

  return (
    <div className="overflow-hidden rounded-md border border-neutral-300">
      <MapContainer center={position} zoom={13} style={{ height: 260, width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker
          position={position}
          icon={markerIcon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const marker = e.target as L.Marker;
              const pos = marker.getLatLng();
              handlePick(pos.lat, pos.lng);
            },
          }}
        />
        <ClickToPlace onPick={handlePick} />
      </MapContainer>
      <div className="flex items-center justify-between bg-neutral-50 px-3 py-1.5 text-xs text-neutral-500">
        <span>Click or drag the pin to set the exact location</span>
        <span className="font-mono">
          {position[0].toFixed(5)}, {position[1].toFixed(5)}
        </span>
      </div>
    </div>
  );
}
