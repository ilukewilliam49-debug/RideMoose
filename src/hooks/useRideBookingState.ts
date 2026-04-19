import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { decodeStopsParam, type RideStop } from "@/types/stops";

export type ServiceType = "taxi" | "private_hire" | "courier" | "large_delivery" | "retail_delivery" | "personal_shopper";

export const useRideBookingState = () => {
  const [searchParams] = useSearchParams();
  const serviceParam = searchParams.get("service");

  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [stops, setStops] = useState<RideStop[]>(() => decodeStopsParam(searchParams.get("stops")));
  const [loading, setLoading] = useState(false);
  const [serviceType, setServiceType] = useState<ServiceType>(
    serviceParam === "private_hire" ? "private_hire" : serviceParam === "courier" ? "courier" : "taxi"
  );
  const mode = serviceType === "courier" ? "delivery" : "rides";
  const [paymentOption, setPaymentOption] = useState<"in_app">("in_app");
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const [authorizedAmountCents, setAuthorizedAmountCents] = useState(0);
  const [pendingRideId, setPendingRideId] = useState<string | null>(null);
  const [passengerCount, setPassengerCount] = useState(1);
  const [billToOrg, setBillToOrg] = useState(false);
  const [poNumber, setPoNumber] = useState("");
  const [costCenter, setCostCenter] = useState("");
  const [packageSize, setPackageSize] = useState<"small" | "medium" | "large">("small");
  const [pickupNotes, setPickupNotes] = useState("");
  const [dropoffNotes, setDropoffNotes] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [marketplaceDelivery, setMarketplaceDelivery] = useState(false);
  const [requiresLoadingHelp, setRequiresLoadingHelp] = useState(false);
  const [stairsInvolved, setStairsInvolved] = useState(false);
  const [weightEstimateKg, setWeightEstimateKg] = useState<number | "">("");
  const [storeId, setStoreId] = useState("");
  const [orderValueCents, setOrderValueCents] = useState<number | "">("");
  const [signatureRequired, setSignatureRequired] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [quantity, setQuantity] = useState<number | "">(1);
  const [estimatedItemCostCents, setEstimatedItemCostCents] = useState<number | "">(0);
  // Pet transport state
  const [petMode, setPetMode] = useState<"pet_with_owner" | "pet_only_transport">("pet_with_owner");
  const [petType, setPetType] = useState<"dog" | "cat" | "other">("dog");
  const [petWeightEstimate, setPetWeightEstimate] = useState<number | "">("");
  const [crateConfirmed, setCrateConfirmed] = useState(false);
  const [destinationType, setDestinationType] = useState<"vet" | "grooming" | "boarding" | "airport">("vet");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  // User geolocation
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locatingUser, setLocatingUser] = useState(false);
  // Rating state
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [manualRateRideId, setManualRateRideId] = useState<string | null>(null);
  const [manualRateDriverId, setManualRateDriverId] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          // Auto-fill pickup if not already set from URL params
          if (!pickup && !searchParams.get("pickup")) {
            setPickupCoords({ lat: latitude, lng: longitude });
            try {
              const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
              const geo = await res.json();
              setPickup(geo.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
            } catch {
              setPickup(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
            }
          }
        },
        () => {}
      );
    }
  }, []);

  // Pre-fill pickup/dropoff from URL params (e.g. saved places, "Where to?")
  useEffect(() => {
    const dropoffParam = searchParams.get("dropoff");
    const dlatParam = searchParams.get("dlat");
    const dlngParam = searchParams.get("dlng");
    if (dropoffParam) {
      setDropoff(decodeURIComponent(dropoffParam));
      if (dlatParam && dlngParam) {
        setDropoffCoords({ lat: parseFloat(dlatParam), lng: parseFloat(dlngParam) });
      }
    }
    const pickupParam = searchParams.get("pickup");
    const platParam = searchParams.get("plat");
    const plngParam = searchParams.get("plng");
    if (pickupParam) {
      setPickup(decodeURIComponent(pickupParam));
      if (platParam && plngParam) {
        setPickupCoords({ lat: parseFloat(platParam), lng: parseFloat(plngParam) });
      }
    }
  }, []);

  // Calculate distance through pickup → stops → dropoff (Haversine fallback).
  const distanceKm = useMemo(() => {
    if (!pickupCoords || !dropoffCoords) return null;
    const R = 6371;
    const points = [pickupCoords, ...stops.map((s) => ({ lat: s.lat, lng: s.lng })), dropoffCoords];
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const dLat = ((b.lat - a.lat) * Math.PI) / 180;
      const dLon = ((b.lng - a.lng) * Math.PI) / 180;
      const x = Math.sin(dLat / 2) ** 2 +
        Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
      total += R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    }
    return total;
  }, [pickupCoords, dropoffCoords, stops]);

  const resetBookingForm = () => {
    setPickup("");
    setDropoff("");
    setPickupCoords(null);
    setDropoffCoords(null);
    setStops([]);
    setPassengerCount(1);
    setBillToOrg(false);
    setPoNumber("");
    setCostCenter("");
  };

  return {
    searchParams, mode, serviceParam,
    pickup, setPickup, dropoff, setDropoff,
    pickupCoords, setPickupCoords, dropoffCoords, setDropoffCoords,
    stops, setStops,
    loading, setLoading,
    serviceType, setServiceType,
    paymentOption, setPaymentOption,
    paymentClientSecret, setPaymentClientSecret,
    authorizedAmountCents, setAuthorizedAmountCents,
    pendingRideId, setPendingRideId,
    passengerCount, setPassengerCount,
    billToOrg, setBillToOrg,
    poNumber, setPoNumber, costCenter, setCostCenter,
    packageSize, setPackageSize,
    pickupNotes, setPickupNotes, dropoffNotes, setDropoffNotes,
    itemDescription, setItemDescription,
    marketplaceDelivery, setMarketplaceDelivery,
    requiresLoadingHelp, setRequiresLoadingHelp,
    stairsInvolved, setStairsInvolved,
    weightEstimateKg, setWeightEstimateKg,
    storeId, setStoreId,
    orderValueCents, setOrderValueCents,
    signatureRequired, setSignatureRequired,
    storeName, setStoreName,
    quantity, setQuantity,
    estimatedItemCostCents, setEstimatedItemCostCents,
    petMode, setPetMode, petType, setPetType,
    petWeightEstimate, setPetWeightEstimate,
    crateConfirmed, setCrateConfirmed,
    destinationType, setDestinationType,
    emergencyContactPhone, setEmergencyContactPhone,
    userLocation, setUserLocation,
    locatingUser, setLocatingUser,
    ratingDialogOpen, setRatingDialogOpen,
    manualRateRideId, setManualRateRideId,
    manualRateDriverId, setManualRateDriverId,
    cancelDialogOpen, setCancelDialogOpen,
    distanceKm,
    resetBookingForm,
  };
};
