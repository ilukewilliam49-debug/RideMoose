import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCart, type CartItem } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  MapPin,
  Plus,
  Minus,
  ShoppingBag,
  Trash2,
  UtensilsCrossed,
  Loader2,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import AddressAutocomplete from "@/components/map/AddressAutocomplete";

const FoodMenu = () => {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { t } = useTranslation();
  const cart = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [dropoff, setDropoff] = useState("");
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [ordering, setOrdering] = useState(false);

  const { data: restaurant, isLoading: loadingRestaurant } = useQuery({
    queryKey: ["restaurant", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", restaurantId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!restaurantId,
  });

  const { data: categories } = useQuery({
    queryKey: ["menu-categories", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_categories")
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!restaurantId,
  });

  const { data: menuItems } = useQuery({
    queryKey: ["menu-items", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .eq("is_available", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!restaurantId,
  });

  const filteredItems = useMemo(() => {
    if (!menuItems) return [];
    if (!activeCategory) return menuItems;
    return menuItems.filter((item) => item.category_id === activeCategory);
  }, [menuItems, activeCategory]);

  const getCartQty = (menuItemId: string) =>
    cart.items.find((i) => i.menuItemId === menuItemId)?.quantity || 0;

  const handlePlaceOrder = async () => {
    if (!profile?.id || !restaurant || !dropoff || cart.items.length === 0) return;
    setOrdering(true);
    try {
      // Create the ride (food delivery order)
      const { data: ride, error: rideError } = await supabase
        .from("rides")
        .insert({
          rider_id: profile.id,
          service_type: "food_delivery" as any,
          pickup_address: restaurant.address,
          pickup_lat: restaurant.latitude,
          pickup_lng: restaurant.longitude,
          dropoff_address: dropoff,
          dropoff_lat: dropoffCoords?.lat,
          dropoff_lng: dropoffCoords?.lng,
          restaurant_id: restaurant.id,
          order_value_cents: cart.totalCents,
          payment_option: "in_app",
          status: "requested" as any,
        })
        .select("id")
        .single();

      if (rideError) throw rideError;

      // Insert food order items
      const orderItems = cart.items.map((item) => ({
        ride_id: ride.id,
        menu_item_id: item.menuItemId,
        item_name: item.name,
        unit_price_cents: item.priceCents,
        quantity: item.quantity,
        special_instructions: item.specialInstructions || null,
      }));

      const { error: itemsError } = await supabase
        .from("food_order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      toast.success(t("food.orderPlaced"));
      cart.clearCart();
      navigate("/rider/rides");
    } catch (err: any) {
      toast.error(err.message || "Failed to place order");
    } finally {
      setOrdering(false);
    }
  };

  if (loadingRestaurant) {
    return (
      <div className="space-y-4 pt-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Restaurant not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/rider/food")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{restaurant.name}</h1>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{restaurant.address}</span>
          </div>
        </div>
        {restaurant.cuisine_type && (
          <Badge variant="secondary">{restaurant.cuisine_type}</Badge>
        )}
      </div>

      {restaurant.description && (
        <p className="text-sm text-muted-foreground">{restaurant.description}</p>
      )}

      {/* Category tabs */}
      {categories && categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          <button
            onClick={() => setActiveCategory(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              !activeCategory
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            {t("food.all")}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeCategory === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Menu items */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <UtensilsCrossed className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{t("food.noItems")}</p>
          </div>
        ) : (
          filteredItems.map((item, i) => {
            const qty = getCartQty(item.id);
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="glass-surface rounded-lg p-4 flex gap-4"
              >
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-20 h-20 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <UtensilsCrossed className="h-6 w-6 text-muted-foreground/30" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm">{item.name}</h4>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  <p className="text-sm font-mono font-semibold text-primary mt-1">
                    ${(item.price_cents / 100).toFixed(2)}
                  </p>
                </div>
                <div className="flex flex-col items-center justify-center gap-1 shrink-0">
                  {qty > 0 ? (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => cart.updateQuantity(item.id, qty - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm font-mono w-5 text-center">{qty}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => cart.updateQuantity(item.id, qty + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() =>
                        cart.addItem({
                          menuItemId: item.id,
                          name: item.name,
                          priceCents: item.price_cents,
                        })
                      }
                    >
                      <Plus className="h-3 w-3" />
                      {t("food.add")}
                    </Button>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Floating cart button */}
      <AnimatePresence>
        {cart.totalItems > 0 && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-md"
          >
            <Button
              className="w-full gap-3 h-14 text-base shadow-lg glow-gold"
              onClick={() => setCartOpen(true)}
            >
              <ShoppingBag className="h-5 w-5" />
              <span className="flex-1 text-left">
                {t("food.viewCart")} ({cart.totalItems})
              </span>
              <span className="font-mono font-bold">
                ${(cart.totalCents / 100).toFixed(2)}
              </span>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart Drawer */}
      <Drawer open={cartOpen} onOpenChange={setCartOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="flex items-center justify-between">
            <DrawerTitle>{t("food.yourOrder")}</DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </DrawerHeader>

          <div className="px-4 space-y-4 overflow-y-auto flex-1">
            {cart.items.map((item) => (
              <div key={item.menuItemId} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    ${(item.priceCents / 100).toFixed(2)} × {item.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => cart.updateQuantity(item.menuItemId, item.quantity - 1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="text-sm font-mono w-5 text-center">{item.quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => cart.updateQuantity(item.menuItemId, item.quantity + 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => cart.removeItem(item.menuItemId)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}

            {/* Delivery address */}
            <div className="pt-3 border-t border-border space-y-2">
              <label className="text-sm font-medium">{t("food.deliveryAddress")}</label>
              <AddressAutocomplete
                value={dropoff}
                onChange={(addr, lat, lng) => {
                  setDropoff(addr);
                  if (lat && lng) setDropoffCoords({ lat, lng });
                }}
                placeholder={t("food.enterDeliveryAddress")}
              />
            </div>

            {/* Total */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <span className="font-medium">{t("food.subtotal")}</span>
              <span className="font-mono font-bold text-primary">
                ${(cart.totalCents / 100).toFixed(2)}
              </span>
            </div>
          </div>

          <DrawerFooter>
            <Button
              className="w-full h-12 gap-2"
              disabled={!dropoff || cart.items.length === 0 || ordering}
              onClick={handlePlaceOrder}
            >
              {ordering ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("food.placing")}
                </>
              ) : (
                t("food.placeOrder")
              )}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default FoodMenu;
