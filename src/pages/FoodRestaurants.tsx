import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { Search, MapPin, UtensilsCrossed } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const FoodRestaurants = () => {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data: restaurants, isLoading } = useQuery({
    queryKey: ["restaurants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = restaurants?.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.cuisine_type?.toLowerCase().includes(q) ||
      r.address.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 pt-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold">{t("food.restaurants")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("food.browseRestaurants")}</p>
      </motion.div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("food.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : !filtered?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <UtensilsCrossed className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>{t("food.noRestaurants")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((restaurant, i) => (
            <motion.button
              key={restaurant.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(`/rider/food/${restaurant.id}`)}
              className="glass-surface rounded-xl overflow-hidden text-left transition-all hover:scale-[1.02] hover:shadow-lg group"
            >
              {restaurant.image_url ? (
                <div className="h-32 bg-secondary overflow-hidden">
                  <img
                    src={restaurant.image_url}
                    alt={restaurant.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
              ) : (
                <div className="h-32 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <UtensilsCrossed className="h-10 w-10 text-primary/40" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-base">{restaurant.name}</h3>
                  {restaurant.cuisine_type && (
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {restaurant.cuisine_type}
                    </Badge>
                  )}
                </div>
                {restaurant.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {restaurant.description}
                  </p>
                )}
                <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{restaurant.address}</span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
};

export default FoodRestaurants;
