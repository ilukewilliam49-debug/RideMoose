import { Home, Briefcase, MapPin } from "lucide-react";
import type { SavedPlace } from "@/types/rider";

interface SavedPlaceChipsProps {
  places: SavedPlace[];
  selectedAddress: string;
  onSelect: (address: string, lat: number, lng: number) => void;
}

const iconMap: Record<string, typeof MapPin> = {
  home: Home,
  work: Briefcase,
  briefcase: Briefcase,
};

export default function SavedPlaceChips({ places, selectedAddress, onSelect }: SavedPlaceChipsProps) {
  if (!places.length) return null;

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {places.map((place) => {
        const IconComp = iconMap[place.icon] ?? MapPin;
        return (
          <button
            key={place.id}
            type="button"
            onClick={async () => {
              try {
                const res = await fetch(
                  `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place.address)}&format=json&limit=1`
                );
                const results = await res.json();
                if (results?.[0]) {
                  onSelect(place.address, parseFloat(results[0].lat), parseFloat(results[0].lon));
                }
              } catch {
                // Fallback: set address without coords
                onSelect(place.address, 0, 0);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-all ${
              selectedAddress === place.address
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-secondary text-muted-foreground hover:bg-accent"
            }`}
          >
            <IconComp className="h-3 w-3" />
            {place.label}
          </button>
        );
      })}
    </div>
  );
}
