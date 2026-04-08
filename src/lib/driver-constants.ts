import {
  Car,
  Bus,
  Briefcase,
  Package,
  Truck,
  Store,
  ShoppingCart,
  UtensilsCrossed,
  PawPrint,
} from "lucide-react";

export const serviceLabels: Record<string, string> = {
  taxi: "Taxi",
  private_hire: "PickYou",
  shuttle: "Shuttle",
  courier: "Courier",
  large_delivery: "Large Delivery",
  retail_delivery: "Retail Delivery",
  personal_shopper: "Personal Shopper",
  food_delivery: "Food Delivery",
  pet_transport: "Pet Transport",
};

export const serviceIcons: Record<string, any> = {
  shuttle: Bus,
  private_hire: Briefcase,
  courier: Package,
  large_delivery: Truck,
  retail_delivery: Store,
  personal_shopper: ShoppingCart,
  food_delivery: UtensilsCrossed,
  pet_transport: PawPrint,
};

export const getServiceIcon = (type: string) => serviceIcons[type] || Car;

export const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export const isDeliveryType = (type: string) =>
  ["courier", "large_delivery", "retail_delivery", "personal_shopper", "food_delivery", "pet_transport"].includes(type);

export const isAirportTrip = (ride: any): boolean => {
  const keywords = ["airport", "keflavík", "keflavik", "terminal", "arrivals", "departures", "flugvöllur"];
  const combined = `${ride.pickup_address || ""} ${ride.dropoff_address || ""}`.toLowerCase();
  return keywords.some((k) => combined.includes(k));
};
