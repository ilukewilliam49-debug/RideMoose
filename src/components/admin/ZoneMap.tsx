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

/** Renders the selected zone as an editable Leaflet polygon with draggable vertices */
function EditablePolygon({
  zone,
  onEdited,
}: {
  zone: GeoZone;
  onEdited: (id: string, coords: [number, number][]) => void;
}) {
  const map = useMap();
  const layerRef = useRef<L.Polygon | null>(null);

  useEffect(() => {
    const positions = zone.polygon.map(([lat, lng]) => L.latLng(lat, lng));
    const poly = L.polygon(positions, {
      color: zone.color,
      fillColor: zone.color,
      fillOpacity: 0.45,
      weight: 3,
    });

    poly.addTo(map);

    // Enable editing (leaflet-draw adds .editing to L.Polygon)
    if ((poly as any).editing) {
      (poly as any).editing.enable();
    }

    // Listen for vertex drag end
    poly.on("edit" as any, () => {
      const latlngs = poly.getLatLngs()[0] as L.LatLng[];
      const coords: [number, number][] = latlngs.map((ll) => [ll.lat, ll.lng]);
      onEdited(zone.id, coords);
    });

    layerRef.current = poly;

    return () => {
      if ((poly as any).editing) {
        (poly as any).editing.disable();
      }
      map.removeLayer(poly);
    };
  }, [map, zone.id, zone.polygon, zone.color, onEdited]);

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

export default function ZoneMap({
  geoZones,
  selectedZoneId,
  onSelectZone,
  onPolygonCreated,
  onPolygonEdited,
}: ZoneMapProps) {
  const stableOnCreated = useCallback(onPolygonCreated, []);
  const stableOnEdited = useCallback(
    (id: string, coords: [number, number][]) => onPolygonEdited?.(id, coords),
    [onPolygonEdited]
  );

  const selectedZone = geoZones.find((z) => z.id === selectedZoneId);

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
        // Skip react-leaflet Polygon for selected zone — EditablePolygon handles it
        if (zone.id === selectedZoneId) return null;
        return (
          <Polygon
            key={zone.id}
            positions={zone.polygon.map(([lat, lng]) => [lat, lng] as [number, number])}
            pathOptions={{
              color: zone.color,
              fillColor: zone.color,
              fillOpacity: 0.2,
              weight: 1.5,
            }}
            eventHandlers={{
              click: () => onSelectZone(zone.id),
            }}
          />
        );
      })}

      {selectedZone && selectedZone.polygon.length >= 3 && (
        <EditablePolygon zone={selectedZone} onEdited={stableOnEdited} />
      )}
    </MapContainer>
  );
}
