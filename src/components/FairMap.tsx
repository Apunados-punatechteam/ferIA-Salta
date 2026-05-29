import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { FairMapEvent } from "../types/feria";

const feriaIcon = L.divIcon({
  className: "feria-map-pin",
  html: "<span></span>",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16],
});

function MapFocus({ selectedFair }: { selectedFair: FairMapEvent }) {
  const map = useMap();

  map.setView([selectedFair.latitude, selectedFair.longitude], 14, {
    animate: true,
  });

  return null;
}

export function FairMap({
  fairs,
  selectedFair,
  onSelectFair,
}: {
  fairs: FairMapEvent[];
  selectedFair: FairMapEvent;
  onSelectFair: (fair: FairMapEvent) => void;
}) {
  return (
    <div className="map-shell">
      <MapContainer
        center={[selectedFair.latitude, selectedFair.longitude]}
        zoom={13}
        scrollWheelZoom
        className="feria-map"
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapFocus selectedFair={selectedFair} />

        {fairs.map((fair) => (
          <Marker
            key={fair.id}
            position={[fair.latitude, fair.longitude]}
            icon={feriaIcon}
            eventHandlers={{
              click: () => onSelectFair(fair),
            }}
          >
            <Popup>
              <div className="map-popup">
                <strong>{fair.name}</strong>
                <span>{fair.address}</span>
                <button type="button" onClick={() => onSelectFair(fair)}>
                  Seleccionar
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
