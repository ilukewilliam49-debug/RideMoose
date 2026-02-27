import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Prediction {
  description: string;
  place_id: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string, lat?: number, lng?: number) => void;
  placeholder?: string;
  iconColor?: string;
}

const AddressAutocomplete = ({ value, onChange, placeholder, iconColor = "text-primary" }: AddressAutocompleteProps) => {
  const [suggestions, setSuggestions] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 3) { setSuggestions([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("places-autocomplete", {
        body: { input: q },
      });
      if (error) throw error;
      const predictions: Prediction[] = data?.predictions || [];
      setSuggestions(predictions);
      setOpen(predictions.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (text: string) => {
    onChange(text);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(text), 400);
  };

  const handleSelect = async (prediction: Prediction) => {
    setOpen(false);
    setSuggestions([]);
    onChange(prediction.description);

    try {
      const { data, error } = await supabase.functions.invoke("place-details", {
        body: { place_id: prediction.place_id },
      });
      if (error) throw error;
      if (data?.lat && data?.lng) {
        const shortName = data.name || prediction.description.split(",").slice(0, 2).join(",").trim();
        onChange(shortName, data.lat, data.lng);
      }
    } catch {
      setSuggestions([]);
    }
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
      {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        className="pl-10 bg-secondary"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 rounded-md border border-border bg-popover shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((s) => (
            <button
              key={s.place_id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors truncate"
              onClick={() => handleSelect(s)}
            >
              {s.description}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
