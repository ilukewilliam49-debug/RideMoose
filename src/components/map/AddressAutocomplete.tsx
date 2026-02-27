import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface GeoResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string, lat?: number, lng?: number) => void;
  placeholder?: string;
  iconColor?: string;
}

const AddressAutocomplete = ({ value, onChange, placeholder, iconColor = "text-primary" }: AddressAutocompleteProps) => {
  const [suggestions, setSuggestions] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 3) { setSuggestions([]); return; }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&countrycodes=ca&viewbox=-136.5,60.0,-102.0,72.0&bounded=1`,
        { headers: { "Accept-Language": "en" } }
      );
      const data: GeoResult[] = await res.json();
      setSuggestions(data);
      setOpen(data.length > 0);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handleChange = (text: string) => {
    onChange(text);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(text), 400);
  };

  const handleSelect = (result: GeoResult) => {
    const shortName = result.display_name.split(",").slice(0, 3).join(",").trim();
    onChange(shortName, parseFloat(result.lat), parseFloat(result.lon));
    setOpen(false);
    setSuggestions([]);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <MapPin className={cn("absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4", iconColor)} />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        className="pl-10 bg-secondary"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 rounded-md border border-border bg-popover shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors truncate"
              onClick={() => handleSelect(s)}
            >
              {s.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
