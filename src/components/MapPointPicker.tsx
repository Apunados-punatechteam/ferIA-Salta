import { useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMapEvents,
} from "react-leaflet";

type MapPointPickerProps = {
  latitude: number;
  longitude: number;
  onChange: (point: { latitude: number; longitude: number }) => void;
};

function ClickHandler({
  onChange,
}: {
  onChange: (point: { latitude: number; longitude: number }) => void;
}) {
  useMapEvents({
    click(event) {
      onChange({
        latitude: Number(event.latlng.lat.toFixed(6)),
        longitude: Number(event.latlng.lng.toFixed(6)),
      });
    },
  });

  return null;
}

export function MapPointPicker({
  latitude,
  longitude,
  onChange,
}: MapPointPickerProps) {
  const markerIcon = useMemo(() => {
    return L.divIcon({
      className: "feria-map-marker",
      html: '<span></span>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  }, []);

  const center: [number, number] = [latitude, longitude];

  return (
    <div className="map-picker">
      <div className="map-picker__header">
        <div>
          <strong>Ubicación exacta de la feria</strong>
          <span>Hacé clic en el mapa para mover el punto.</span>
        </div>
        <div className="map-picker__coords">
          {latitude.toFixed(6)}, {longitude.toFixed(6)}
        </div>
      </div>

      <MapContainer
        center={center}
        zoom={15}
        scrollWheelZoom
        className="map-picker__map"
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <ClickHandler onChange={onChange} />

        <Marker position={center} icon={markerIcon}>
          <Popup>
            Punto seleccionado para la feria.
            <br />
            {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}