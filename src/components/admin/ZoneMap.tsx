import { useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Polygon, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";

interface GeoZone {
  id: string;
  zone_key: string;
  zone_name: string;
  polygon: [number, number][];
  color: string;
}

interface ZoneMapProps {
  geoZones: GeoZone[];
  selectedZoneId: string | null;
  onSelectZone: (id: string) => void;
  onPolygonCreated: (coords: [number, number][]) => void;
  onPolygonEdited?: (id: string, coords: [number, number][]) => void;
}

const YELLOWKNIFE_CENTER: [number, number] = [62.454, -114.372];

function DrawControl({ onPolygonCreated }: { onPolygonCreated: (coords: [number, number][]) => void }) {
  const map = useMap();
  const drawControlRef = useRef<L.Control.Draw | null>(null);

  useEffect(() => {
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
      position: "topright",
      draw: {
        polygon: {
          allowIntersection: false,
          shapeOptions: { color: "#3b82f6", weight: 2 },
        },
        polyline: false,
        circle: false,
        rectangle: false,
        marker: false,
        circlemarker: false,
      },
      edit: { featureGroup: drawnItems, remove: false, edit: false },
    });

    map.addControl(drawControl);
    drawControlRef.current = drawControl;

    map.on(L.Draw.Event.CREATED, (e: any) => {
      const layer = e.layer;
      const latlngs = layer.getLatLngs()[0] as L.LatLng[];
      const coords: [number, number][] = latlngs.map((ll) => [ll.lat, ll.lng]);
      onPolygonCreated(coords);
    });

    return () => {
      map.removeControl(drawControl);
      map.removeLayer(drawnItems);
    };
  }, [map, onPolygonCreated]);

  return null;
}

function FitBounds({ geoZones }: { geoZones: GeoZone[] }) {
  const map = useMap();

  useEffect(() => {
    if (geoZones.length === 0) return;
    const allCoords = geoZones.flatMap((z) => z.polygon);
    if (allCoords.length === 0) return;
    const bounds = L.latLngBounds(allCoords.map(([lat, lng]) => [lat, lng] as [number, number]));
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
  }, [geoZones, map]);

  return null;
}

export default function ZoneMap({ geoZones, selectedZoneId, onSelectZone, onPolygonCreated }: ZoneMapProps) {
  const stableOnCreated = useCallback(onPolygonCreated, []);

  return (
    <MapContainer
      center={YELLOWKNIFE_CENTER}
      zoom={12}
      className="h-full w-full rounded-lg"
      style={{ minHeight: 400 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      <FitBounds geoZones={geoZones} />
      <DrawControl onPolygonCreated={stableOnCreated} />

      {geoZones.map((zone) => {
        if (!zone.polygon || zone.polygon.length < 3) return null;
        const isSelected = zone.id === selectedZoneId;
        return (
          <Polygon
            key={zone.id}
            positions={zone.polygon.map(([lat, lng]) => [lat, lng] as [number, number])}
            pathOptions={{
              color: zone.color,
              fillColor: zone.color,
              fillOpacity: isSelected ? 0.45 : 0.2,
              weight: isSelected ? 3 : 1.5,
            }}
            eventHandlers={{
              click: () => onSelectZone(zone.id),
            }}
          >
          </Polygon>
        );
      })}
    </MapContainer>
  );
}
