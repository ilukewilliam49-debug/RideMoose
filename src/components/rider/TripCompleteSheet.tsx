import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Star, MapPin } from "lucide-react";
import RideReceipt from "@/components/rider/RideReceipt";
import type { Ride } from "@/types/rider";

interface TripCompleteSheetProps {
  ride: Ride;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRate: () => void;
}

export default function TripCompleteSheet({ ride, open, onOpenChange, onRate }: TripCompleteSheetProps) {
  const { t } = useTranslation();

  const { data: driverProfile } = useQuery({
    queryKey: ["trip-complete-driver", ride.driver_id],
    queryFn: async () => {
      if (!ride.driver_id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, vehicle_make, vehicle_model, vehicle_color, vehicle_year, license_plate")
        .eq("id", ride.driver_id)
        .single();
      return data;
    },
    enabled: !!ride.driver_id && open,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl px-5 pb-8">
        <SheetHeader className="pb-3">
          <SheetTitle className="text-center text-lg">
            {t("rider.tripComplete", "Trip Complete")} 🎉
          </SheetTitle>
        </SheetHeader>

        {/* Route summary */}
        <div className="space-y-2 mb-4">
          <div className="flex items-start gap-2 text-sm">
            <div className="mt-1 h-2.5 w-2.5 rounded-full bg-green-500 shrink-0" />
            <span className="text-muted-foreground truncate">{ride.pickup_address}</span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
            <span className="text-muted-foreground truncate">{ride.dropoff_address}</span>
          </div>
        </div>

        {/* Receipt */}
        <RideReceipt
          ride={ride}
          driverName={driverProfile?.full_name}
          vehicleMake={driverProfile?.vehicle_make}
          vehicleModel={driverProfile?.vehicle_model}
          vehicleYear={driverProfile?.vehicle_year}
          vehicleColor={driverProfile?.vehicle_color}
          licensePlate={driverProfile?.license_plate}
        />

        {/* Rate button */}
        <Button
          className="w-full mt-4 gap-2"
          onClick={() => {
            onRate();
            onOpenChange(false);
          }}
        >
          <Star className="h-4 w-4" />
          {t("rider.rateYourTrip", "Rate Your Trip")}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
