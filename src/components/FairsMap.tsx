import { useEffect } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { PublicFairSummary } from "../services/backendApi";

type FairsMapProps = {
  fairs: PublicFairSummary[];
  selectedFairKey: string | null;
  onSelectFair: (fairKey: string) => void;
};

function MapAutoFit(props: { fairs: PublicFairSummary[]; selectedFairKey: string | null }) {
  const map = useMap();

  useEffect(() => {
    const fairWithCoords = props.fairs.filter(
      (fair) => typeof fair.latitude === "number" && typeof fair.longitude === "number"
    );

    if (fairWithCoords.length === 0) {
      map.setView([-24.782127, -65.423198], 12);
      return;
    }

    const selected = fairWithCoords.find((fair) => fair.fairKey === props.selectedFairKey);

    if (selected && selected.latitude !== null && selected.longitude !== null) {
      map.setView([selected.latitude, selected.longitude], 14);
      return;
    }

    const bounds = fairWithCoords.map((fair) => [fair.latitude as number, fair.longitude as number]) as [number, number][];
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, props.fairs, props.selectedFairKey]);

  return null;
}

export function FairsMap(props: FairsMapProps) {
  const fairsWithCoords = props.fairs.filter(
    (fair) => typeof fair.latitude === "number" && typeof fair.longitude === "number"
  );

  return (
    <div className="landing-map">
      <MapContainer
        center={[-24.782127, -65.423198]}
        zoom={12}
        scrollWheelZoom={true}
        style={{ height: "420px", width: "100%", borderRadius: "20px" }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapAutoFit fairs={fairsWithCoords} selectedFairKey={props.selectedFairKey} />

        {fairsWithCoords.map((fair) => {
          const isSelected = fair.fairKey === props.selectedFairKey;

          return (
            <CircleMarker
              key={fair.fairKey}
              center={[fair.latitude as number, fair.longitude as number]}
              radius={isSelected ? 12 : 9}
              pathOptions={{
                color: isSelected ? "#ef476f" : "#1dd3b0",
                fillColor: isSelected ? "#ef476f" : "#1dd3b0",
                fillOpacity: 0.9,
              }}
              eventHandlers={{
                click: () => props.onSelectFair(fair.fairKey),
              }}
            >
              <Popup>
                <strong>{fair.fairName}</strong>
                <br />
                {fair.locationName || fair.address || "Ubicación sin detalle"}
                <br />
                Emprendedores: {fair.registeredCount}
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
